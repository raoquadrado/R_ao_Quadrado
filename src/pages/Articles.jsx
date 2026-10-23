import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { getTestMode } from "../lib/testMode";
import { OWNERS, opcoesAtivas, nextSkuForCode, DEFAULT_MARGIN_PCT, tagColor, tipoTemTamanho, tipoUsoInterno, tipoEhEtiqueta, tiposAgrupados, ARTICLE_ESTADOS, ARTICLE_ESTADO_COLORS, FAMILIAS_MEDIDAS, ESCOLHAS_SITE, familiaMedidasDoTipo } from "../lib/constants";
import { descarregarCsvShopify } from "../lib/shopifyExport";
import { money, pct, displaySku, todayISO, uid } from "../lib/computations";
import { uploadArticlePhoto, deleteArticlePhoto } from "../lib/photoStorage";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, FavoriteStar, TagBadge, TagSelect, useColumnFilters, FilterTh } from "../components/ui";

function primeiroTipoAtivo(tipos) {
  const ativos = (tipos || []).filter((t) => t.ativo !== false && !t.deleted_at);
  const vendaveis = ativos.filter((t) => t.permite_venda);
  const lista = vendaveis.length ? vendaveis : ativos;
  return [...lista].sort((a, b) => a.peca.localeCompare(b.peca, "pt"))[0]?.peca || "";
}

function emptyArticle(tipos, cores) {
  return {
    sku: "", tipo: primeiroTipoAtivo(tipos), artigo: "", cor: "N/A", padrao: "Liso", tamanho: "",
    owner: "Rosa", preco_unitario: 0, preco_medio: 0, iva: 0,
    quantidade: 0, valor_venda: 0, foto_url: "", publicado: false, etiquetado: false, estado: "Novo — Sem compras",
    favorito: false, etiqueta: "", notas: "",
    composicao: "", cuidados: "", medidas: {}, porque_escolhemos: "", escolha: "", publicar_site: false,
  };
}

export default function Articles({ articlesComputed, articles, tipos, cores, padroes, etiquetaConsumos, contentItems, onViewContent, onOpenDetail, onRegisterPurchase, autoOpenNew, onConsumedAutoOpen, autoOpenEditId, onConsumedAutoOpenEdit, autoDuplicateId, onConsumedAutoDuplicate, autoNewSizeId, onConsumedAutoNewSize, settings }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [etiquetaPicker, setEtiquetaPicker] = useState(null); // { article, candidatos } — a aguardar escolha de qual etiqueta dar baixa
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) { setModal({ data: emptyArticle(tipos, cores), isNew: true }); onConsumedAutoOpen?.(); }
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
        estado: "Novo — Sem compras",
        foto_url: "",
        favorito: false,
        notas: "",
        tamanho: "",
        medidas: {},
        publicar_site: false,
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
        ...rest, // mantém sku, tipo, artigo, cor, preço, iva, valor de venda, etc.
        quantidade: 0,
        publicado: false,
        etiquetado: false,
        estado: "Novo — Sem compras",
        foto_url: "",
        tamanho: "",
        medidas: {}, // as medidas são por tamanho — preenchem-se de novo
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

  // Ao marcar "Peça já etiquetada" num artigo vendável, dá-se baixa de 1 unidade a um
  // artigo do Tipo marcado "eh_etiqueta" (Definições → Tipos de Artigo, ex: "Etiquetas").
  // Havendo mais do que um SKU desse Tipo com stock, pergunta qual usar. Ao desmarcar,
  // devolve a unidade à etiqueta que tinha sido usada.
  async function toggleEtiquetado(a) {
    if (a.uso_interno) { await updateRow("articles", a.id, { etiquetado: !a.etiquetado }); return; }
    if (a.etiquetado) {
      const consumo = etiquetaConsumos?.find((c) => c.article_id === a.id && !c.deleted_at);
      if (consumo) await deleteRow("etiqueta_consumos", consumo.id);
      await updateRow("articles", a.id, { etiquetado: false });
      notify(consumo ? "Etiqueta desmarcada — unidade devolvida ao stock." : "Etiqueta desmarcada.");
      return;
    }
    const candidatos = articlesComputed.filter((x) => x.id !== a.id && tipoEhEtiqueta(x.tipo, tipos) && x.stockAtual > 0);
    if (candidatos.length === 0) {
      await updateRow("articles", a.id, { etiquetado: true });
      notify("Marcado como etiquetado — sem etiquetas em stock para dar baixa.");
    } else if (candidatos.length === 1) {
      await insertRow("etiqueta_consumos", { article_id: a.id, etiqueta_article_id: candidatos[0].id });
      await updateRow("articles", a.id, { etiquetado: true });
      notify(`Etiquetado — deu baixa de 1 unidade em "${candidatos[0].artigo}" (${displaySku(candidatos[0])}).`);
    } else {
      setEtiquetaPicker({ article: a, candidatos });
    }
  }

  async function confirmEtiquetaPicker(etiquetaArticleId) {
    const { article: a, candidatos } = etiquetaPicker;
    const escolhida = candidatos.find((c) => c.id === etiquetaArticleId);
    await insertRow("etiqueta_consumos", { article_id: a.id, etiqueta_article_id: etiquetaArticleId });
    await updateRow("articles", a.id, { etiquetado: true });
    setEtiquetaPicker(null);
    notify(`Etiquetado — deu baixa de 1 unidade em "${escolhida?.artigo}" (${displaySku(escolhida)}).`);
  }

  // Aplica, com um clique, o preço de venda sugerido pela margem-alvo (mesma fórmula do
  // "usar" dentro da ficha do artigo) — sem ser preciso abrir o formulário.
  async function aplicarPrecoSugerido(a) {
    const margemAlvo = settings?.margem_alvo_pct ?? DEFAULT_MARGIN_PCT;
    const custoComIVA = (Number(a.preco_unitario) || 0) * (1 + (Number(a.iva) || 0) / 100);
    if (custoComIVA <= 0 || margemAlvo >= 100) { notify("Falta o preço de compra para calcular a sugestão.", "error"); return; }
    const sugestao = Number((custoComIVA / (1 - margemAlvo / 100)).toFixed(2));
    await updateRow("articles", a.id, { valor_venda: sugestao });
    notify(`Preço de venda aplicado: ${money(sugestao)} (margem-alvo ${margemAlvo}%).`);
  }

  function exportarShopify() {
    const r = descarregarCsvShopify(articlesComputed, tipos);
    if (r.nProdutos === 0) { notify("Nenhum artigo marcado com “Publicar no site”. Marca-o na ficha do artigo.", "error"); return; }
    const av = [];
    if (r.avisos.semPreco.length) av.push(`${r.avisos.semPreco.length} sem preço`);
    if (r.avisos.semFoto.length) av.push(`${r.avisos.semFoto.length} sem foto`);
    if (r.avisos.semComposicao.length) av.push(`${r.avisos.semComposicao.length} sem composição`);
    if (r.avisos.semMedidas.length) av.push(`${r.avisos.semMedidas.length} sem medidas`);
    notify(`CSV Shopify gerado: ${r.nProdutos} produto(s), ${r.nVariantes} variante(s).${av.length ? " Atenção: " + av.join(", ") + "." : ""}`);
  }

  const rows = articlesComputed
    .filter((a) => (a.sku + a.artigo + a.cor + (a.padrao || "") + (a.tipo || "")).toLowerCase().includes(q.toLowerCase()));

  const filterCols = {
    etiqueta: (a) => (a.etiqueta ? (tagColor(a.etiqueta)?.label || a.etiqueta) : "Sem etiqueta"),
    tipo: (a) => a.tipo || "—",
    tamanho: (a) => a.tamanho || "Sem tamanho",
    cor: (a) => a.cor || "—",
    padrao: (a) => a.padrao || "Liso",
    owner: (a) => a.owner || "—",
    publicado: (a) => (a.publicado ? "Sim" : "Não"),
    etiquetado: (a) => (a.etiquetado ? "Sim" : "Não"),
    interno: (a) => (a.uso_interno ? "Sim" : "Não"),
    estado: (a) => a.estado || "Em stock",
    venda: (a) => (Number(a.valor_venda) > 0 ? "Com preço" : "Sem preço"),
    escolha: (a) => a.escolha || "Sem escolha",
    site: (a) => (a.publicar_site ? "Sim" : "Não"),
  };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(
    articlesComputed, filterCols,
    { estado: new Set(["A aguardar validação", "Novo — Sem compras", "Em stock", "Esgotado — vai repor"]), interno: new Set(["Não"]) }
  );
  const filteredRows = applyFilters(rows).sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0));

  return (
    <div>
      <TabHeader
        title="Artigos & Stock"
        sub={`${articles.length} artigo(s) no catálogo`}
        btnLabel="Novo artigo"
        onNew={() => setModal({ data: emptyArticle(tipos, cores), isNew: true })}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
        extra={<Button variant="default" onClick={exportarShopify} title="Gera o CSV de importação do Shopify com os artigos marcados 'Publicar no site'">🛍️ Exportar para Shopify</Button>}
      />
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por SKU, tipo, artigo, cor ou padrão…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th></th><th>Foto</th><th>SKU</th><FilterTh label="Tipo" {...filterProps("tipo")} /><th>Artigo</th>
              <FilterTh label="Tamanho" {...filterProps("tamanho")} />
              <FilterTh label="Etiqueta" {...filterProps("etiqueta")} /><FilterTh label="Cor" {...filterProps("cor")} /><FilterTh label="Padrão" {...filterProps("padrao")} />
              <FilterTh label="Owner" {...filterProps("owner")} /><FilterTh label="Interno" {...filterProps("interno")} />
              <th>Preço un.</th><th>Preço médio</th><th>IVA</th><th>Qtd</th><FilterTh label="Venda" {...filterProps("venda")} /><th>Margem</th><th>Stock atual</th><th>Valor stock</th>
              <FilterTh label="Publicado" {...filterProps("publicado")} /><FilterTh label="Escolha" {...filterProps("escolha")} /><FilterTh label="No site" {...filterProps("site")} /><FilterTh label="Etiquetado" {...filterProps("etiquetado")} /><FilterTh label="Estado" {...filterProps("estado")} /><th>Conteúdo</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={24} text="Sem artigos." />}
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
                <td className="text-stone">{a.padrao || "Liso"}</td>
                <td><Badge text={a.owner} color={a.owner === "Rosa" ? "#832F72" : "#A67C1E"} bg={a.owner === "Rosa" ? "#F7E3F2" : "#F5EADD"} /></td>
                <td>{a.uso_interno ? <span title="Material interno — não é vendido" className="text-lg leading-none">📦</span> : <span className="text-stone">—</span>}</td>
                <td className="font-mono text-xs">{money(a.preco_unitario)}</td>
                <td className="font-mono text-xs text-stone">{money(a.preco_medio)}</td>
                <td className="font-mono text-xs">{pct(a.iva)}</td>
                <td className="font-mono">{a.quantidade}</td>
                <td className="font-mono text-xs">
                  {Number(a.valor_venda) > 0 ? money(a.valor_venda) : (
                    <button type="button" onClick={() => aplicarPrecoSugerido(a)} title="Aplicar preço sugerido pela margem-alvo" className="text-purple-600 underline">
                      ✨ aplicar
                    </button>
                  )}
                </td>
                <td className={`font-mono text-xs ${a.margemUnit >= 0 ? "text-sage-dark" : "text-clay-dark"}`}>{money(a.margemUnit)} · {pct(a.margemPct)}</td>
                <td className={`font-mono font-medium ${a.stockAtual <= 3 ? "text-clay-dark" : ""}`}>{a.stockAtual}</td>
                <td className="font-mono text-xs">{money(a.valorStockSemIVA)}</td>
                <td>{a.publicado ? <span className="text-sage-dark">✓ Sim</span> : <span className="text-stone">Não</span>}</td>
                <td className="text-xs">{a.escolha ? (a.escolha === "Das duas" ? "💜 Das duas" : `Da ${a.escolha}`) : <span className="text-stone">—</span>}</td>
                <td>{a.publicar_site ? <span className="text-sage-dark">🌐 Sim</span> : <span className="text-stone">Não</span>}</td>
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
                  onNewSize={tipoTemTamanho(a.tipo, tipos) ? () => newSizeVariant(a) : undefined}
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
          tipos={tipos}
          cores={cores}
          padroes={padroes}
          onClose={() => setModal(null)}
          onDuplicate={duplicateArticle}
          onNewSize={newSizeVariant}
          onViewContent={(articleId) => { setModal(null); onViewContent?.(articleId); }}
          onRegisterPurchase={onRegisterPurchase ? (articleId) => { setModal(null); onRegisterPurchase(articleId); } : undefined}
          contentCount={modal.isNew ? 0 : (contentItems?.filter((c) => c.article_id === modal.data.id).length || 0)}
          margemAlvoDefeito={settings?.margem_alvo_pct ?? DEFAULT_MARGIN_PCT}
          onSave={async (values, isNewArticle) => {
            let final = { ...values, uso_interno: tipoUsoInterno(values.tipo, tipos) };
            const precisaGerarSku = !final.sku && String(final.tipo || "").trim() && !modal.isNewSize;
            if ((isNewArticle && !modal.isNewSize) || precisaGerarSku) {
              const tipoEntry = (tipos || []).find((t) => t.peca === final.tipo);
              if (!tipoEntry) { alert("Escolhe um Tipo válido antes de guardar."); return; }
              const { data: sku, error } = await supabase.rpc("next_sku", { p_code: tipoEntry.codigo });
              if (error) { alert("Não foi possível gerar o SKU: " + error.message); return; }
              final = { ...final, sku };
            }
            // Validar um artigo criado rapidamente numa compra (estado "A aguardar validação"):
            // a validação conclui-se exatamente quando o SKU fica preenchido (o que já exige um
            // Tipo escolhido) — nesse momento sai desse estado e passa para o automático: "Em
            // stock" se já tiver stock (de uma compra entretanto concluída) ou "Novo — Sem
            // compras" caso contrário.
            if (final.estado === "A aguardar validação" && final.sku) {
              const computado = articlesComputed.find((a) => a.id === modal.data.id);
              final = { ...final, estado: (computado?.stockAtual > 0) ? "Em stock" : "Novo — Sem compras" };
            }
            // Marcar/desmarcar "Peça já etiquetada" aqui no formulário faz a mesma baixa/devolução
            // de stock de etiqueta que o pisco da tabela. Havendo mais do que uma etiqueta com
            // stock, escolhe-se aqui a de maior stock automaticamente (para escolher uma em
            // concreto, usa o pisco da tabela, que pergunta).
            if (!isNewArticle && !final.uso_interno && !!final.etiquetado !== !!modal.data.etiquetado) {
              if (!final.etiquetado) {
                const consumo = etiquetaConsumos?.find((c) => c.article_id === modal.data.id && !c.deleted_at);
                if (consumo) await deleteRow("etiqueta_consumos", consumo.id);
              } else {
                const candidatos = articlesComputed
                  .filter((x) => x.id !== modal.data.id && tipoEhEtiqueta(x.tipo, tipos) && x.stockAtual > 0)
                  .sort((x, y) => y.stockAtual - x.stockAtual);
                if (candidatos[0]) await insertRow("etiqueta_consumos", { article_id: modal.data.id, etiqueta_article_id: candidatos[0].id });
              }
            }
            if (isNewArticle) await insertRow("articles", final);
            else await updateRow("articles", modal.data.id, final);
            notify(isNewArticle ? `Artigo adicionado (${displaySku(final)}).` : "Artigo atualizado.");
            setModal(null);
          }}
        />
      )}
      {etiquetaPicker && (
        <EtiquetaPickerModal
          article={etiquetaPicker.article}
          candidatos={etiquetaPicker.candidatos}
          onClose={() => setEtiquetaPicker(null)}
          onConfirm={confirmEtiquetaPicker}
        />
      )}
    </div>
  );
}

function ArticleModal({ data, isNew, isNewSize, articles, tipos, cores, padroes, onClose, onSave, onDuplicate, onNewSize, onViewContent, onRegisterPurchase, contentCount, margemAlvoDefeito }) {
  const [f, setF] = useState(data);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [margemAlvo, setMargemAlvo] = useState(margemAlvoDefeito ?? DEFAULT_MARGIN_PCT);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setNum = (k) => (e) => setF({ ...f, [k]: parseFloat(e.target.value) || 0 });
  const grupos = tiposAgrupados(tipos);
  const tipoEntry = (tipos || []).find((t) => t.peca === f.tipo) || null;
  const temTamanho = tipoTemTamanho(f.tipo, tipos);
  const skuBase = isNew && !isNewSize && tipoEntry ? nextSkuForCode(tipoEntry.codigo, articles) : f.sku;
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
      title={isNewSize ? "Novo tamanho" : isNew ? "Novo artigo" : (f.estado === "A aguardar validação" ? "Completar artigo (criado numa compra)" : "Editar artigo")}
      subtitle={isNewSize ? "Os restantes dados ficam iguais ao artigo original — só o Tamanho (e quantidade/foto) podem mudar." : "SKU, stock atual, margens e valores totais calculam-se automaticamente."}
      onClose={onClose}
    >
      {f.estado === "A aguardar validação" && (
        <p className="text-[11px] text-white bg-[#B34700] rounded-md px-2.5 py-1.5 -mt-1 mb-3">
          🧩 Este artigo foi criado rapidamente a partir de uma compra, só com descrição, quantidade e custo. Escolhe o Tipo para o validar — ao guardar, o SKU é gerado, sai de "A aguardar validação" e passa a "Em stock" ou "Novo — Sem compras", conforme já tenha ou não stock.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Tipo">
          <select className={isNewSize ? lockedCls : inputCls} value={f.tipo} onChange={set("tipo")} disabled={isNewSize}>
            {!f.tipo && <option value="">— por definir —</option>}
            {grupos.length === 0 && <option value="" disabled>Sem Tipos definidos — cria em Definições</option>}
            {grupos.map(({ grupo, pecas }) => (
              <optgroup label={grupo} key={grupo}>
                {pecas.map((t) => <option key={t.id} value={t.peca}>{t.peca}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="SKU"><input className={lockedCls} value={skuPreview || "— gerado ao guardar —"} disabled /></Field>
      </div>
      {tipoUsoInterno(f.tipo, tipos) && (
        <p className="text-[11px] text-white bg-[#4A2A85] rounded-md px-2.5 py-1.5 -mt-1.5 mb-3">
          📦 Material interno — este tipo não é vendido a clientes, serve só para controlar o stock desse material de apoio ao negócio (o pisco "Material interno" marca-se sozinho). Ajustável em Definições → Tipos de Artigo.
        </p>
      )}
      {temTamanho && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Tamanho">
            <input className={inputCls} value={f.tamanho || ""} onChange={set("tamanho")} placeholder="ex: M, 42, 90cm…" autoFocus={isNewSize} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Artigo"><input className={isNewSize ? lockedCls : inputCls} value={f.artigo} onChange={set("artigo")} disabled={isNewSize} /></Field>
        <Field label="Cor">
          <select className={isNewSize ? lockedCls : inputCls} value={f.cor} onChange={set("cor")} disabled={isNewSize}>
            {!f.cor && <option value="">— por definir —</option>}
            {opcoesAtivas(cores).map((c) => <option key={c.id} value={c.valor}>{c.valor}</option>)}
          </select>
        </Field>
        <Field label="Padrão">
          <select className={isNewSize ? lockedCls : inputCls} value={f.padrao || "Liso"} onChange={set("padrao")} disabled={isNewSize}>
            {opcoesAtivas(padroes).map((p) => <option key={p.id} value={p.valor}>{p.valor}</option>)}
          </select>
        </Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Owner">
          <select className={isNewSize ? lockedCls : inputCls} value={f.owner} onChange={set("owner")} disabled={isNewSize}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Preço unitário (€, s/IVA) — valor da última compra">
          <input className={lockedCls} value={isNew && !isNewSize ? "0,00 € — definido na 1ª compra" : money(f.preco_unitario)} disabled />
        </Field>
        <Field label="Preço médio (€, s/IVA) — média das compras">
          <input className={lockedCls} value={isNew && !isNewSize ? "0,00 € — definido na 1ª compra" : money(f.preco_medio)} disabled />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="IVA (%)"><input type="number" step="1" min="0" className={isNewSize ? lockedCls : inputCls} value={f.iva} onChange={setNum("iva")} disabled={isNewSize} /></Field>
        <Field label="Quantidade adquirida (total, todas as compras)">
          <input className={lockedCls} value={f.quantidade} disabled />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Valor de venda (€, unidade)"><input type="number" step="0.01" min="0" className={isNewSize ? lockedCls : inputCls} value={f.valor_venda} onChange={setNum("valor_venda")} disabled={isNewSize} /></Field>
      </div>
      <p className="text-stone text-[11px] -mt-1.5 mb-3">
        O preço unitário, o preço médio e a quantidade adquirida atualizam-se sozinhos quando uma compra deste artigo ficar "Concluída" — nunca se editam aqui diretamente.
        {!isNew && onRegisterPurchase && (
          <> <button type="button" onClick={() => onRegisterPurchase(f.id)} className="text-purple-600 font-medium underline">+ Registar compra deste artigo</button></>
        )}
      </p>
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
      {!tipoUsoInterno(f.tipo, tipos) && (
        <div className="mb-3 flex items-center gap-2">
          <input type="checkbox" id="publicado" checked={!!f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} className="w-4 h-4" />
          <label htmlFor="publicado" className="text-sm text-ink">Publicado nas redes sociais</label>
        </div>
      )}
      {!tipoUsoInterno(f.tipo, tipos) && (
        <div className="mb-3 flex items-center gap-2">
          <input type="checkbox" id="etiquetado" checked={!!f.etiquetado} onChange={(e) => setF({ ...f, etiquetado: e.target.checked })} className="w-4 h-4" />
          <label htmlFor="etiquetado" className="text-sm text-ink">🏷️ Peça já etiquetada (etiqueta física colocada)</label>
        </div>
      )}
      <div className="mb-3">
        <Field label="Estado do artigo">
          <select className={inputCls} value={f.estado || "Em stock"} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            {ARTICLE_ESTADOS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </Field>
        <p className="text-stone text-[11px] mt-1">"Novo — Sem compras" é o estado inicial de todo o artigo novo — passa sozinho a "Em stock" assim que uma compra deste artigo ficar "Concluída" (é aí que a quantidade entra no stock, nunca antes). "Em stock" e "Esgotado — vai repor" alternam sozinhos consoante o stock atual (não precisas de mudar à mão). "Sem Reposição" e "Pausado" deixam de aparecer nos alertas de stock esgotado/baixo do Painel — úteis para peças que já sabes que não vais repor ou que estão temporariamente fora de venda.</p>
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
      {!tipoUsoInterno(f.tipo, tipos) && (
        <FichaSite f={f} setF={setF} set={set} tipos={tipos} isNewSize={isNewSize} temTamanho={temTamanho} />
      )}
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
            {!isNewSize && tipoTemTamanho(f.tipo, tipos) && (
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

function EtiquetaPickerModal({ article, candidatos, onClose, onConfirm }) {
  const [escolhida, setEscolhida] = useState(candidatos[0]?.id || "");
  return (
    <ModalShell title="Escolher etiqueta a dar baixa" onClose={onClose}>
      <p className="text-stone text-sm mb-3">
        Há mais do que uma etiqueta com stock — escolhe a que vais colocar em "{article.artigo}":
      </p>
      <div className="mb-4">
        <Field label="Etiqueta (Material Interno)">
          <select className={inputCls} value={escolhida} onChange={(e) => setEscolhida(e.target.value)}>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>{displaySku(c)} · {c.artigo} — {c.stockAtual} em stock</option>
            ))}
          </select>
        </Field>
      </div>
      <ModalActions onClose={onClose} onSave={() => onConfirm(escolhida)} label="Confirmar" />
    </ModalShell>
  );
}


// Ficha do artigo para o site (Shopify): composição, cuidados, medidas por tamanho, "Porque a escolhemos",
// "Escolha" e "Publicar no site". As medidas são por tamanho (cada tamanho é uma linha de artigo).
function FichaSite({ f, setF, set, tipos, isNewSize, temTamanho }) {
  const familia = familiaMedidasDoTipo(f.tipo, tipos);
  const fam = FAMILIAS_MEDIDAS[familia];
  const medidas = f.medidas || {};
  const setMedida = (k) => (e) => setF({ ...f, medidas: { ...medidas, [k]: e.target.value } });
  return (
    <div className="mb-4 border border-line rounded-lg p-3 bg-purple-50">
      <p className="text-xs font-semibold text-ink mb-2">🌐 Ficha para o site</p>
      <div className="mb-3 flex items-center gap-2">
        <input type="checkbox" id="publicar_site" checked={!!f.publicar_site} onChange={(e) => setF({ ...f, publicar_site: e.target.checked })} className="w-4 h-4" />
        <label htmlFor="publicar_site" className="text-sm text-ink">Publicar no site (entra na exportação para o Shopify)</label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Escolha">
          <select className={isNewSize ? `${inputCls} bg-line/40 text-stone` : inputCls} value={f.escolha || ""} onChange={set("escolha")} disabled={isNewSize}>
            <option value="">— sem escolha —</option>
            {ESCOLHAS_SITE.map((e) => <option key={e} value={e}>{e === "Das duas" ? "Das duas" : `Da ${e}`}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Composição"><textarea rows={2} className={inputCls} value={f.composicao || ""} onChange={set("composicao")} placeholder="ex: 95% algodão, 5% elastano" /></Field>
        <Field label="Cuidados de lavagem"><textarea rows={2} className={inputCls} value={f.cuidados || ""} onChange={set("cuidados")} placeholder="ex: Lavar a 30°C. Não usar lixívia. Passar a ferro a baixa temperatura." /></Field>
      </div>
      <div className="mb-3">
        <Field label="Porque a escolhemos" span><textarea rows={3} className={inputCls} value={f.porque_escolhemos || ""} onChange={set("porque_escolhemos")} placeholder="Texto curto para o site: o que tem de especial, com que looks combina…" /></Field>
      </div>
      {fam ? (
        <div>
          <p className="text-[11px] text-stone mb-1.5">Medidas em cm — {fam.label}{temTamanho && f.tamanho ? ` · tamanho ${f.tamanho}` : ""}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {fam.campos.map(([k, label]) => (
              <Field key={k} label={label}>
                <input type="number" step="0.1" min="0" className={inputCls} value={medidas[k] ?? ""} onChange={setMedida(k)} />
              </Field>
            ))}
          </div>
          {temTamanho && <p className="text-[11px] text-stone mt-1.5">As medidas são por tamanho: cada tamanho tem a sua ficha. Usa “📏 Novo tamanho” para preencher os outros.</p>}
        </div>
      ) : (
        <p className="text-[11px] text-stone">Sem medidas para este tipo de peça — escolhe a família de medidas em Definições → Tipos de Artigo.</p>
      )}
    </div>
  );
}
