import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { deleteRow, updateRow } from "../lib/useRealtimeTable";
import { getTestMode } from "../lib/testMode";
import { uploadDocument, deleteDocument } from "../lib/fileStorage";
import { OWNERS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS, SHIPPING_STATUS, SHIPPING_METHODS, CLIENT_STATUS_COLORS } from "../lib/constants";
import { money, fmtDate, todayISO, uid, sugerirCodigoPorData, dadosEmpresa } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, useColumnFilters, FilterTh } from "../components/ui";
import MessageComposer from "../components/MessageComposer";

const empty = (articles, clients, presetArticleId, presetClientId, loggedInOwner) => {
  const preset = presetArticleId ? articles.find((a) => a.id === presetArticleId) : null;
  return {
    id: uid(), codigo: "", article_id: preset?.id || articles[0]?.id || "", quantidade: 1, valor_venda: preset?.valor_venda ?? (articles[0]?.valor_venda || 0),
    quem_vendeu: loggedInOwner || "", client_id: presetClientId || clients[0]?.id || "", data: todayISO(), data_reserva: todayISO(), data_limite_reserva: "",
    estado: "Aguarda pagamento", forma_pagamento: "", data_pagamento: "", comprovativo_url: "",
    estado_envio: "Não Definido", metodo_envio: "", codigo_envio: "", data_envio: "",
    fatura: "", fatura_url: "", notas: "",
  };
};

const paymentColor = (estado) => {
  if (estado === "Pago") return { color: "#254238", bg: "#DCEBE4" };
  if (estado === "Não pago") return { color: "#7A2A24", bg: "#F5D9D6" };
  return { color: "#A67C1E", bg: "#F5EADD" }; // Aguarda pagamento
};
const shippingColor = (estado) => {
  if (estado === "Enviado") return { color: "#254238", bg: "#DCEBE4" };
  if (estado === "Entregue em mãos") return { color: "#254238", bg: "#DCEBE4" };
  if (estado === "Preparado") return { color: "#832F72", bg: "#F7E3F2" };
  if (estado === "Em Preparação") return { color: "#A67C1E", bg: "#F5EADD" };
  return { color: "#8A8677", bg: "#F1EDE3" }; // "Não Definido"
};

export default function Sales({ sales, articles, clients, clientsComputed, articleName, clientName, articlesComputed, messageTemplates, autoOpenNew, onConsumedAutoOpen, presetArticleId, onConsumedPresetArticle, presetClientId, onConsumedPresetClient, autoOpenEditId, onConsumedAutoOpenEdit, onRequestExchange, returnToLiveId, liveName, onReturnToLive, loggedInOwner, onOpenArticle, liveRegistos, settings }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [messageFor, setMessageFor] = useState(null); // venda selecionada para enviar mensagem
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) {
      setModal({ data: empty(articles, clients, presetArticleId, presetClientId, loggedInOwner), isNew: true });
      onConsumedAutoOpen?.();
      if (presetArticleId) onConsumedPresetArticle?.();
      if (presetClientId) onConsumedPresetClient?.();
    }
  }, [autoOpenNew]);

  useEffect(() => {
    if (autoOpenEditId) {
      const s = sales.find((x) => x.id === autoOpenEditId);
      if (s) setModal({ data: { ...s }, isNew: false });
      onConsumedAutoOpenEdit?.();
    }
  }, [autoOpenEditId, sales]);

  const rows = sales.filter((s) => (articleName(s.article_id) + clientName(s.client_id)).toLowerCase().includes(q.toLowerCase()));
  const total = rows.reduce((s, x) => s + Number(x.valor_venda || 0), 0);

  const filterCols = {
    vendeu: (s) => s.quem_vendeu || "—",
    pagamento: (s) => s.estado || "—",
    envio: (s) => s.estado_envio || "Não Definido",
    metodo: (s) => s.metodo_envio || "— por definir —",
  };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(sales, filterCols);

  // Por defeito só mostra vendas que ainda vão ter alguma ação da nossa parte: reservas por
  // pagar, ou já pagas mas ainda por enviar/entregar. Pagas-e-entregues e "Não pago" ficam
  // escondidas (não pedem mais nenhuma ação), mas continuam visíveis se se limpar o filtro.
  const [onlyPending, setOnlyPending] = useState(true);
  const precisaAcao = (s) => !(s.estado === "Não pago" || (s.estado === "Pago" && (s.estado_envio === "Enviado" || s.estado_envio === "Entregue em mãos")));
  const filteredRows = applyFilters(rows)
    .filter((s) => !onlyPending || precisaAcao(s))
    .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.codigo || "").localeCompare(a.codigo || ""));

  async function handleDelete(s) {
    const ok = await confirm({ title: "Eliminar venda?", message: `A venda de "${articleName(s.article_id)}" a ${clientName(s.client_id)} vai para a Lixeira.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("sales", s.id);
    // Se esta venda teve origem num direto (validação/lista de espera), o registo respetivo
    // fica solto ligado a uma venda que já não existe — devolve-o a "Por validar", com a
    // quantidade toda outra vez por vender, para poder ser processado de novo.
    const registo = (liveRegistos || []).find((r) => r.sale_id === s.id);
    if (registo && registo.estado !== "Cancelado") {
      await updateRow("live_registos", registo.id, {
        estado: "Por validar",
        quantidade: Number(registo.quantidade || 0) + Number(registo.quantidade_vendida || 0),
        quantidade_vendida: 0,
        sale_id: null,
      });
    }
    notify(registo ? "Venda eliminada — o registo do direto voltou a ficar pendente." : "Venda eliminada.");
  }

  return (
    <div>
      {returnToLiveId && (
        <button
          onClick={onReturnToLive}
          className="mb-3 flex items-center gap-1.5 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-md px-3 py-2 hover:bg-purple-100"
        >
          ← Voltar ao direto{liveName ? ` "${liveName}"` : ""}
        </button>
      )}
      <TabHeader
        title="Vendas"
        sub={`${sales.length} venda(s) · total ${money(total)}`}
        btnLabel="Registar venda"
        onNew={() => setModal({ data: empty(articles, clients, null, null, loggedInOwner), isNew: true })}
        disabled={articles.length === 0}
        hasActiveFilters={hasActiveFilters || onlyPending} onClearFilters={() => { clearAllFilters(); setOnlyPending(false); }}
      />
      <label className="flex items-center gap-2 -mt-2 mb-4 text-xs text-stone">
        <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="w-3.5 h-3.5" />
        Mostrar só vendas com ação pendente (esconde pagas-e-entregues e "Não pago")
      </label>
      {articles.length === 0 && <p className="text-clay-dark text-xs -mt-2 mb-3">Cria primeiro um artigo no catálogo.</p>}
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por artigo ou cliente…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Data</th><th>Artigo</th><th>Cliente</th><th>Qtd</th><th>Valor</th><FilterTh label="Vendeu" {...filterProps("vendeu")} />
              <FilterTh label="Pagamento" {...filterProps("pagamento")} /><FilterTh label="Envio" {...filterProps("envio")} />
              <FilterTh label="Método" {...filterProps("metodo")} /><th>Cód. envio</th><th>Fatura</th><th>Notas</th><th></th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={16} text="Sem vendas registadas." />}
            {filteredRows.map((s) => {
              const pc = paymentColor(s.estado);
              const sc = shippingColor(s.estado_envio);
              return (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-stone">{s.codigo || "—"}</td>
                  <td className="font-mono text-xs text-stone">{fmtDate(s.data)}</td>
                  <td className="font-medium">
                    {onOpenArticle ? (
                      <button type="button" onClick={() => onOpenArticle(s.article_id)} className="text-ink underline decoration-line hover:decoration-rust text-left">
                        {articleName(s.article_id)}
                      </button>
                    ) : articleName(s.article_id)}
                  </td>
                  <td className="text-stone">{clientName(s.client_id)}</td>
                  <td className="font-mono">{s.quantidade}</td>
                  <td className="font-mono font-medium text-rust-dark">{money(s.valor_venda)}</td>
                  <td>{s.quem_vendeu ? <Badge text={s.quem_vendeu} color={s.quem_vendeu === "Rosa" ? "#832F72" : "#A67C1E"} bg={s.quem_vendeu === "Rosa" ? "#F7E3F2" : "#F5EADD"} /> : <span className="text-stone">—</span>}</td>
                  <td><Badge text={s.estado} color={pc.color} bg={pc.bg} /></td>
                  <td><Badge text={s.estado_envio || "Não Definido"} color={sc.color} bg={sc.bg} /></td>
                  <td className="text-stone text-xs">{s.metodo_envio || "—"}</td>
                  <td className="font-mono text-xs text-stone">{s.codigo_envio || "—"}</td>
                  <td className={`text-xs ${s.fatura ? "text-stone" : "text-clay-dark italic"}`}>
                    {s.fatura || "por emitir"}
                    {(s.fatura_url || s.comprovativo_url) && <span className="ml-1.5" title="Tem anexo(s)">📎</span>}
                  </td>
                  <td className="text-stone max-w-[160px]" title={s.notas}>{s.notas || "—"}</td>
                  <td>
                    <button onClick={() => setMessageFor(s)} title="Enviar mensagem ao cliente" className="text-purple-600">✉️</button>
                  </td>
                  <td>
                    {s.estado === "Pago" ? (
                      <button onClick={() => onRequestExchange?.(s.id)} title="Pedir troca" className="text-rust-dark">🔁</button>
                    ) : (
                      <span title="Só é possível pedir troca de vendas já pagas" className="text-line">🔁</span>
                    )}
                  </td>
                  <RowActions onEdit={() => setModal({ data: { ...s }, isNew: false })} onDelete={() => handleDelete(s)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <SaleModal
          data={modal.data}
          isNew={modal.isNew}
          articles={articles}
          clients={clients}
          clientsComputed={clientsComputed}
          sales={sales}
          articlesComputed={articlesComputed}
          messageTemplates={messageTemplates}
          articleName={articleName}
          clientName={clientName}
          settings={settings}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            const { error } = await supabase.rpc("save_sale", {
              p_id: values.id,
              p_codigo: values.codigo,
              p_article_id: values.article_id,
              p_quantidade: Number(values.quantidade),
              p_valor_venda: Number(values.valor_venda),
              p_quem_vendeu: values.quem_vendeu,
              p_client_id: values.client_id,
              p_forma_pagamento: values.forma_pagamento,
              p_estado: values.estado,
              p_estado_envio: values.estado_envio,
              p_metodo_envio: values.metodo_envio || null,
              p_codigo_envio: values.codigo_envio || null,
              p_fatura: values.fatura || null,
              p_fatura_url: values.fatura_url || null,
              p_comprovativo_url: values.comprovativo_url || null,
              p_data_reserva: values.data_reserva || null,
              p_data_limite_reserva: values.data_limite_reserva || null,
              p_data_pagamento: values.data_pagamento || null,
              p_data_envio: values.data_envio || null,
              p_data: values.data,
              p_notas: values.notas,
              p_is_test: getTestMode(),
            });
            if (error) throw new Error(error.message.replace(/^.*save_sale: /, ""));
            clearDraft(values.id);
            notify(modal.isNew ? "Venda registada." : "Venda atualizada.");
            setModal(null);
          }}
        />
      )}

      {messageFor && (
        <MessageComposer
          templates={messageTemplates}
          telefone={clients.find((c) => c.id === messageFor.client_id)?.telefone}
          dados={{
            ...dadosEmpresa(settings),
            cliente: clientName(messageFor.client_id),
            artigo: articleName(messageFor.article_id),
            quantidade: messageFor.quantidade,
            valor: money(messageFor.valor_venda),
            codigo: messageFor.codigo,
            codigo_envio: messageFor.codigo_envio,
            metodo_envio: messageFor.metodo_envio,
            data: fmtDate(messageFor.data),
          }}
          onClose={() => setMessageFor(null)}
        />
      )}
    </div>
  );
}

function draftKey(id) { return `rr_draft_sale_${id}`; }
function clearDraft(id) { try { localStorage.removeItem(draftKey(id)); } catch {} }

function SaleModal({ data, isNew, articles, clients, clientsComputed, sales, articlesComputed, messageTemplates, articleName, clientName, settings, onClose, onSave }) {
  const [f, setF] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey(data.id));
      if (saved) return { ...data, ...JSON.parse(saved) };
    } catch {}
    return { ...data, codigo: data.codigo || (isNew ? sugerirCodigoPorData("VENDA", data.data, sales, "codigo", data.id) : "") };
  });
  const [draftRestored] = useState(() => {
    try { return !!localStorage.getItem(draftKey(data.id)); } catch { return false; }
  });
  const [showDraftBanner, setShowDraftBanner] = useState(draftRestored);
  const [error, setError] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const saveTimer = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setNum = (k) => (e) => setF({ ...f, [k]: parseFloat(e.target.value) || 0 });
  const selected = articlesComputed.find((a) => a.id === f.article_id);
  const clientReservasPendentes = sales.filter((s) => s.client_id === f.client_id && s.estado === "Aguarda pagamento" && s.id !== f.id);
  const selectedClientComputed = clientsComputed?.find((c) => c.id === f.client_id);
  const clientBlocked = isNew && selectedClientComputed?.estadoCliente === "Bloqueado";
  const confirm = useConfirm();
  const [showMessage, setShowMessage] = useState(false);

  // autosave: guarda o rascunho localmente 600ms depois de cada alteração
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey(f.id), JSON.stringify(f)); } catch {}
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [f]);

  function discardDraft() {
    clearDraft(data.id);
    setF(data);
    setShowDraftBanner(false);
  }

  function handleUpload(field, folder) {
    return async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingField(field);
      setError("");
      try {
        const url = await uploadDocument(file, `sales/${f.id}/${folder}`);
        setF((prev) => ({ ...prev, [field]: url }));
      } catch (err) {
        setError("Não foi possível enviar o ficheiro: " + (err.message || "erro desconhecido"));
      } finally {
        setUploadingField("");
      }
    };
  }

  async function handleRemove(field) {
    const url = f[field];
    setF((prev) => ({ ...prev, [field]: "" }));
    await deleteDocument(url);
  }

  return (
    <ModalShell title={isNew ? "Registar venda" : "Editar venda"} subtitle={selected ? `Stock disponível: ${selected.stockAtual} un.` : undefined} onClose={onClose} wide>
      {!isNew && f.client_id && (
        <div className="flex justify-end -mt-1 mb-2.5">
          <button type="button" onClick={() => setShowMessage(true)} className="text-xs font-medium text-purple-600 underline">✉️ Enviar mensagem ao cliente</button>
        </div>
      )}
      {showDraftBanner && (
        <div className="bg-purple-50 border border-purple-200 text-purple-700 text-xs rounded-md px-3 py-2 mb-3 flex items-center justify-between gap-2">
          <span>📝 Rascunho anterior restaurado automaticamente.</span>
          <button type="button" onClick={discardDraft} className="underline font-medium flex-shrink-0">descartar rascunho</button>
        </div>
      )}
      <SectionTitle n={1} title="Informação" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Código (único, tipo SKU)">
          <div className="flex gap-1.5">
            <input className={`${inputCls} font-mono`} value={f.codigo} onChange={set("codigo")} placeholder="ex: VENDA-20260815" />
            <Button type="button" onClick={() => setF({ ...f, codigo: sugerirCodigoPorData("VENDA", f.data, sales, "codigo", f.id) })}>🔄</Button>
          </div>
        </Field>
        <Field label="Cliente">
          <select className={inputCls} value={f.client_id} onChange={set("client_id")}>
            {clients.map((c) => {
              const blocked = clientsComputed?.find((x) => x.id === c.id)?.estadoCliente === "Bloqueado";
              return <option key={c.id} value={c.id}>{blocked ? `🚫 ${c.nome} (Bloqueado)` : c.nome}</option>;
            })}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Quem vendeu">
          <select className={inputCls} value={f.quem_vendeu || ""} onChange={set("quem_vendeu")}>
            <option value="">— não indicado —</option>
            {OWNERS.map((o) => <option key={o}>{o}</option>)}
          </select>
          {isNew && <p className="text-stone text-[11px] mt-1">Preenchido automaticamente a partir de quem tem a sessão iniciada — podes mudar se estiveres a registar em nome da outra.</p>}
        </Field>
      </div>
      {clientBlocked && (
        <div className="bg-clay-dark/10 border border-clay-dark/40 text-clay-dark text-xs rounded-md px-3 py-2 mb-3 font-medium">
          🚫 Este cliente está bloqueado (saldo de pontos negativo, por peça(s) não paga(s)). Não é possível registar uma nova venda até o saldo ficar positivo.
        </div>
      )}
      {isNew && !clientBlocked && clientReservasPendentes.length > 0 && (
        <div className="bg-gold-500/10 border border-gold-500/40 text-gold-600 text-xs rounded-md px-3 py-2 mb-3">
          ⚠ Este cliente já tem {clientReservasPendentes.length} reserva(s) por pagar.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Artigo" span>
          <select
            className={inputCls}
            value={f.article_id}
            onChange={(e) => { const a = articles.find((x) => x.id === e.target.value); setF({ ...f, article_id: e.target.value, valor_venda: a?.valor_venda || 0 }); }}
          >
            {articles.map((a) => <option key={a.id} value={a.id}>{displaySku(a) ? `${displaySku(a)} — ${a.artigo}` : a.artigo}</option>)}
          </select>
          {selected && <p className="text-stone text-[11px] mt-1 font-mono">SKU: {displaySku(selected) || "sem SKU"}</p>}
        </Field>
        <Field label="Quantidade"><input type="number" min="1" className={inputCls} value={f.quantidade} onChange={setNum("quantidade")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Valor da venda (€, total)"><input type="number" step="0.01" min="0" className={inputCls} value={f.valor_venda} onChange={setNum("valor_venda")} /></Field>
        <Field label="Data da venda"><input type="date" className={inputCls} value={f.data} onChange={set("data")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <Field label="Data da reserva"><input type="date" className={inputCls} value={f.data_reserva || ""} onChange={set("data_reserva")} /></Field>
        <Field label="Data limite da reserva"><input type="date" className={inputCls} value={f.data_limite_reserva || ""} onChange={set("data_limite_reserva")} /></Field>
      </div>

      <SectionTitle n={2} title="Pagamento" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Estado do pagamento">
          <select className={inputCls} value={f.estado} onChange={set("estado")}>{PAYMENT_STATUS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="Forma de pagamento">
          <select className={inputCls} value={f.forma_pagamento} onChange={set("forma_pagamento")}>{PAYMENT_METHODS.map((o) => <option key={o} value={o}>{PAYMENT_METHOD_LABELS[o]}</option>)}</select>
        </Field>
      </div>
      <div className="mb-3">
        <Field label="Data do pagamento"><input type="date" className={inputCls} value={f.data_pagamento || ""} onChange={set("data_pagamento")} /></Field>
      </div>
      <div className="mb-1.5">
        <Field label="Anexar comprovativo de pagamento">
          <input type="file" accept="application/pdf,image/*" onChange={handleUpload("comprovativo_url", "comprovativo")} disabled={uploadingField === "comprovativo_url"} className={`${inputCls} py-1.5`} />
        </Field>
      </div>
      <div className="mb-5">
        <AttachmentStatus label="Comprovativo" url={f.comprovativo_url} uploading={uploadingField === "comprovativo_url"} onRemove={() => handleRemove("comprovativo_url")} />
      </div>

      <SectionTitle n={3} title="Encomenda" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Field label="Estado do envio">
          <select className={inputCls} value={f.estado_envio} onChange={set("estado_envio")}>{SHIPPING_STATUS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="Método de envio">
          <select className={inputCls} value={f.metodo_envio} onChange={set("metodo_envio")}>
            <option value="">— por definir —</option>
            {SHIPPING_METHODS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Código de envio"><input className={inputCls} value={f.codigo_envio || ""} onChange={set("codigo_envio")} placeholder="ex: RR123456789PT" /></Field>
      </div>
      <div className="mb-5">
        <Field label="Data do envio"><input type="date" className={inputCls} value={f.data_envio || ""} onChange={set("data_envio")} /></Field>
      </div>

      <SectionTitle n={4} title="Parte fiscal" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Nº de fatura"><input className={inputCls} value={f.fatura} onChange={set("fatura")} placeholder="por emitir" /></Field>
        <Field label="Anexar fatura de venda">
          <input type="file" accept="application/pdf,image/*" onChange={handleUpload("fatura_url", "fatura")} disabled={uploadingField === "fatura_url"} className={`${inputCls} py-1.5`} />
        </Field>
      </div>
      <div className="mb-5">
        <AttachmentStatus label="Fatura de venda" url={f.fatura_url} uploading={uploadingField === "fatura_url"} onRemove={() => handleRemove("fatura_url")} />
      </div>

      <div className="mb-5">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={f.notas} onChange={set("notas")} /></Field>
      </div>

      {error && <p className="text-clay-dark text-xs -mt-2 mb-3">{error}</p>}
      <ModalActions
        onClose={onClose}
        disabled={clientBlocked}
        onSave={async () => {
          if (clientBlocked) return;
          setError("");
          const codigo = (f.codigo || "").trim();
          if (!codigo) { setError("Indica um código para a venda."); return; }
          const duplicado = sales.some((s) => s.id !== f.id && (s.codigo || "").trim().toLowerCase() === codigo.toLowerCase());
          if (duplicado) { setError(`Já existe uma venda com o código "${codigo}" — escolhe outro.`); return; }
          if (isNew && clientReservasPendentes.length > 0) {
            const nomeCliente = clients.find((c) => c.id === f.client_id)?.nome || "Este cliente";
            const ok = await confirm({
              title: "Cliente com reserva por pagar",
              message: `${nomeCliente} já tem ${clientReservasPendentes.length} reserva(s) por pagar. Ainda assim queres registar esta nova venda?`,
              confirmLabel: "Registar mesmo assim",
              danger: false,
            });
            if (!ok) return;
          }
          try { await onSave({ ...f, codigo }); }
          catch (err) { setError(err.message || "Não foi possível guardar a venda."); }
        }}
        label="Guardar venda"
      />
      {showMessage && (
        <MessageComposer
          templates={messageTemplates}
          telefone={clients.find((c) => c.id === f.client_id)?.telefone}
          dados={{
            ...dadosEmpresa(settings),
            cliente: clientName ? clientName(f.client_id) : (clients.find((c) => c.id === f.client_id)?.nome || "cliente"),
            artigo: articleName ? articleName(f.article_id) : "",
            quantidade: f.quantidade,
            valor: money(f.valor_venda),
            codigo: f.codigo,
            codigo_envio: f.codigo_envio,
            metodo_envio: f.metodo_envio,
            data: fmtDate(f.data),
          }}
          onClose={() => setShowMessage(false)}
        />
      )}
    </ModalShell>
  );
}

function SectionTitle({ n, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">{n}</span>
      <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
    </div>
  );
}

function AttachmentStatus({ label, url, uploading, onRemove }) {
  if (uploading) return <p className="text-xs text-stone">A enviar {label.toLowerCase()}…</p>;
  if (!url) return <p className="text-xs text-stone">Sem {label.toLowerCase()} anexada.</p>;
  return (
    <div className="flex items-center gap-3 text-xs">
      <a href={url} target="_blank" rel="noreferrer" className="text-purple-600 font-medium underline">Ver {label.toLowerCase()}</a>
      <button type="button" onClick={onRemove} className="text-clay-dark underline">remover</button>
    </div>
  );
}
