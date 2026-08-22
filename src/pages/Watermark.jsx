import { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { Field, Button, inputCls } from "../components/ui";

// Formatos de exportação — recorta a foto para preencher o enquadramento (tipo "cover"),
// tal como o Instagram faz ao publicar.
const FORMATS = {
  original: { label: "Original (sem cortar)" },
  feed: { w: 1080, h: 1350, label: "Instagram feed vertical — 1080×1350" },
  square: { w: 1080, h: 1080, label: "Quadrado — 1080×1080" },
  story: { w: 1080, h: 1920, label: "Stories / Reels / TikTok — 1080×1920" },
};

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function baseName(name) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

// Deteta automaticamente o centro da peça numa foto, comparando cada pixel com a cor média
// dos 4 cantos (assumida como fundo) — funciona bem com fundo liso/uniforme, não substitui
// a confirmação visual.
function detectSubjectCenter(img) {
  const maxDim = 220;
  const ratio = img.naturalWidth / img.naturalHeight;
  let sw, sh;
  if (ratio >= 1) { sw = maxDim; sh = Math.max(1, Math.round(maxDim / ratio)); }
  else { sh = maxDim; sw = Math.max(1, Math.round(maxDim * ratio)); }
  const off = document.createElement("canvas");
  off.width = sw; off.height = sh;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0, sw, sh);
  const data = octx.getImageData(0, 0, sw, sh).data;

  const patch = Math.max(4, Math.round(Math.min(sw, sh) * 0.08));
  function avgRegion(x0, y0, w, h) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const idx = (y * sw + x) * 4;
        r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; n++;
      }
    }
    return [r / n, g / n, b / n];
  }
  const corners = [
    avgRegion(0, 0, patch, patch),
    avgRegion(sw - patch, 0, patch, patch),
    avgRegion(0, sh - patch, patch, patch),
    avgRegion(sw - patch, sh - patch, patch, patch),
  ];
  const bg = [0, 0, 0];
  corners.forEach((c) => { bg[0] += c[0]; bg[1] += c[1]; bg[2] += c[2]; });
  bg[0] /= 4; bg[1] /= 4; bg[2] /= 4;

  let sumX = 0, sumY = 0, sumW = 0;
  const threshold = 32;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const dr = data[idx] - bg[0], dg = data[idx + 1] - bg[1], db = data[idx + 2] - bg[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > threshold) { sumX += x * dist; sumY += y * dist; sumW += dist; }
    }
  }
  if (sumW < 1) return null;
  return { xFrac: (sumX / sumW) / sw, yFrac: (sumY / sumW) / sh };
}

function drawImageCover(ctx, img, targetW, targetH) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = targetW / targetH;
  let sx, sy, sw, sh;
  if (imgRatio > targetRatio) {
    sh = img.naturalHeight; sw = sh * targetRatio; sx = (img.naturalWidth - sw) / 2; sy = 0;
  } else {
    sw = img.naturalWidth; sh = sw / targetRatio; sx = 0; sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
}

function drawWatermark(ctx, w, h, wm, logo) {
  if (!logo) return;
  const logoW = wm.scaleFrac * w;
  const logoH = logoW / logo.aspect;
  const cx = wm.xFrac * w, cy = wm.yFrac * h;
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.translate(cx, cy);
  ctx.rotate(wm.rotationDeg * Math.PI / 180);
  ctx.drawImage(logo.img, -logoW / 2, -logoH / 2, logoW, logoH);
  ctx.restore();
}

function renderPhotoToCanvas(canvas, photo, exportFormat, logo) {
  let w, h;
  const ctx = canvas.getContext("2d");
  const fmt = FORMATS[exportFormat];
  if (exportFormat === "original" || !fmt.w) {
    w = photo.img.naturalWidth; h = photo.img.naturalHeight;
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(photo.img, 0, 0, w, h);
  } else {
    w = fmt.w; h = fmt.h;
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    drawImageCover(ctx, photo.img, w, h);
  }
  (photo.watermarks || []).forEach((wm) => drawWatermark(ctx, w, h, wm, logo));
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

const DEFAULT_WM = { xFrac: 0.5, yFrac: 0.5, scaleFrac: 0.28, rotationDeg: 0, opacity: 0.85 };
const uidWm = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
// Só o logotipo fica guardado entre sessões (as fotos mudam sempre, por isso não valia a
// pena guardá-las) — poupa ter de o carregar de novo sempre que se abre a ferramenta.
const LOGO_STORAGE_KEY = "r2_watermark_logo";

function loadImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function Watermark() {
  const [logo, setLogo] = useState(null); // { img, aspect, src }
  const [photos, setPhotos] = useState([]); // [{ id, name, img, watermarks: [{ id, xFrac, yFrac, scaleFrac, rotationDeg, opacity }] }]
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [selectedWmIndex, setSelectedWmIndex] = useState(0); // qual marca de água desta foto está a ser editada
  const [exportFormat, setExportFormat] = useState("original");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const draggingRef = useRef(false);

  const current = currentIndex >= 0 ? photos[currentIndex] : null;
  const selectedWm = current?.watermarks?.[selectedWmIndex] || null;

  // Recupera o logotipo guardado da última vez, se existir.
  useEffect(() => {
    const saved = localStorage.getItem(LOGO_STORAGE_KEY);
    if (!saved) return;
    loadImageFromSrc(saved)
      .then((img) => setLogo({ img, aspect: img.naturalWidth / img.naturalHeight, src: saved }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (current && canvasRef.current) renderPhotoToCanvas(canvasRef.current, current, exportFormat, logo);
  }, [current, exportFormat, logo]);

  // Sempre que se muda de foto, a marca de água selecionada volta a ser a primeira.
  useEffect(() => { setSelectedWmIndex(0); }, [currentIndex]);

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const img = await fileToImage(file);
      setLogo({ img, aspect: img.naturalWidth / img.naturalHeight, src: img.src });
      try { localStorage.setItem(LOGO_STORAGE_KEY, img.src); } catch { /* quota cheia ou bloqueado — não é crítico */ }
    } catch {
      setStatus("Não consegui ler o logotipo — tenta outra imagem.");
    }
  }

  function forgetSavedLogo() {
    localStorage.removeItem(LOGO_STORAGE_KEY);
    setLogo(null);
    setStatus("Logotipo esquecido.");
  }

  async function handlePhotosChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true); setStatus("A carregar fotos…");
    const novas = [];
    for (const file of files) {
      try {
        const img = await fileToImage(file);
        novas.push({ id: uidWm(), name: file.name, img, watermarks: [{ id: uidWm(), ...DEFAULT_WM }] });
      } catch { /* ignora ficheiro ilegível */ }
    }
    e.target.value = "";
    setPhotos((prev) => {
      const merged = [...prev, ...novas];
      if (currentIndex === -1 && merged.length) setCurrentIndex(0);
      return merged;
    });
    setBusy(false); setStatus("");
  }

  function removePhoto(i) {
    setPhotos((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      setCurrentIndex((ci) => {
        if (i === ci) return next.length ? Math.min(ci, next.length - 1) : -1;
        return ci > i ? ci - 1 : ci;
      });
      return next;
    });
  }

  function updateSelectedWm(patch) {
    setPhotos((prev) => prev.map((p, i) => {
      if (i !== currentIndex) return p;
      return { ...p, watermarks: p.watermarks.map((wm, wi) => (wi === selectedWmIndex ? { ...wm, ...patch } : wm)) };
    }));
  }

  function addWatermark() {
    if (!current) return;
    // Nova marca ligeiramente deslocada do centro, para não ficar escondida atrás da primeira.
    const novaWm = { id: uidWm(), ...DEFAULT_WM, xFrac: 0.7, yFrac: 0.7 };
    setPhotos((prev) => prev.map((p, i) => (i === currentIndex ? { ...p, watermarks: [...p.watermarks, novaWm] } : p)));
    setSelectedWmIndex(current.watermarks.length); // seleciona a nova
  }

  function removeWatermark(i) {
    if (!current || current.watermarks.length <= 1) return; // mantém sempre pelo menos 1
    setPhotos((prev) => prev.map((p, pi) => (pi === currentIndex ? { ...p, watermarks: p.watermarks.filter((_, wi) => wi !== i) } : p)));
    setSelectedWmIndex((si) => (i === si ? 0 : si > i ? si - 1 : si));
  }

  function autoCenterCurrent() {
    if (!current || !selectedWm) return;
    setStatus("A analisar a foto…");
    setTimeout(() => {
      const result = detectSubjectCenter(current.img);
      if (result) {
        updateSelectedWm(result);
        setStatus("Centrado automaticamente — confirma se ficou bem.");
      } else {
        setStatus("Não consegui identificar a peça com confiança — posiciona manualmente.");
      }
    }, 20);
  }

  // Deteta o centro em todas as fotos e move só a marca de água na posição atualmente
  // selecionada (ex: a 1ª) de cada uma — as restantes marcas de cada foto não são tocadas.
  async function autoCenterAll() {
    if (!photos.length) return;
    setBusy(true); setStatus("A analisar fotos…");
    let missed = 0;
    const atualizadas = [];
    for (let i = 0; i < photos.length; i++) {
      await new Promise((r) => setTimeout(r, 0));
      const result = detectSubjectCenter(photos[i].img);
      if (result && photos[i].watermarks[selectedWmIndex]) {
        atualizadas.push({ ...photos[i], watermarks: photos[i].watermarks.map((wm, wi) => (wi === selectedWmIndex ? { ...wm, ...result } : wm)) });
      } else {
        atualizadas.push(photos[i]);
        if (!result) missed++;
      }
    }
    setPhotos(atualizadas);
    setBusy(false);
    setStatus(missed ? `Aplicado — ${missed} foto(s) sem deteção clara, confirma manualmente.` : "Deteção aplicada a todas as fotos — confirma cada uma antes de descarregar.");
  }

  // Copia TODAS as marcas de água desta foto (posições, tamanhos, quantas são) para as
  // restantes — substitui por completo as marcas que cada outra foto já tivesse.
  function applyToAll() {
    if (!current) return;
    const watermarks = current.watermarks.map((wm) => ({ ...wm }));
    setPhotos((prev) => prev.map((p) => ({ ...p, watermarks: watermarks.map((wm) => ({ ...wm, id: uidWm() })) })));
    setStatus("Marca(s) de água aplicada(s) a todas as fotos.");
  }

  function canvasPointFromEvent(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function startDrag(e) {
    if (!current || !logo || !selectedWm) return;
    draggingRef.current = true;
    moveDrag(e);
    e.preventDefault();
  }
  function moveDrag(e) {
    if (!draggingRef.current || !current) return;
    const canvas = canvasRef.current;
    const pt = canvasPointFromEvent(e);
    updateSelectedWm({ xFrac: Math.min(1, Math.max(0, pt.x / canvas.width)), yFrac: Math.min(1, Math.max(0, pt.y / canvas.height)) });
    e.preventDefault();
  }
  function endDrag() { draggingRef.current = false; }

  async function downloadOne() {
    if (!current) return;
    setStatus("A preparar download…");
    const blob = await canvasToBlob(canvasRef.current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${baseName(current.name)}-marca-agua.jpg`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Download pronto.");
  }

  async function downloadAll() {
    if (!photos.length || !logo) return;
    setBusy(true);
    const zip = new JSZip();
    const offscreen = document.createElement("canvas");
    for (let i = 0; i < photos.length; i++) {
      setStatus(`A preparar foto ${i + 1} de ${photos.length}…`);
      renderPhotoToCanvas(offscreen, photos[i], exportFormat, logo);
      const blob = await canvasToBlob(offscreen);
      zip.file(`${baseName(photos[i].name)}-marca-agua.jpg`, blob);
    }
    setStatus("A gerar ficheiro zip…");
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url; a.download = "fotos-marca-agua.zip";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Todas as fotos descarregadas.");
    setBusy(false);
  }

  const canDownload = !!logo && photos.length > 0;

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold mb-0.5">🖼️ Marca de Água</h1>
        <p className="text-stone text-sm">Carrega fotos, posiciona o logotipo sobre a peça e descarrega já protegidas — uma a uma ou todas de vez.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* ---------- Coluna de controlo ---------- */}
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">1. Logotipo</p>
            <label className="relative flex flex-col items-center justify-center border border-dashed border-line rounded-lg p-4 text-center cursor-pointer bg-white hover:border-rust transition-colors">
              <input type="file" accept="image/*" onChange={handleLogoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              {logo ? (
                <>
                  <img src={logo.src} alt="" className="max-w-full max-h-14 mb-2" />
                  <span className="text-xs text-stone">Toca para trocar o logotipo</span>
                </>
              ) : (
                <span className="text-xs text-stone">Toca para carregar o logotipo<br />(PNG com fundo transparente fica melhor)</span>
              )}
            </label>
            {logo && (
              <button type="button" onClick={forgetSavedLogo} className="text-[11px] text-stone underline mt-1">
                esquecer logotipo guardado
              </button>
            )}
            <p className="text-[11px] text-stone mt-1">Fica guardado neste dispositivo entre sessões — não precisas de o carregar de novo sempre.</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">2. Fotos</p>
            <label className="relative flex items-center justify-center border border-dashed border-line rounded-lg p-4 text-center cursor-pointer bg-white hover:border-rust transition-colors">
              <input type="file" accept="image/*" multiple onChange={handlePhotosChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="text-xs text-stone">Toca para adicionar fotos<br />(podes escolher várias de uma vez)</span>
            </label>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5 max-h-64 overflow-y-auto pr-0.5">
                {photos.map((p, i) => (
                  <div key={p.id} onClick={() => setCurrentIndex(i)} className={`relative w-14 h-14 rounded-md overflow-hidden cursor-pointer border-2 ${i === currentIndex ? "border-rust" : "border-transparent"}`}>
                    <img src={p.img.src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-ink/70 text-white text-[10px] flex items-center justify-center leading-none"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {current && (
            <>
              <div className="border-t border-line pt-4">
                <p className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">3. Formato de exportação</p>
                <select className={inputCls} value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                  {Object.entries(FORMATS).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
                </select>
                <p className="text-[11px] text-stone mt-1.5">Ao mudar de formato a foto é recortada (preenche o enquadramento); pode ser preciso reajustar a posição do logotipo.</p>
              </div>

              {logo && (
                <div className="border-t border-line pt-4">
                  <p className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">4. Ajustar marca(s) de água</p>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {current.watermarks.map((wm, i) => (
                      <button
                        key={wm.id}
                        type="button"
                        onClick={() => setSelectedWmIndex(i)}
                        className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${i === selectedWmIndex ? "bg-rust text-white border-rust" : "bg-white text-stone border-line"}`}
                      >
                        Marca {i + 1}
                        {current.watermarks.length > 1 && (
                          <span onClick={(e) => { e.stopPropagation(); removeWatermark(i); }} className="ml-0.5 opacity-70 hover:opacity-100">×</span>
                        )}
                      </button>
                    ))}
                    <button type="button" onClick={addWatermark} className="text-xs rounded-full px-2.5 py-1 border border-dashed border-line text-stone hover:border-rust">
                      + Adicionar marca de água
                    </button>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <Button className="flex-1 justify-center" onClick={autoCenterCurrent}>🔍 Centrar automaticamente</Button>
                  </div>
                  <Button className="w-full justify-center mb-2" onClick={autoCenterAll} disabled={busy}>Detetar em todas as fotos</Button>
                  <p className="text-[11px] text-stone mb-3">Funciona melhor com fundo liso/uniforme. Confirma sempre o resultado — não substitui o ajuste manual. Afeta sempre a marca selecionada acima (ex: "Marca 1") em cada foto.</p>

                  {selectedWm && (
                    <div className="flex flex-col gap-3">
                      <SliderField label="Posição horizontal" value={Math.round(selectedWm.xFrac * 100)} suffix="%" min={0} max={100} onChange={(v) => updateSelectedWm({ xFrac: v / 100 })} />
                      <SliderField label="Posição vertical" value={Math.round(selectedWm.yFrac * 100)} suffix="%" min={0} max={100} onChange={(v) => updateSelectedWm({ yFrac: v / 100 })} />
                      <SliderField label="Tamanho" value={Math.round(selectedWm.scaleFrac * 100)} suffix="%" min={8} max={70} onChange={(v) => updateSelectedWm({ scaleFrac: v / 100 })} />
                      <SliderField label="Rotação" value={selectedWm.rotationDeg} suffix="°" min={-45} max={45} onChange={(v) => updateSelectedWm({ rotationDeg: v })} />
                      <SliderField label="Opacidade" value={Math.round(selectedWm.opacity * 100)} suffix="%" min={15} max={100} onChange={(v) => updateSelectedWm({ opacity: v / 100 })} />
                      <p className="text-[11px] text-stone">Arrasta o logotipo diretamente na foto, ou usa os cursores acima, para colocar a marca selecionada sobre a peça.</p>
                      <Button onClick={applyToAll}>Usar esta(s) marca(s) em todas as fotos</Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="border-t border-line pt-4 mt-auto">
            <div className="flex gap-2">
              <Button className="flex-1 justify-center" onClick={downloadOne} disabled={!current || busy}>Descarregar esta</Button>
              <Button variant="primary" className="flex-1 justify-center" onClick={downloadAll} disabled={!canDownload || busy}>Descarregar todas</Button>
            </div>
            {status && <p className="text-xs text-stone mt-2">{status}</p>}
          </div>
        </div>

        {/* ---------- Palco (canvas) ---------- */}
        <div className="flex flex-col items-center gap-3">
          {!current ? (
            <div className="w-full bg-white border border-line rounded-xl flex items-center justify-center text-stone text-sm text-center p-16">
              Carrega o teu logotipo e depois as fotos das peças para começares.
            </div>
          ) : (
            <>
              <div className="w-full max-w-xl bg-ink rounded-xl overflow-hidden shadow-soft flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto block touch-none cursor-grab active:cursor-grabbing"
                  onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={endDrag} onMouseLeave={endDrag}
                  onTouchStart={startDrag} onTouchMove={moveDrag} onTouchEnd={endDrag}
                />
              </div>
              <p className="text-xs text-stone max-w-xl truncate w-full text-center">{current.name}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderField({ label, value, suffix, min, max, onChange }) {
  return (
    <Field label={<span className="flex justify-between"><span>{label}</span><span>{value}{suffix}</span></span>}>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-rust" />
    </Field>
  );
}
