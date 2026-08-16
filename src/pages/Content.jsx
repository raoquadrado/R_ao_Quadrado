import { useState, useEffect } from "react";
import { deleteRow } from "../lib/useRealtimeTable";
import { saveContentItem } from "../lib/contentHelpers";
import { CONTENT_STATUS, CONTENT_STATUS_COLORS, CONTENT_NETWORKS, CONTENT_NETWORK_COLORS, CONTENT_TIPOS, CONTENT_TIPO_PREFIXO, CONTENT_TIPO_COLORS } from "../lib/constants";
import { fmtDate, displaySku, sugerirCodigoPorData } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, useColumnFilters, FilterTh } from "../components/ui";

export const empty = (articles, presetArticleId, isGeneral) => ({
  codigo: "", tipo: CONTENT_TIPOS[0],
  article_id: isGeneral ? "" : (presetArticleId || articles[0]?.id || ""),
  titulo: "", link_onedrive: "",
  estado: "Por fotografar", rede: "", link: "", data_publicacao: "", observacoes: "",
  isGeneral: !!isGeneral,
});

export default function Content({ contentItems, articles, articleName, autoOpenNew, onConsumedAutoOpen, autoFilterArticleId, onConsumedAutoFilter, presetArticleId, onConsumedPresetArticle, onOpenArticle }) {
  const [qArtigos, setQArtigos] = useState("");
  const [qGeral, setQGeral] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) {
      setModal({ data: empty(articles, presetArticleId, false), isNew: true });
      onConsumedAutoOpen?.();
      if (presetArticleId) onConsumedPresetArticle?.();
    }
  }, [autoOpenNew]);

  useEffect(() => {
    if (autoFilterArticleId) {
      const a = articles.find((x) => x.id === autoFilterArticleId);
      if (a) setQArtigos(a.artigo);
      onConsumedAutoFilter?.();
    }
  }, [autoFilterArticleId]);

  const itensArtigos = contentItems.filter((c) => c.article_id);
  const itensGerais = contentItems.filter((c) => !c.article_id);

  const rowsArtigos = itensArtigos.filter((c) => {
    const artigo = articles.find((a) => a.id === c.article_id);
    return ((artigo ? displaySku(artigo) : "") + articleName(c.article_id) + (c.rede || "") + (c.observacoes || "")).toLowerCase().includes(qArtigos.toLowerCase());
  });
  const rowsGerais = itensGerais.filter((c) =>
    ((c.titulo || "") + (c.rede || "") + (c.observacoes || "")).toLowerCase().includes(qGeral.toLowerCase())
  );

  const filterColsArtigos = {
    tipo: (c) => c.tipo || "—",
    estado: (c) => c.estado || "Por fotografar",
    rede: (c) => c.rede || "— por definir —",
  };
  const { filterProps: filterPropsArtigos, applyFilters: applyFiltersArtigos, hasActiveFilters: hasActiveFiltersArtigos, clearAllFilters: clearAllFiltersArtigos } = useColumnFilters(itensArtigos, filterColsArtigos);

  const filterColsGerais = {
    tipo: (c) => c.tipo || "—",
    estado: (c) => c.estado || "Por fotografar",
    rede: (c) => c.rede || "— por definir —",
  };
  const { filterProps: filterPropsGerais, applyFilters: applyFiltersGerais, hasActiveFilters: hasActiveFiltersGerais, clearAllFilters: clearAllFiltersGerais } = useColumnFilters(itensGerais, filterColsGerais);

  // Por defeito só mostra o que ainda não foi publicado, ordenado pela data de publicação
  // (o que não tem data definida vai para o fim). "Limpar filtros" também mostra o publicado.
  const [onlyUnpublished, setOnlyUnpublished] = useState(true);
  const porData = (a, b) => {
    if (!a.data_publicacao && !b.data_publicacao) return 0;
    if (!a.data_publicacao) return 1;
    if (!b.data_publicacao) return -1;
    return a.data_publicacao.localeCompare(b.data_publicacao);
  };
  const filteredArtigos = applyFiltersArtigos(rowsArtigos)
    .filter((c) => !onlyUnpublished || c.estado !== "Publicado")
    .sort(porData);
  const filteredGerais = applyFiltersGerais(rowsGerais)
    .filter((c) => !onlyUnpublished || c.estado !== "Publicado")
    .sort(porData);

  async function handleDelete(c) {
    const nome = c.article_id ? articleName(c.article_id) : (c.titulo || "conteúdo geral");
    const ok = await confirm({ title: "Eliminar publicação?", message: `O conteúdo de "${nome}" vai para a Lixeira.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("content_items", c.id);
    notify("Conteúdo eliminado.");
  }

  async function handleSave(values) {
    const clean = await saveContentItem(values, modal.isNew, modal.data.id);
    const marcouPublicado = clean.estado === "Publicado";
    notify(
      modal.isNew
        ? marcouPublicado ? "Publicação adicionada — o artigo foi marcado como Publicado." : "Publicação adicionada."
        : marcouPublicado ? "Publicação atualizada — o artigo foi marcado como Publicado." : "Publicação atualizada."
    );
    setModal(null);
  }

  return (
    <div>
      <TabHeader
        title="📱 Centro de Conteúdo"
        sub={`${contentItems.length} publicação(ões) planeada(s) ou feita(s)`}
        btnLabel="Nova publicação de artigo"
        onNew={() => setModal({ data: empty(articles, null, false), isNew: true })}
        disabled={articles.length === 0}
        hasActiveFilters={hasActiveFiltersArtigos || onlyUnpublished} onClearFilters={() => { clearAllFiltersArtigos(); clearAllFiltersGerais(); setOnlyUnpublished(false); }}
      />
      {articles.length === 0 && <p className="text-clay-dark text-xs -mt-2 mb-3">Cria primeiro um artigo no catálogo.</p>}
      <label className="flex items-center gap-2 mb-3 text-xs text-stone">
        <input type="checkbox" checked={onlyUnpublished} onChange={(e) => setOnlyUnpublished(e.target.checked)} className="w-3.5 h-3.5" />
        Mostrar só o que ainda não foi publicado (aplica-se às duas secções)
      </label>
      <SearchBox value={qArtigos} onChange={setQArtigos} placeholder="Procurar por SKU, artigo, rede ou observações…" />
      <div className="bg-white border border-line rounded-xl overflow-auto mb-8">
        <table>
          <thead>
            <tr>
              <th>Código</th><FilterTh label="Tipo" {...filterPropsArtigos("tipo")} /><th>Artigo</th><FilterTh label="Estado" {...filterPropsArtigos("estado")} /><FilterTh label="Rede" {...filterPropsArtigos("rede")} />
              <th>Link</th><th>Data de publicação</th><th>Observações</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredArtigos.length === 0 && <EmptyRow span={9} text="Sem conteúdo de artigos registado." />}
            {filteredArtigos.map((c) => {
              const sc = CONTENT_STATUS_COLORS[c.estado] || CONTENT_STATUS_COLORS["Por fotografar"];
              const nc = c.rede ? CONTENT_NETWORK_COLORS[c.rede] : null;
              const tc = c.tipo ? CONTENT_TIPO_COLORS[c.tipo] : null;
              return (
                <tr key={c.id}>
                  <td className="font-mono text-xs text-stone">{c.codigo || "—"}</td>
                  <td>{tc ? <Badge text={c.tipo} color={tc.color} bg={tc.bg} /> : <span className="text-stone">—</span>}</td>
                  <td>
                    <button type="button" onClick={() => onOpenArticle?.(c.article_id)} className="font-medium text-ink underline decoration-line hover:decoration-rust text-left">
                      {(() => { const a = articles.find((x) => x.id === c.article_id); return a && displaySku(a) ? `${displaySku(a)} — ${a.artigo}` : articleName(c.article_id); })()}
                    </button>
                  </td>
                  <td><Badge text={c.estado || "Por fotografar"} color={sc.color} bg={sc.bg} /></td>
                  <td>{nc ? <Badge text={c.rede} color={nc.color} bg={nc.bg} /> : <span className="text-stone">— por definir —</span>}</td>
                  <td className="text-xs">
                    {c.link ? (
                      <a href={c.link} target="_blank" rel="noreferrer" className="text-purple-600 underline">Abrir ↗</a>
                    ) : (
                      <span className="text-stone">—</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-stone">{c.data_publicacao ? fmtDate(c.data_publicacao) : "—"}</td>
                  <td className="text-stone max-w-[220px]" title={c.observacoes}>{c.observacoes || "—"}</td>
                  <RowActions onEdit={() => setModal({ data: { ...c, isGeneral: false }, isNew: false })} onDelete={() => handleDelete(c)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TabHeader
        title="🗂️ Conteúdo Geral"
        sub="Publicações sem artigo associado — novidades, bastidores, promoções, etc."
        btnLabel="Novo conteúdo geral"
        onNew={() => setModal({ data: empty(articles, null, true), isNew: true })}
        hasActiveFilters={hasActiveFiltersGerais || onlyUnpublished} onClearFilters={() => { clearAllFiltersArtigos(); clearAllFiltersGerais(); setOnlyUnpublished(false); }}
      />
      <SearchBox value={qGeral} onChange={setQGeral} placeholder="Procurar por título, rede ou observações…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Código</th><FilterTh label="Tipo" {...filterPropsGerais("tipo")} /><th>Título</th><FilterTh label="Estado" {...filterPropsGerais("estado")} /><FilterTh label="Rede" {...filterPropsGerais("rede")} />
              <th>Pasta OneDrive</th><th>Link</th><th>Data de publicação</th><th>Observações</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredGerais.length === 0 && <EmptyRow span={10} text="Sem conteúdo geral registado." />}
            {filteredGerais.map((c) => {
              const sc = CONTENT_STATUS_COLORS[c.estado] || CONTENT_STATUS_COLORS["Por fotografar"];
              const nc = c.rede ? CONTENT_NETWORK_COLORS[c.rede] : null;
              const tc = c.tipo ? CONTENT_TIPO_COLORS[c.tipo] : null;
              return (
                <tr key={c.id}>
                  <td className="font-mono text-xs text-stone">{c.codigo || "—"}</td>
                  <td>{tc ? <Badge text={c.tipo} color={tc.color} bg={tc.bg} /> : <span className="text-stone">—</span>}</td>
                  <td className="font-medium">{c.titulo || "(sem título)"}</td>
                  <td><Badge text={c.estado || "Por fotografar"} color={sc.color} bg={sc.bg} /></td>
                  <td>{nc ? <Badge text={c.rede} color={nc.color} bg={nc.bg} /> : <span className="text-stone">— por definir —</span>}</td>
                  <td className="text-xs">
                    {c.link_onedrive ? (
                      <a href={c.link_onedrive} target="_blank" rel="noreferrer" className="text-purple-600 underline">📁 Abrir ↗</a>
                    ) : (
                      <span className="text-stone">—</span>
                    )}
                  </td>
                  <td className="text-xs">
                    {c.link ? (
                      <a href={c.link} target="_blank" rel="noreferrer" className="text-purple-600 underline">Abrir ↗</a>
                    ) : (
                      <span className="text-stone">—</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-stone">{c.data_publicacao ? fmtDate(c.data_publicacao) : "—"}</td>
                  <td className="text-stone max-w-[220px]" title={c.observacoes}>{c.observacoes || "—"}</td>
                  <RowActions onEdit={() => setModal({ data: { ...c, isGeneral: true }, isNew: false })} onDelete={() => handleDelete(c)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ContentModal
          data={modal.data}
          isNew={modal.isNew}
          articles={articles}
          contentItems={contentItems}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export function ContentModal({ data, isNew, articles, contentItems, onClose, onSave }) {
  const tipoInicial = data.tipo || CONTENT_TIPOS[0];
  const isGeneral = !!data.isGeneral;
  const [f, setF] = useState({ ...data, tipo: tipoInicial, codigo: data.codigo || (isNew ? sugerirCodigoPorData(CONTENT_TIPO_PREFIXO[tipoInicial], data.data_publicacao, contentItems, "codigo", data.id) : "") });
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function mudarTipo(e) {
    const novoTipo = e.target.value;
    setF((prev) => ({
      ...prev, tipo: novoTipo,
      codigo: isNew ? sugerirCodigoPorData(CONTENT_TIPO_PREFIXO[novoTipo], prev.data_publicacao, contentItems, "codigo", prev.id) : prev.codigo,
    }));
  }

  return (
    <ModalShell
      title={isNew ? (isGeneral ? "Novo conteúdo geral" : "Nova publicação de artigo") : "Editar publicação"}
      subtitle={isGeneral ? "Conteúdo sem artigo associado — novidades, bastidores, promoções, etc." : 'Quando o Estado for "Publicado", o artigo é marcado automaticamente como "Publicado nas redes sociais".'}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Tipo de publicação">
          <select className={inputCls} value={f.tipo} onChange={mudarTipo}>{CONTENT_TIPOS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="Código (único, tipo SKU)">
          <div className="flex gap-1.5">
            <input className={`${inputCls} font-mono`} value={f.codigo} onChange={set("codigo")} placeholder={`ex: ${CONTENT_TIPO_PREFIXO[f.tipo]}-20260815`} />
            <Button type="button" onClick={() => setF({ ...f, codigo: sugerirCodigoPorData(CONTENT_TIPO_PREFIXO[f.tipo], f.data_publicacao, contentItems, "codigo", f.id) })}>🔄</Button>
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {isGeneral ? (
          <Field label="Título" span>
            <input className={inputCls} value={f.titulo || ""} onChange={set("titulo")} placeholder="ex: Promoção de verão" />
          </Field>
        ) : (
          <Field label="Artigo" span>
            <select className={inputCls} value={f.article_id} onChange={set("article_id")}>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.sku ? `${displaySku(a)} · ${a.artigo}` : a.artigo}</option>)}
            </select>
          </Field>
        )}
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Estado">
          <select className={inputCls} value={f.estado} onChange={set("estado")}>{CONTENT_STATUS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="Rede">
          <select className={inputCls} value={f.rede || ""} onChange={set("rede")}>
            <option value="">— por definir —</option>
            {CONTENT_NETWORKS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      {isGeneral && (
        <div className="mb-3">
          <Field label="Link para a pasta do OneDrive" span>
            <input className={inputCls} value={f.link_onedrive || ""} onChange={set("link_onedrive")} placeholder="https://onedrive.live.com/…" />
          </Field>
          <p className="text-stone text-[11px] mt-1">Pasta onde está o material (fotos/vídeo) a publicar — separado do link da publicação já feita, abaixo.</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Link para a publicação"><input className={inputCls} value={f.link || ""} onChange={set("link")} placeholder="https://…" /></Field>
        <Field label="Data da publicação"><input type="date" className={inputCls} value={f.data_publicacao || ""} onChange={set("data_publicacao")} /></Field>
      </div>
      <div className="mb-5">
        <Field label="Observações" span>
          <textarea rows={3} className={inputCls} value={f.observacoes || ""} onChange={set("observacoes")} placeholder='ex.: "publicado às 20h"' />
        </Field>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={async () => {
          if (isGeneral) {
            if (!(f.titulo || "").trim()) { setError("Indica um título para este conteúdo."); return; }
          } else if (!f.article_id) {
            setError("Escolhe um artigo.");
            return;
          }
          const codigo = (f.codigo || "").trim();
          if (!codigo) { setError("Indica um código para a publicação."); return; }
          const duplicado = contentItems.some((c) => c.id !== f.id && (c.codigo || "").trim().toLowerCase() === codigo.toLowerCase());
          if (duplicado) { setError(`Já existe uma publicação com o código "${codigo}" — escolhe outro.`); return; }
          return onSave({ ...f, codigo });
        }}
        label="Guardar"
      />
    </ModalShell>
  );
}
