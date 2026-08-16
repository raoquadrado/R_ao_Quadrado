import { useState } from "react";
import { supabase } from "../supabaseClient";
import { updateRow } from "../lib/useRealtimeTable";
import { getTestMode } from "../lib/testMode";
import { money, todayISO, uid, fmtDate, dadosEmpresa } from "../lib/computations";
import { resolveLiveItem, effectiveArticleId } from "../lib/liveHelpers";
import { useToast } from "../lib/overlays";
import { SearchBox, EmptyRow } from "../components/ui";
import MessageComposer from "../components/MessageComposer";
import WaitlistRow from "../components/WaitlistRow";

// Junta a lista de espera de todos os diretos num só sítio, sem ser preciso entrar em
// cada um. As mesmas ações (trocar artigo, mudar estado, fazer venda, mensagem) funcionam
// aqui tal como dentro de um direto específico.
export default function WaitlistAll({ lives, liveRegistos, clients, articlesComputed, articleName, messageTemplates, loggedInOwner, onBack, onOpenLive, onOpenSale, settings }) {
  const [q, setQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [messageFor, setMessageFor] = useState(null);
  const notify = useToast();

  const clientName = (id) => clients.find((c) => c.id === id)?.nome || "—";

  const todas = liveRegistos.filter((r) => r.estado === "Lista de espera");
  const filtradas = todas
    .filter((r) => !onlyPending || (r.estado_lista_espera || "Pendente") === "Pendente")
    .filter((r) => {
      const live = lives.find((l) => l.id === r.live_id);
      return ((live?.nome || "") + (live?.codigo || "") + r.username + clientName(r.client_id)).toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  async function cancelarRegisto(id) {
    await updateRow("live_registos", id, { estado: "Cancelado" });
  }

  async function definirSubstituto(registoId, articleId) {
    await updateRow("live_registos", registoId, { artigo_substituto_id: articleId });
  }

  async function definirEstadoEspera(registoId, estado) {
    await updateRow("live_registos", registoId, { estado_lista_espera: estado });
  }

  async function fazerVenda(registo, item, quantidadeAVender) {
    const articleId = effectiveArticleId(registo, item);
    if (quantidadeAVender <= 0 || !articleId) {
      notify("Sem stock disponível.", "error");
      return;
    }
    const live = lives.find((l) => l.id === registo.live_id);
    const article = articlesComputed.find((a) => a.id === articleId);
    const saleId = uid();
    const { error } = await supabase.rpc("save_sale", {
      p_id: saleId,
      p_codigo: null,
      p_article_id: articleId,
      p_quantidade: quantidadeAVender,
      p_valor_venda: item?.preco_direto ?? article?.valor_venda ?? 0,
      p_quem_vendeu: loggedInOwner || "",
      p_client_id: registo.client_id,
      p_forma_pagamento: "",
      p_estado: "Aguarda pagamento",
      p_estado_envio: "Em Preparação",
      p_metodo_envio: null,
      p_codigo_envio: null,
      p_fatura: null,
      p_fatura_url: null,
      p_comprovativo_url: null,
      p_data_reserva: todayISO(),
      p_data_limite_reserva: null,
      p_data_pagamento: null,
      p_data_envio: null,
      p_data: todayISO(),
      p_notas: `Direto: ${live?.nome || ""}`,
      p_is_test: getTestMode(),
    });
    if (error) { notify(error.message.replace(/^.*save_sale: /, ""), "error"); return; }

    const restante = registo.quantidade - quantidadeAVender;
    await updateRow("live_registos", registo.id, {
      estado: restante > 0 ? "Lista de espera" : "Vendido",
      quantidade: restante > 0 ? restante : registo.quantidade,
      quantidade_vendida: (registo.quantidade_vendida || 0) + quantidadeAVender,
      sale_id: saleId,
    });
    notify(restante > 0 ? `Vendidas ${quantidadeAVender}, restantes ${restante} em lista de espera.` : "Venda criada.");
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-stone underline mb-4">← Voltar aos diretos</button>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold mb-0.5">📋 Lista de espera — todos os diretos</h1>
        <p className="text-stone text-sm">{todas.length} registo(s) em lista de espera no total</p>
      </div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <SearchBox value={q} onChange={setQ} placeholder="Procurar por direto, cliente ou username…" />
        <label className="flex items-center gap-2 text-xs text-stone flex-shrink-0">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="w-3.5 h-3.5" />
          Mostrar só Pendentes (esconde Encerrados)
        </label>
      </div>
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead><tr><th>Direto</th><th>#</th><th>Cliente</th><th>Item</th><th>SKU / Stock</th><th>Qtd</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtradas.length === 0 && <EmptyRow span={8} text="Sem registos em lista de espera." />}
            {filtradas.map((r) => {
              const live = lives.find((l) => l.id === r.live_id);
              const item = resolveLiveItem(live, r.live_item_id);
              return (
                <WaitlistRow key={r.id} r={r} live={live} item={item}
                  clientName={clientName} articlesComputed={articlesComputed} articleName={articleName} allArticles={articlesComputed}
                  onFazerVenda={fazerVenda} onCancelarRegisto={cancelarRegisto} onOpenSale={onOpenSale}
                  onSetSubstituto={definirSubstituto} onSetEstadoEspera={definirEstadoEspera}
                  onMessage={() => setMessageFor({ registo: r, item, live })}
                  showDireto onOpenLive={onOpenLive}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {messageFor && (
        <MessageComposer
          templates={messageTemplates}
          telefone={clients.find((c) => c.id === messageFor.registo.client_id)?.telefone}
          dados={{
            ...dadosEmpresa(settings),
            cliente: clientName(messageFor.registo.client_id) !== "—" ? clientName(messageFor.registo.client_id) : messageFor.registo.username,
            artigo: messageFor.item ? (messageFor.item.tipo === "conjunto" ? messageFor.item.nome : articleName(messageFor.item.article_ids[0])) : "",
            quantidade: messageFor.registo.quantidade,
            valor: money(messageFor.item?.preco_direto || 0),
            codigo: messageFor.live?.codigo,
            direto: messageFor.live?.nome,
            data: messageFor.live?.data ? fmtDate(messageFor.live.data) : "",
          }}
          onClose={() => setMessageFor(null)}
        />
      )}
    </div>
  );
}
