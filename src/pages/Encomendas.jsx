import { useState } from "react";
import { supabase } from "../supabaseClient";
import { updateRow, useAuditLogForRecord } from "../lib/useRealtimeTable";
import { getTestMode } from "../lib/testMode";
import { SHIPPING_STATUS } from "../lib/constants";
import { money, fmtDate, todayISO, sugerirCodigoPorData, displaySku } from "../lib/computations";
import { uploadDocument, deleteDocument } from "../lib/fileStorage";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, Card, ModalShell, ModalActions, EmptyRow, inputCls } from "../components/ui";

const shippingColorDetail = (estado) => {
  if (estado === "Enviado" || estado === "Entregue em mãos") return { color: "#254238", bg: "#DCEBE4" };
  if (estado === "Preparado") return { color: "#832F72", bg: "#F7E3F2" };
  if (estado === "Em Preparação") return { color: "#A67C1E", bg: "#F5EADD" };
  return { color: "#8A8677", bg: "#F1EDE3" };
};

// Ficha completa da Encomenda — equivalente à Ficha do Artigo (secção 6): cliente e os seus
// dados, vendas incluídas com valores, e quanto se gastou em embalamento e em etiquetas.
export function EncomendaDetail({ encomendaId, encomendas, sales, clients, articlesComputed, embalagens, embalagemItens, embalagemConsumos, etiquetaConsumos, articleName, clientName, onBack, onEdit, onOpenClient, onOpenSale, onOpenArticle }) {
  const e = encomendas.find((x) => x.id === encomendaId);
  const { rows: history } = useAuditLogForRecord("encomendas", encomendaId);

  if (!e) {
    return (
      <div>
        <button onClick={onBack} className="text-sm text-stone underline mb-4">← Voltar às vendas</button>
        <p className="text-stone">Esta encomenda já não existe (foi eliminada).</p>
      </div>
    );
  }

  const cliente = clients.find((c) => c.id === e.client_id);
  const vendasEncomenda = sales.filter((s) => s.encomenda_id === e.id).sort((x, y) => (y.data || "").localeCompare(x.data || ""));
  const totalVendas = vendasEncomenda.reduce((s, v) => s + Number(v.valor_venda || 0), 0);
  const embalagemEscolhida = embalagens?.find((emb) => emb.id === e.embalagem_id);
  const itensEmbalagem = (embalagemItens || []).filter((it) => it.embalagem_id === e.embalagem_id);

  const consumosEmbalagem = (embalagemConsumos || []).filter((c) => c.encomenda_id === e.id && !c.deleted_at);
  const custoEmbalagem = consumosEmbalagem.reduce((s, c) => {
    const artigo = articlesComputed.find((a) => a.id === c.article_id);
    return s + Number(c.quantidade || 0) * Number(artigo?.preco_unitario || 0);
  }, 0);

  // O "etiquetado" vive no Artigo, não na Venda — a etiqueta usada por cada venda desta
  // encomenda é a do consumo ativo do artigo vendido (aproximação razoável: atribui-se o
  // custo da etiqueta à encomenda que acaba por expedir essa peça).
  const custoEtiquetas = vendasEncomenda.reduce((s, v) => {
    const consumo = (etiquetaConsumos || []).find((c) => c.article_id === v.article_id && !c.deleted_at);
    if (!consumo) return s;
    const etiquetaArtigo = articlesComputed.find((a) => a.id === consumo.etiqueta_article_id);
    return s + Number(etiquetaArtigo?.preco_unitario || 0);
  }, 0);

  const custoTotal = custoEmbalagem + custoEtiquetas;
  const sc = shippingColorDetail(e.estado_envio);

  return (
    <div>
      <button onClick={onBack} className="text-sm text-stone underline mb-4">← Voltar às vendas</button>

      {/* Cabeçalho */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <h1 className="font-display text-2xl font-semibold">{e.codigo || "Encomenda"}</h1>
            <p className="text-stone text-sm mt-0.5">
              {cliente ? (
                <button onClick={() => onOpenClient?.(cliente.id)} className="text-ink underline decoration-line hover:decoration-rust">{cliente.nome}</button>
              ) : "Cliente removido"}
            </p>
          </div>
          <button onClick={() => onEdit(e)} className="text-xs font-medium bg-white border border-line rounded px-3 py-1.5 text-ink">Editar</button>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          <Badge text={e.estado_envio || "Não Definido"} color={sc.color} bg={sc.bg} />
          {e.metodo_envio && <Badge text={`${e.metodo_envio}${e.valor_portes ? ` · ${money(e.valor_portes)}` : ""}`} color="#8A8677" bg="#F1EDE3" />}
          {e.codigo_envio && <Badge text={`📮 ${e.codigo_envio}`} color="#8A8677" bg="#F1EDE3" />}
          {embalagemEscolhida && <Badge text={`📦 ${embalagemEscolhida.nome}`} color="#832F72" bg="#F7E3F2" />}
        </div>
      </div>

      {/* Dados do cliente */}
      {cliente && (
        <div className="bg-white border border-line rounded-xl p-5 mb-5">
          <h2 className="font-display text-base font-semibold mb-3">Dados do cliente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <p><span className="text-stone">Nome:</span> {cliente.nome}</p>
            <p><span className="text-stone">Telefone:</span> {cliente.telefone || "—"}</p>
            <p><span className="text-stone">NIF:</span> {cliente.nif || "—"}</p>
            <p><span className="text-stone">Email:</span> {cliente.email || "—"}</p>
            <p className="sm:col-span-2"><span className="text-stone">Morada de entrega:</span> {cliente.morada_entrega || "—"}</p>
            <p className="sm:col-span-2"><span className="text-stone">Morada de faturação:</span> {cliente.morada_faturacao || "—"}</p>
          </div>
          <button onClick={() => onOpenClient?.(cliente.id)} className="text-xs font-medium text-purple-600 underline mt-3">Ver ficha completa do cliente →</button>
        </div>
      )}

      {/* KPIs de custo */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Card label="Total de vendas" value={money(totalVendas)} color="#1C2541" />
        <Card label="Valor de portes" value={money(e.valor_portes)} color="#254238" />
        <Card label="Gasto em embalamento" value={money(custoEmbalagem)} color="#832F72" />
        <Card label="Gasto em etiquetas" value={money(custoEtiquetas)} color="#832F72" />
        <Card label="Custo total (embalamento + etiquetas)" value={money(custoTotal)} color="#7A2A24" />
      </div>

      {/* Vendas incluídas */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <h2 className="font-display text-base font-semibold mb-3">Vendas incluídas ({vendasEncomenda.length})</h2>
        <div className="overflow-auto">
          <table>
            <thead><tr><th>Código</th><th>Data</th><th>Artigo</th><th>Qtd</th><th>Vendeu</th><th>Pagamento</th><th>Valor</th></tr></thead>
            <tbody>
              {vendasEncomenda.length === 0 && <EmptyRow span={7} text="Sem vendas nesta encomenda." />}
              {vendasEncomenda.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-stone">{s.codigo || "—"}</td>
                  <td className="font-mono text-xs text-stone">{fmtDate(s.data)}</td>
                  <td>
                    <button onClick={() => onOpenSale ? onOpenSale(s.id) : onOpenArticle?.(s.article_id)} className="text-ink underline decoration-line">
                      {articleName(s.article_id)}
                    </button>
                  </td>
                  <td className="font-mono">{s.quantidade}</td>
                  <td>{s.quem_vendeu ? <Badge text={s.quem_vendeu} color={s.quem_vendeu === "Rosa" ? "#832F72" : "#A67C1E"} bg={s.quem_vendeu === "Rosa" ? "#F7E3F2" : "#F5EADD"} /> : "—"}</td>
                  <td>{s.estado}</td>
                  <td className="font-mono font-medium text-rust-dark">{money(s.valor_venda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Embalagem */}
      {embalagemEscolhida && (
        <div className="bg-white border border-line rounded-xl p-5 mb-5">
          <h2 className="font-display text-base font-semibold mb-3">Embalagem: {embalagemEscolhida.nome}</h2>
          <div className="overflow-auto">
            <table>
              <thead><tr><th>Artigo</th><th>Quantidade consumida</th><th>Custo</th></tr></thead>
              <tbody>
                {consumosEmbalagem.length === 0 && <EmptyRow span={3} text="Sem consumo registado." />}
                {consumosEmbalagem.map((c) => {
                  const artigo = articlesComputed.find((a) => a.id === c.article_id);
                  return (
                    <tr key={c.id}>
                      <td>{artigo ? <button onClick={() => onOpenArticle?.(artigo.id)} className="text-ink underline decoration-line">{displaySku(artigo)} · {artigo.artigo}</button> : "artigo removido"}</td>
                      <td className="font-mono">{c.quantidade}</td>
                      <td className="font-mono">{money(Number(c.quantidade || 0) * Number(artigo?.preco_unitario || 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Faturas */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <h2 className="font-display text-base font-semibold mb-3">Faturas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-plum mb-1">Rosa</p>
            <p>{e.fatura_rosa || "por emitir"} {e.fatura_rosa_url && <a href={e.fatura_rosa_url} target="_blank" rel="noreferrer" className="text-purple-600 underline ml-2">ver anexo</a>}</p>
          </div>
          <div>
            <p className="font-medium text-rust-dark mb-1">Rita</p>
            <p>{e.fatura_rita || "por emitir"} {e.fatura_rita_url && <a href={e.fatura_rita_url} target="_blank" rel="noreferrer" className="text-purple-600 underline ml-2">ver anexo</a>}</p>
          </div>
        </div>
      </div>

      {e.notas && (
        <div className="bg-white border border-line rounded-xl p-5 mb-5">
          <h2 className="font-display text-base font-semibold mb-2">Notas</h2>
          <p className="text-sm text-ink whitespace-pre-wrap">{e.notas}</p>
        </div>
      )}

      {/* Histórico */}
      {history?.length > 0 && (
        <div className="bg-white border border-line rounded-xl p-5">
          <h2 className="font-display text-base font-semibold mb-3">Histórico de alterações</h2>
          <div className="flex flex-col gap-1.5 text-xs text-stone">
            {history.slice(0, 10).map((h) => (
              <p key={h.id}>{fmtDate(h.created_at)} — {h.action === "insert" ? "criada" : h.action === "delete" ? "eliminada" : "editada"}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Formulário de Encomenda — usado a partir de Vendas, tanto para gerar uma nova (a partir
// de vendas selecionadas) como para editar uma já existente (clicando no cabeçalho do
// grupo). Uma Encomenda tem duas Faturas possíveis (Rosa e Rita), para quando as peças de
// uma mesma encomenda precisam de ser faturadas por pessoas diferentes.
export function EncomendaModal({ encomenda, initialSaleIds, fixedClientId, sales, clients, encomendas, embalagens, embalagemItens, metodosEnvio, articlesComputed, clientName, articleName, onOpenSale, onClose, onSaved }) {
  const isNew = !encomenda;
  const clientId = encomenda?.client_id || fixedClientId;
  const [f, setF] = useState(encomenda ? { ...encomenda } : {
    id: undefined,
    codigo: sugerirCodigoPorData("ENC", todayISO(), encomendas, "codigo"),
    client_id: clientId,
    estado_envio: "Não Definido", metodo_envio: "", valor_portes: "", codigo_envio: "", data_envio: "", embalagem_id: "",
    fatura_rosa: "", fatura_rosa_url: "", fatura_rita: "", fatura_rita_url: "", notas: "",
  });
  const [incluidas, setIncluidas] = useState(() => new Set(encomenda ? sales.filter((s) => s.encomenda_id === encomenda.id).map((s) => s.id) : (initialSaleIds || [])));
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState("");
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const notify = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Ao escolher o método, sugere logo o valor de portes definido nesse método em Definições
  // — mas fica sempre editável a seguir, para casos pontuais (ex: um desconto).
  function handleMetodoChange(e) {
    const nome = e.target.value;
    const metodo = (metodosEnvio || []).find((m) => m.nome === nome);
    setF((prev) => ({ ...prev, metodo_envio: nome, valor_portes: metodo ? metodo.valor_portes : prev.valor_portes }));
  }

  const podeAcrescentar = isNew || f.estado_envio === "Em Preparação";
  const vendasJaIncluidas = sales.filter((s) => incluidas.has(s.id));
  const vendasSoltasDoCliente = sales.filter((s) => s.client_id === clientId && !s.encomenda_id && !s.deleted_at && !incluidas.has(s.id));
  const total = vendasJaIncluidas.reduce((s, v) => s + Number(v.valor_venda || 0), 0);

  function toggleIncluida(id) {
    setIncluidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleRemoverJa(saleId) {
    if (isNew) { toggleIncluida(saleId); return; }
    const ok = await confirm({ title: "Remover esta venda da encomenda?", message: "A venda volta a ficar solta, com o Estado de envio \"Não Definido\".", confirmLabel: "Remover" });
    if (!ok) return;
    await updateRow("sales", saleId, { encomenda_id: null, estado_envio: "Não Definido", metodo_envio: "", codigo_envio: "", data_envio: "", fatura: "", fatura_url: "" });
    setIncluidas((prev) => { const next = new Set(prev); next.delete(saleId); return next; });
    notify("Venda removida da encomenda.");
  }

  function handleUpload(faturaField, urlField, folder) {
    return async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingField(urlField);
      setError("");
      try {
        const url = await uploadDocument(file, `encomendas/${f.id || f.codigo}/${folder}`);
        setF((prev) => ({ ...prev, [urlField]: url }));
      } catch (err) {
        setError("Não foi possível enviar o ficheiro: " + (err.message || "erro desconhecido"));
      } finally {
        setUploadingField("");
      }
    };
  }

  async function handleRemoveFatura(urlField) {
    const url = f[urlField];
    setF((prev) => ({ ...prev, [urlField]: "" }));
    await deleteDocument(url);
  }

  async function handleSave() {
    if (!clientId) { setError("Escolhe pelo menos uma venda (o cliente vem daí)."); return; }
    if (vendasJaIncluidas.length === 0) { setError("Escolhe pelo menos uma venda para a encomenda."); return; }
    if (!f.embalagem_id) { setError("Escolhe um Tipo de Embalagem."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("save_encomenda", {
        p_id: f.id || null,
        p_codigo: f.codigo,
        p_client_id: clientId,
        p_estado_envio: f.estado_envio,
        p_metodo_envio: f.metodo_envio || null,
        p_valor_portes: f.valor_portes === "" || f.valor_portes === null || f.valor_portes === undefined ? null : Number(f.valor_portes),
        p_codigo_envio: f.codigo_envio || null,
        p_data_envio: f.data_envio || null,
        p_fatura_rosa: f.fatura_rosa || null,
        p_fatura_rosa_url: f.fatura_rosa_url || null,
        p_fatura_rita: f.fatura_rita || null,
        p_fatura_rita_url: f.fatura_rita_url || null,
        p_embalagem_id: f.embalagem_id,
        p_notas: f.notas || null,
        p_sale_ids: [...incluidas],
        p_is_test: isNew ? getTestMode() : undefined,
      });
      if (rpcError) throw new Error(rpcError.message.replace(/^.*save_encomenda: /, ""));
      onSaved();
    } catch (err) {
      setError(err.message || "Não foi possível guardar a encomenda.");
    } finally {
      setSaving(false);
    }
  }

  const embalagensAtivas = (embalagens || []).filter((e) => e.ativo !== false && !e.deleted_at);
  const itensDaEmbalagemEscolhida = (embalagemItens || []).filter((it) => it.embalagem_id === f.embalagem_id);
  const embalagemMudou = f.embalagem_id && f.embalagem_id !== encomenda?.embalagem_id;

  return (
    <ModalShell title={isNew ? "Gerar encomenda e embalamento" : "Editar encomenda"} subtitle={clientId ? clientName(clientId) : undefined} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Código"><input className={`${inputCls} font-mono`} value={f.codigo} onChange={set("codigo")} /></Field>
        <Field label="Estado de envio">
          <select className={inputCls} value={f.estado_envio} onChange={set("estado_envio")}>{SHIPPING_STATUS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Método de envio">
          <select className={inputCls} value={f.metodo_envio || ""} onChange={handleMetodoChange}>
            <option value="">— por definir —</option>
            {(metodosEnvio || []).filter((m) => m.ativo !== false && !m.deleted_at).map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
          </select>
        </Field>
        <Field label="Valor de portes (€)"><input type="number" min="0" step="0.01" className={inputCls} value={f.valor_portes ?? ""} onChange={set("valor_portes")} /></Field>
        <Field label="Código de rastreio"><input className={inputCls} value={f.codigo_envio || ""} onChange={set("codigo_envio")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Field label="Data de envio"><input type="date" className={inputCls} value={f.data_envio || ""} onChange={set("data_envio")} /></Field>
        <Field label="Tipo de Embalagem *">
          <select className={inputCls} value={f.embalagem_id || ""} onChange={set("embalagem_id")}>
            <option value="">— escolher —</option>
            {embalagensAtivas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </Field>
      </div>
      {f.embalagem_id && itensDaEmbalagemEscolhida.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-md px-3 py-2.5 mb-4">
          <p className="text-xs text-purple-700 mb-1">
            📦 {embalagemMudou ? "Ao guardar, esta Embalagem vai dar baixa de:" : "Esta Embalagem já deu baixa de:"}
          </p>
          <ul className="text-xs text-purple-700 list-disc list-inside">
            {itensDaEmbalagemEscolhida.map((it) => {
              const a = (articlesComputed || []).find((x) => x.id === it.article_id);
              return <li key={it.id}>{a?.artigo || "artigo removido"}: −{it.quantidade}{a ? ` (stock atual: ${a.stockAtual})` : ""}</li>;
            })}
          </ul>
        </div>
      )}
      {embalagensAtivas.length === 0 && (
        <p className="text-[11px] text-clay-dark mb-4">⚠ Ainda não há Tipos de Embalagem definidos — cria um em Definições → Etiquetas e Embalagens.</p>
      )}

      <div className="mb-4">
        <label className="text-xs font-medium text-stone">Vendas incluídas ({vendasJaIncluidas.length}) · total {money(total)}</label>
        <div className="border border-line rounded-lg overflow-auto mt-1.5 mb-2">
          <table>
            <thead><tr><th>Código</th><th>Artigo</th><th>Vendeu</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              {vendasJaIncluidas.length === 0 && <EmptyRow span={5} text="Ainda sem vendas escolhidas." />}
              {vendasJaIncluidas.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-stone">{s.codigo || "—"}</td>
                  <td>{onOpenSale ? <button type="button" onClick={() => onOpenSale(s.id)} className="text-ink underline decoration-line">{articleName(s.article_id)}</button> : articleName(s.article_id)}</td>
                  <td className="text-stone text-xs">{s.quem_vendeu || "—"}</td>
                  <td className="font-mono text-xs">{money(s.valor_venda)}</td>
                  <td><button type="button" onClick={() => handleRemoverJa(s.id)} className="text-xs text-clay-dark underline">remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {podeAcrescentar ? (
          vendasSoltasDoCliente.length > 0 && (
            <div className="border border-line rounded-lg p-2.5 bg-paper/40">
              <p className="text-[11px] text-stone mb-1.5">+ Adicionar vendas soltas deste cliente:</p>
              <div className="flex flex-col gap-1">
                {vendasSoltasDoCliente.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={incluidas.has(s.id)} onChange={() => toggleIncluida(s.id)} />
                    <span className="font-mono text-stone">{s.codigo || "—"}</span> · {articleName(s.article_id)} · <span className="font-mono">{money(s.valor_venda)}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        ) : (
          <p className="text-[11px] text-stone">Só é possível acrescentar vendas enquanto o Estado de envio for "Em Preparação".</p>
        )}
      </div>

      <p className="text-xs font-medium text-stone mb-2">Faturas — uma por cada pessoa que precisar de faturar as suas peças desta encomenda</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="border border-line rounded-lg p-2.5">
          <p className="text-[11px] font-semibold text-plum mb-1.5">Fatura — Rosa</p>
          <Field label="Nº de fatura"><input className={inputCls} value={f.fatura_rosa || ""} onChange={set("fatura_rosa")} placeholder="por emitir" /></Field>
          <div className="mt-1.5">
            <Field label="Anexar"><input type="file" accept="application/pdf,image/*" onChange={handleUpload("fatura_rosa", "fatura_rosa_url", "fatura-rosa")} disabled={uploadingField === "fatura_rosa_url"} className={`${inputCls} py-1.5`} /></Field>
          </div>
          {uploadingField === "fatura_rosa_url" && <p className="text-xs text-stone mt-1">A enviar…</p>}
          {uploadingField !== "fatura_rosa_url" && f.fatura_rosa_url && (
            <div className="flex items-center gap-3 text-xs mt-1.5">
              <a href={f.fatura_rosa_url} target="_blank" rel="noreferrer" className="text-purple-600 font-medium underline">Ver fatura</a>
              <button type="button" onClick={() => handleRemoveFatura("fatura_rosa_url")} className="text-clay-dark underline">remover</button>
            </div>
          )}
        </div>
        <div className="border border-line rounded-lg p-2.5">
          <p className="text-[11px] font-semibold text-rust-dark mb-1.5">Fatura — Rita</p>
          <Field label="Nº de fatura"><input className={inputCls} value={f.fatura_rita || ""} onChange={set("fatura_rita")} placeholder="por emitir" /></Field>
          <div className="mt-1.5">
            <Field label="Anexar"><input type="file" accept="application/pdf,image/*" onChange={handleUpload("fatura_rita", "fatura_rita_url", "fatura-rita")} disabled={uploadingField === "fatura_rita_url"} className={`${inputCls} py-1.5`} /></Field>
          </div>
          {uploadingField === "fatura_rita_url" && <p className="text-xs text-stone mt-1">A enviar…</p>}
          {uploadingField !== "fatura_rita_url" && f.fatura_rita_url && (
            <div className="flex items-center gap-3 text-xs mt-1.5">
              <a href={f.fatura_rita_url} target="_blank" rel="noreferrer" className="text-purple-600 font-medium underline">Ver fatura</a>
              <button type="button" onClick={() => handleRemoveFatura("fatura_rita_url")} className="text-clay-dark underline">remover</button>
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-stone -mt-3 mb-4">💡 Cada venda mostra sempre a fatura de quem a vendeu ("Quem vendeu" na venda) — Rosa por defeito, se não estiver definido.</p>

      {error && <p className="text-clay-dark text-xs mb-3">{error}</p>}
      <div className="mb-5">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={f.notas || ""} onChange={set("notas")} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} label={saving ? "A guardar…" : "Guardar encomenda"} disabled={saving} />
    </ModalShell>
  );
}
