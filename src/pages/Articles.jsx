import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { OWNERS, COLOR_OPTIONS, PATTERN_OPTIONS, TIPO_OPTIONS, nextSkuForCode, DEFAULT_MARGIN_PCT, tagColor, tipoTemTamanho, ARTICLE_ESTADOS, ARTICLE_ESTADO_COLORS } from "../lib/constants";
import { money, pct, fmtDate, displaySku } from "../lib/computations";
import { uploadArticlePhoto, deleteArticlePhoto } from "../lib/photoStorage";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, FavoriteStar, TagBadge, TagSelect, useColumnFilters, FilterTh } from "../components/ui";

function emptyArticle(suppliers) {
  return {
    sku: "", tipo: TIPO_OPTIONS[0].label, artigo: "", cor: COLOR_OPTIONS[0], tamanho: "",
    fornecedor_id: suppliers[0]?.id || "", owner: "Rosa", preco_unitario: 0, iva: 23,
    quantidade: 0, valor_venda: 0, purchase_id: "", foto_url: "", publicado: false, etiquetado: false, estado: "Em stock",
    favorito: false, etiqueta: "", notas: "",
  };
}

function purchaseLabel(purchases, supplierName, id) {
  const p = purchases.find((x) => x.id === id);
  if (!p) return null;
  return `${fmtDate(p.data)}${p.fatura ? " · " + p.fatura : ""} · ${supplierName(p.supplier_id)}`;
}

export default function Articles({ articlesComputed, articles, suppliers, purchases, supplierName, contentItems, onViewContent, onOpenDetail, autoOpenNew, onConsumedAutoOpen, autoOpenEditId, onConsumedAutoOpenEdit, autoDuplicateId, onConsumedAutoDuplicate, autoNewSizeId, onConsumedAutoNewSize, settings }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) { setModal({ data: emptyArticle(suppliers), isNew: true }); onConsumedAutoOpen?.(); }
  }, [autoOpenNew]);

  useEffect(() => {
    if (autoOpenEditId) {
      const a = articlesComputed.find((x) => x.id === autoOpenEditId);
      if (a) setModal({ data: { ...a }, isNew: false });
      onConsumedAutoOpenEdit?.();
    }
  }, [autoOpenEditId, articlesComputed]);

  useEffect(() => {
    if (autoDuplicateId) {
      const a = articlesComputed.find((x) => x.id === autoDuplicateId);
      if (a) duplicateArticle(a);
      onConsumedAutoDuplicate?.();
    }
  }, [autoDuplicateId, articlesComputed]);

  useEffect(() => {
    if (autoNewSizeId) {
      const a = articlesComputed.find((x) => x.id === autoNewSizeId);
      if (a) newSizeVariant(a);
      onConsumedAutoNewSize?.();
    }
  }, [autoNewSizeId, articlesComputed]);

  function duplicateArticle(current) {
    const {
      id, sku, foto_url, created_at, deleted_at,
      vendidas, reservedQty, soldQty, physicalStock,
      valorTotalSemIVA, valorTotalComIVA, stockAtual,
      valorStockSemIVA, valorStockComIVA, margemUnit, margemPct,
      ...rest
    } = current;
    setModal({
      data: {
        ...rest,
        artigo: current.artigo ? `${current.artigo} (cópia)` : "",
        quantidade: 0,
        publicado: false,
        etiquetado: false,
        estado: "Em stock",
        foto_url: "",
        favorito: false,
        notas: "",
        tamanho: "",
      },
      isNew: true,
    });
  }

  // "Novo tamanho": mantém o mesmo SKU base e todos os outros dados do artigo original —
  // só o Tamanho (e a quantidade/foto/publicado/etiquetado/estado, que são por unidade física) ficam livres.
  function newSizeVariant(current) {
    const {
      id, foto_url, created_at, deleted_at,
      vendidas, reservedQty, soldQty, physicalStock,
      valorTotalSemIVA, valorTotalComIVA, stockAtual,
      valorStockSemIVA, valorStockComIVA, margemUnit, margemPct,
      ...rest
    } = current;
    setModal({
      data: {
        ...rest, // mantém sku, tipo, artigo, cor, fornecedor, preço, iva, valor de venda, etc.
        quantidade: 0,
        publicado: false,
        etiquetado: false,
        estado: "Em stock",
        foto_url: "",
        tamanho: "",
      },
      isNew: true,
      isNewSize: true,
    });
  }

  async function handleDelete(a) {
    const ok = await confirm({ title: "Eliminar artigo?", message: `"${a.artigo}" vai para a Lixeira — podes restaurar mais tarde.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("articles", a.id);
    notify("Artigo eliminado.");
  }

  async function toggleFavorite(a) {
    await updateRow("articles", a.id, { favorito: !a.favorito });
  }

  async function toggleEtiquetado(a) {
    await updateRow("articles", a.id, { etiquetado: !a.etiquetado });
  }

  const rows = articlesComputed
    .filter((a) => (a.sku + a.artigo + a.cor + (a.tipo || "") + supplierName(a.fornecedor_id)).toLowerCase().includes(q.toLowerCase()));

  const filterCols = {
    etiqueta: (a) => (a.etiqueta ? (tagColor(a.etiqueta)?.label || a.etiqueta) : "Sem etiqueta"),
    tipo: (a) => a.tipo || "—",
    tamanho: (a) => a.tamanho || "Sem tamanho",
    cor: (a) => a.cor || "—",
    fornecedor: (a) => supplierName(a.fornecedor_id),
    owner: (a) => a.owner || "—",
    publicado: (a) => (a.publicado ? "Sim" : "Não"),
    etiquetado: (a) => (a.etiquetado ? "Sim" : "Não"),
    estado: (a) => a.estado || "Em stock",
  };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(
    articlesComputed, filterCols,
    { estado: new Set(["Em stock", "Esgotado — vai repor"]) }
  );
  const filteredRows = applyFilters(rows).sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0));

  return (
    <div>
      <TabHeader
        title="Artigos & Stock"
        sub={`${articles.length} artigo(s) no catálogo`}
        btnLabel="Novo artigo"
        onNew={() => setModal({ data: emptyArticle(suppliers), isNew: true })}
        disabled={suppliers.length === 0}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
      />
      {suppliers.length === 0 && <p className="text-clay-dark text-xs -mt-2 mb-3">Cria primeiro um fornecedor.</p>}
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por SKU, tipo, artigo, cor ou fornecedor…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th></th><th>Foto</th><th>SKU</th><FilterTh label="Tipo" {...filterProps("tipo")} /><th>Artigo</th>
              <FilterTh label="Tamanho" {...filterProps("tamanho")} />
              <FilterTh label="Etiqueta" {...filterProps("etiqueta")} /><FilterTh label="Cor / padrão" {...filterProps("cor")} />
              <FilterTh label="Fornecedor" {...filterProps("fornecedor")} /><FilterTh label="Owner" {...filterProps("owner")} />
              <th>Preço un.</th><th>IVA</th><th>Qtd</th><th>Venda</th><th>Margem</th><th>Stock atual</th><th>Valor stock</th><th>Compra</th>
              <FilterTh label="Publicado" {...filterProps("publicado")} /><FilterTh label="Etiquetado" {...filterProps("etiquetado")} /><FilterTh label="Estado" {...filterProps("estado")} /><th>Conteúdo</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={23} text="Sem artigos." />}
            {filteredRows.map((a) => {
              const nContent = contentItems?.filter((c) => c.article_id === a.id).length || 0;
              return (
              <tr key={a.id}>
                <td><FavoriteStar active={!!a.favorito} onClick={() => toggleFavorite(a)} /></td>
                <td>
                  {a.foto_url ? (
                    <button type="button" onClick={() => onOpenDetail?.(a.id)}>
                      <img src={a.foto_url} alt="" className="w-9 h-9 object-cover rounded-md border border-line" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => onOpenDetail?.(a.id)} className="w-9 h-9 rounded-md bg-line/40 flex items-center justify-center text-stone text-xs">—</button>
                  )}
                </td>
                <td className="font-mono text-xs text-stone">{displaySku(a) || "—"}</td>
                <td className="text-stone">{a.tipo || "—"}</td>
                <td>
                  <button type="button" onClick={() => onOpenDetail?.(a.id)} className="font-medium text-ink underline decoration-line hover:decoration-rust text-left">
                    {a.artigo}
                  </button>
                </td>
                <td className="text-stone">{a.tamanho || "—"}</td>
                <td>{a.etiqueta ? <TagBadge value={a.etiqueta} /> : <span className="text-stone">—</span>}</td>
                <td className="text-stone">{a.cor || "—"}</td>
                <td className="text-stone">{supplierName(a.fornecedor_id)}</td>
                <td><Badge text={a.owner} color={a.owner === "Rosa" ? "#832F72" : "#A67C1E"} bg={a.owner === "Rosa" ? "#F7E3F2" : "#F5EADD"} /></td>
                <td className="font-mono text-xs">{money(a.preco_unitario)}</td>
                <td className="font-mono text-xs">{pct(a.iva)}</td>
                <td className="font-mono">{a.quantidade}</td>
                <td className="font-mono text-xs">{money(a.valor_venda)}</td>
                <td className={`font-mono text-xs ${a.margemUnit >= 0 ? "text-sage-dark" : "text-clay-dark"}`}>{money(a.margemUnit)} · {pct(a.margemPct)}</td>
                <td className={`font-mono font-medium ${a.stockAtual <= 3 ? "text-clay-dark" : ""}`}>{a.stockAtual}</td>
                <td className="font-mono text-xs">{money(a.valorStockSemIVA)}</td>
                <td className="text-stone text-xs">{purchaseLabel(purchases, supplierName, a.purchase_id) || "—"}</td>
                <td>{a.publicado ? <span className="text-sage-dark">✓ Sim</span> : <span className="text-stone">Não</span>}</td>
                <td>
                  <button type="button" onClick={() => toggleEtiquetado(a)} title={a.etiquetado ? "Etiquetado — clicar para desmarcar" : "Não etiquetado — clicar para marcar"} className="text-lg leading-none">
                    {a.etiquetado ? "🟢" : "⚪"}
                  </button>
                </td>
                <td>
                  {(() => { const ec = ARTICLE_ESTADO_COLORS[a.estado] || ARTICLE_ESTADO_COLORS["Em stock"]; return <Badge text={a.estado || "Em stock"} color={ec.color} bg={ec.bg} />; })()}
                </td>
                <td>
                  <button type="button" onClick={() => onViewContent?.(a.id)} className="text-xs font-medium text-purple-600 underline">
                    📱 {nContent > 0 ? `${nContent} ver` : "adicionar"}
                  </button>
                </td>
                <RowActions
                  onEdit={() => setModal({ data: { ...a }, isNew: false })}
                  onDuplicate={() => duplicateArticle(a)}
                  onNewSize={tipoTemTamanho(a.tipo) ? () => newSizeVariant(a) : undefined}
                  onDelete={() => handleDelete(a)}
                />
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ArticleModal
          data={modal.data}
          isNew={modal.isNew}
          isNewSize={!!modal.isNewSize}
          articles={articles}
          suppliers={suppliers}
          purchases={purchases}
          onClose={() => setModal(null)}
          onDuplicate={duplicateArticle}
          onNewSize={newSizeVariant}
          onViewContent={(articleId) => { setModal(null); onViewContent?.(articleId); }}
          contentCount={modal.isNew ? 0 : (contentItems?.filter((c) => c.article_id === modal.data.id).length || 0)}
          margemAlvoDefeito={settings?.margem_alvo_pct ?? DEFAULT_MARGIN_PCT}
          onSave={async (values, isNewArticle) => {
            let final = values;
            if (isNewArticle && !modal.isNewSize) {
              const tipoEntry = TIPO_OPTIONS.find((t) => t.label === values.tipo) || TIPO_OPTIONS[0];
              const { data: sku, error } = await supabase.rpc("next_sku", { p_code: tipoEntry.code });
              if (error) { alert("Não foi possível gerar o SKU: " + error.message); return; }
              final = { ...values, sku };
            }
            if (final.purchase_id === "") final.purchase_id = null;
            if (isNewArticle) await insertRow("articles", final);
            else await updateRow("articles", modal.data.id, final);
            notify(isNewArticle ? `Artigo adicionado (${displaySku(final)}).` : "Artigo atualizado.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function ArticleModal({ data, isNew, isNewSize, articles, suppliers, purchases, onClose, onSave, onDuplicate, onNewSize, onViewContent, contentCount, margemAlvoDefeito }) {
  const [f, setF] = useState(data);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [margemAlvo, setMargemAlvo] = useState(margemAlvoDefeito ?? DEFAULT_MARGIN_PCT);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setNum = (k) => (e) => setF({ ...f, [k]: parseFloat(e.target.value) || 0 });
  const tipoEntry = TIPO_OPTIONS.find((t) => t.label === f.tipo) || TIPO_OPTIONS[0];
  const temTamanho = tipoTemTamanho(f.tipo);
  const skuBase = isNew && !isNewSize ? nextSkuForCode(tipoEntry.code, articles) : f.sku;
  const skuPreview = temTamanho && f.tamanho ? `${skuBase}-${f.tamanho}` : skuBase;
  const lockedCls = `${inputCls} bg-line/40 text-stone`;

  const custoComIVA = (Number(f.preco_unitario) || 0) * (1 + (Number(f.iva) || 0) / 100);
  const sugestaoVenda = custoComIVA > 0 && margemAlvo < 100 ? custoComIVA / (1 - margemAlvo / 100) : 0;

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadArticlePhoto(file, f.id);
      setF((prev) => ({ ...prev, foto_url: url }));
    } catch (err) {
      setError("Não foi possível enviar a foto: " + (err.message || "erro desconhecido"));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    const url = f.foto_url;
    setF((prev) => ({ ...prev, foto_url: "" }));
    await deleteArticlePhoto(url);
  }

  return (
    <ModalShell
      title={isNewSize ? "Novo tamanho" : isNew ? "Novo artigo" : "Editar artigo"}
      subtitle={isNewSize ? "Os restantes dados ficam iguais ao artigo original — só o Tamanho (e quantidade/foto) podem mudar." : "SKU, stock atual, margens e valores totais calculam-se automaticamente."}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Tipo">
          <select className={isNewSize ? lockedCls : inputCls} value={f.tipo} onChange={set("tipo")} disabled={isNewSize}>
            {["Vestuário", "Acessórios", "Calçado"].map((g) => (
              <optgroup label={g} key={g}>
                {TIPO_OPTIONS.filter((t) => t.group === g).map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="SKU"><input className={lockedCls} value={skuPreview} disabled /></Field>
      </div>
      {temTamanho && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Tamanho">
            <input className={inputCls} value={f.tamanho || ""} onChange={set("tamanho")} placeholder="ex: M, 42, 90cm…" autoFocus={isNewSize} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Artigo"><input className={isNewSize ? lockedCls : inputCls} value={f.artigo} onChange={set("artigo")} disabled={isNewSize} /></Field>
        <Field label="Cor / padrão">
          <select className={isNewSize ? lockedCls : inputCls} value={f.cor} onChange={set("cor")} disabled={isNewSize}>
            <optgroup label="Cores">{COLOR_OPTIONS.map((c) => <option key={c}>{c}</option>)}</optgroup>
            <optgroup label="Padrões">{PATTERN_OPTIONS.map((c) => <option key={c}>{c}</option>)}</optgroup>
          </select>
        </Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Fornecedor">
          <select className={isNewSize ? lockedCls : inputCls} value={f.fornecedor_id} onChange={set("fornecedor_id")} disabled={isNewSize}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
        <Field label="Owner">
          <select className={isNewSize ? lockedCls : inputCls} value={f.owner} onChange={set("owner")} disabled={isNewSize}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Preço unitário (€, s/IVA)"><input type="number" step="0.01" min="0" className={isNewSize ? lockedCls : inputCls} value={f.preco_unitario} onChange={setNum("preco_unitario")} disabled={isNewSize} /></Field>
        <Field label="IVA (%)"><input type="number" step="1" min="0" className={isNewSize ? lockedCls : inputCls} value={f.iva} onChange={setNum("iva")} disabled={isNewSize} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Quantidade adquirida"><input type="number" min="0" className={inputCls} value={f.quantidade} onChange={setNum("quantidade")} /></Field>
        <Field label="Valor de venda (€, unidade)"><input type="number" step="0.01" min="0" className={isNewSize ? lockedCls : inputCls} value={f.valor_venda} onChange={setNum("valor_venda")} disabled={isNewSize} /></Field>
      </div>
      {custoComIVA > 0 && !isNewSize && (
        <div className="flex items-center gap-2 -mt-1.5 mb-3 text-xs text-stone">
          <span>Sugestão com margem de</span>
          <input
            type="number" min="0" max="95" value={margemAlvo}
            onChange={(e) => setMargemAlvo(parseFloat(e.target.value) || 0)}
            className="w-14 border border-line rounded px-1.5 py-0.5 text-xs text-center"
          />
          <span>%: <span className="font-mono text-ink">{money(sugestaoVenda)}</span></span>
          <button type="button" onClick={() => setF({ ...f, valor_venda: Number(sugestaoVenda.toFixed(2)) })} className="text-purple-600 font-medium underline">
            usar
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Etiqueta"><TagSelect value={f.etiqueta} onChange={(v) => setF({ ...f, etiqueta: v })} disabled={isNewSize} /></Field>
        <Field label="Favorito">
          <div className="flex items-center gap-2 h-[38px]">
            <FavoriteStar active={!!f.favorito} onClick={() => setF({ ...f, favorito: !f.favorito })} size="text-xl" />
            <span className="text-sm text-ink">{f.favorito ? "Nos favoritos" : "Marcar como favorito"}</span>
          </div>
        </Field>
      </div>
      <div className="mb-3">
        <Field label="Foto do artigo" span>
          <div className="flex items-center gap-3">
            <input type="file" accept="image/*" onChange={handlePhoto} disabled={uploading} className={`${inputCls} py-1.5`} />
            {uploading && <span className="text-xs text-stone flex-shrink-0">A enviar…</span>}
          </div>
        </Field>
        {f.foto_url ? (
          <div className="flex items-center gap-3 mt-2">
            <img src={f.foto_url} alt="" className="w-16 h-16 object-cover rounded-lg border border-line" />
            <button type="button" onClick={handleRemovePhoto} className="text-xs text-clay-dark underline">remover foto</button>
          </div>
        ) : (
          <p className="text-xs text-stone mt-1">Sem foto ainda.</p>
        )}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input type="checkbox" id="publicado" checked={!!f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} className="w-4 h-4" />
        <label htmlFor="publicado" className="text-sm text-ink">Publicado nas redes sociais</label>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input type="checkbox" id="etiquetado" checked={!!f.etiquetado} onChange={(e) => setF({ ...f, etiquetado: e.target.checked })} className="w-4 h-4" />
        <label htmlFor="etiquetado" className="text-sm text-ink">🏷️ Peça já etiquetada (etiqueta física colocada)</label>
      </div>
      <div className="mb-3">
        <Field label="Estado do artigo">
          <select className={inputCls} value={f.estado || "Em stock"} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            {ARTICLE_ESTADOS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </Field>
        <p className="text-stone text-[11px] mt-1">"Em stock" e "Esgotado — vai repor" alternam sozinhos consoante o stock atual (não precisas de mudar à mão). "Sem Reposição" e "Pausado" deixam de aparecer nos alertas de stock esgotado/baixo do Painel — úteis para peças que já sabes que não vais repor ou que estão temporariamente fora de venda.</p>
      </div>
      {!isNew && (
        <div className="mb-3 bg-purple-50 border border-purple-200 rounded-md px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-xs text-purple-700">
            📱 {contentCount > 0 ? `${contentCount} publicação(ões) no Centro de Conteúdo` : "Ainda sem publicações no Centro de Conteúdo"}
          </span>
          <button type="button" onClick={() => onViewContent?.(f.id)} className="text-xs font-medium text-purple-700 underline flex-shrink-0">
            {contentCount > 0 ? "Ver" : "+ Adicionar"}
          </button>
        </div>
      )}
      <div className="mb-5">
        <Field label="Compra associada" span>
          <select className={isNewSize ? lockedCls : inputCls} value={f.purchase_id || ""} onChange={set("purchase_id")} disabled={isNewSize}>
            <option value="">— nenhuma / a definir —</option>
            {purchases.map((p) => (
              <option key={p.id} value={p.id}>
                {fmtDate(p.data)}{p.fatura ? ` · ${p.fatura}` : ""} · {suppliers.find((s) => s.id === p.supplier_id)?.nome || "—"}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mb-5">
        <Field label="Notas" span><textarea rows={3} className={isNewSize ? lockedCls : inputCls} value={f.notas || ""} onChange={set("notas")} placeholder="Notas internas sobre este artigo…" disabled={isNewSize} /></Field>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={async () => {
          if (!f.artigo.trim()) { setError("Indica o nome do artigo."); return; }
          if (temTamanho && !String(f.tamanho || "").trim()) { setError("Indica o tamanho."); return; }
          return onSave(f, isNew);
        }}
        label="Guardar artigo"
        left={!isNew && (
          <div className="flex gap-2">
            <Button variant="default" onClick={() => onDuplicate(f)} title="Cria um novo artigo com estes dados pré-preenchidos">
              ⎘ Duplicar
            </Button>
            {!isNewSize && tipoTemTamanho(f.tipo) && (
              <Button variant="default" onClick={() => onNewSize(f)} title="Cria um novo tamanho deste artigo, com o mesmo SKU base">
                📏 Novo tamanho
              </Button>
            )}
          </div>
        )}
      />
    </ModalShell>
  );
}
