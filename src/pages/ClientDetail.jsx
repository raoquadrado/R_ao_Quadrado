import { useState, useEffect } from "react";
import { updateRow, useAuditLogForRecord } from "../lib/useRealtimeTable";
import { money, fmtDate, dadosEmpresa } from "../lib/computations";
import { CLIENT_STATUS_COLORS } from "../lib/constants";
import { useToast } from "../lib/overlays";
import { Badge, Card, inputCls, TagBadge, FavoriteStar } from "../components/ui";
import MessageComposer from "../components/MessageComposer";

function ActionColor(action) {
  if (action === "insert") return { text: "criado", color: "#254238", bg: "#DCEBE4" };
  if (action === "delete") return { text: "eliminado", color: "#7A2A24", bg: "#F5D9D6" };
  return { text: "editado", color: "#A67C1E", bg: "#F5EADD" };
}

export default function ClientDetail({
  clientId, clientsComputed, sales, articlesComputed, liveRegistos, lives, articleName, messageTemplates,
  onBack, onEdit, onRegisterSale, settings,
}) {
  const c = clientsComputed.find((x) => x.id === clientId);
  const { rows: history } = useAuditLogForRecord("clients", clientId);
  const notify = useToast();
  const [notas, setNotas] = useState(c?.notas || "");
  const [savingNotas, setSavingNotas] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => { setNotas(c?.notas || ""); }, [c?.id]);

  if (!c) {
    return (
      <div>
        <button onClick={onBack} className="text-sm text-stone underline mb-4">← Voltar aos clientes</button>
        <p className="text-stone">Este cliente já não existe (foi eliminado).</p>
      </div>
    );
  }

  const vendasCliente = sales.filter((s) => s.client_id === c.id).sort((x, y) => (y.data || "").localeCompare(x.data || ""));
  const vendasPagas = vendasCliente.filter((s) => s.estado === "Pago");
  const ticketMedio = vendasPagas.length ? c.totalGasto / vendasPagas.length : 0;

  // artigo favorito — categoria (tipo) mais comprada, entre as vendas pagas
  const contagemTipos = {};
  vendasPagas.forEach((s) => {
    const artigo = articlesComputed.find((a) => a.id === s.article_id);
    if (artigo?.tipo) contagemTipos[artigo.tipo] = (contagemTipos[artigo.tipo] || 0) + Number(s.quantidade || 0);
  });
  const tipoFavorito = Object.entries(contagemTipos).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // diretos — registos deste cliente que se transformaram em venda
  const registosCliente = (liveRegistos || []).filter((r) => r.client_id === c.id && r.sale_id);
  const comprasDiretos = registosCliente.length;
  const comprasPorRede = {};
  registosCliente.forEach((r) => {
    if (r.rede_social) comprasPorRede[r.rede_social] = (comprasPorRede[r.rede_social] || 0) + 1;
  });

  async function saveNotas() {
    setSavingNotas(true);
    try {
      await updateRow("clients", c.id, { notas });
      notify("Notas guardadas.");
    } catch {
      notify("Não foi possível guardar as notas.", "error");
    } finally {
      setSavingNotas(false);
    }
  }

  const sc = c.estadoCliente ? CLIENT_STATUS_COLORS[c.estadoCliente] : null;

  return (
    <div>
      <button onClick={onBack} className="text-sm text-stone underline mb-4">← Voltar aos clientes</button>

      {/* Cabeçalho */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-semibold">{c.nome || "(sem nome)"}</h1>
              <FavoriteStar active={!!c.favorito} onClick={() => updateRow("clients", c.id, { favorito: !c.favorito })} />
              {c.etiqueta && <TagBadge value={c.etiqueta} />}
              {sc && <Badge text={c.estadoCliente} color={sc.color} bg={sc.bg} />}
            </div>
            <p className="text-stone text-sm mt-0.5">
              {c.plataforma ? `${c.plataforma}${c.rede_social ? " · " + c.rede_social : ""}` : (c.rede_social || "sem rede social")}
              {c.telefone ? ` · ${c.telefone}` : ""}
              {c.email ? ` · ${c.email}` : ""}
            </p>
          </div>
          <button onClick={() => onEdit(c)} className="text-xs font-medium bg-white border border-line rounded px-3 py-1.5 text-ink flex-shrink-0">Editar</button>
        </div>
        <div className="mt-3">
          <button onClick={() => setShowMessage(true)} className="text-xs font-medium bg-white border border-line rounded px-3 py-1.5 text-ink">✉️ Enviar mensagem</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card label="Nº de encomendas" value={c.nCompras} color="#1C2541" />
        <Card label="Total gasto" value={money(c.totalGasto)} color="#254238" />
        <Card label="Ticket médio" value={money(ticketMedio)} color="#1C2541" />
        <Card label="Pontos" value={c.pontos} color={c.pontos < 0 ? "#7A2A24" : "#254238"} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card label="Última compra" value={c.dataUltimaCompra ? fmtDate(c.dataUltimaCompra) : "—"} color="#1C2541" />
        <Card label="Artigo favorito" value={tipoFavorito || "—"} color="#832F72" />
        <Card label="Comprou em diretos" value={`${comprasDiretos} vez${comprasDiretos === 1 ? "" : "es"}`} color="#832F72" />
        <Card label="Encomendas pendentes" value={c.nReservasPendentes || 0} color={c.nReservasPendentes > 0 ? "#A67C1E" : "#1C2541"} />
      </div>

      {/* Compras por rede social (via diretos) */}
      {Object.keys(comprasPorRede).length > 0 && (
        <Section title="Compras por rede social (em diretos)">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(comprasPorRede).map(([rede, n]) => (
              <span key={rede} className="text-sm bg-paper rounded-full px-3 py-1.5">
                Comprou através do <span className="font-medium">{rede}</span>: {n}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Informação do cliente */}
      <Section title="Informação">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <p><span className="text-stone">NIF:</span> {c.nif || "—"}</p>
          <p><span className="text-stone">Aniversário:</span> {c.aniversario ? fmtDate(c.aniversario) : "—"}</p>
          <p><span className="text-stone">Morada de faturação:</span> {c.morada_faturacao || "—"}</p>
          <p><span className="text-stone">Morada de entrega:</span> {c.morada_entrega || "—"}</p>
          <p><span className="text-stone">Satisfação:</span> {(c.avaliacao || 0) === 0 ? "Não avaliado" : "★".repeat(c.avaliacao) + "☆".repeat(5 - c.avaliacao)}</p>
          <p><span className="text-stone">Pontos de bónus:</span> {c.pontosBonus ?? 0}</p>
          <p><span className="text-stone">Código de desconto:</span> {c.codigo_desconto || "—"}{c.codigo_desconto ? (c.desconto_utilizado ? " (utilizado)" : " (por utilizar)") : ""}</p>
          <p><span className="text-stone">Total no último ano:</span> {money(c.totalGastoAno)}</p>
        </div>
      </Section>

      {/* Notas */}
      <Section title="Notas">
        <textarea
          rows={3}
          className={inputCls}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas internas sobre este cliente…"
        />
        {notas !== (c.notas || "") && (
          <button onClick={saveNotas} disabled={savingNotas} className="mt-2 text-xs font-medium bg-rust text-white rounded px-3 py-1.5 disabled:opacity-50">
            {savingNotas ? "A guardar…" : "Guardar notas"}
          </button>
        )}
      </Section>

      {/* Compras */}
      <Section
        title={`Compras (${vendasCliente.length})`}
        action={<button onClick={() => onRegisterSale(c.id)} className="text-xs font-medium text-purple-600 underline">+ Registar venda</button>}
      >
        {vendasCliente.length === 0 ? (
          <p className="text-stone text-sm">Ainda sem compras registadas.</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table>
                <thead><tr><th>Data</th><th>Artigo</th><th>Qtd</th><th>Valor</th><th>Pagamento</th><th>Envio</th><th>Pontos</th></tr></thead>
                <tbody>
                  {vendasCliente.map((s) => {
                    const delta = s.estado === "Pago" ? Number(s.valor_venda || 0) : s.estado === "Não pago" ? -Number(s.valor_venda || 0) : 0;
                    return (
                      <tr key={s.id}>
                        <td className="font-mono text-xs text-stone">{fmtDate(s.data)}</td>
                        <td>{articleName ? articleName(s.article_id) : "—"}</td>
                        <td className="font-mono">{s.quantidade}</td>
                        <td className="font-mono text-xs font-medium">{money(s.valor_venda)}</td>
                        <td>
                          <Badge
                            text={s.estado}
                            color={s.estado === "Pago" ? "#254238" : s.estado === "Não pago" ? "#7A2A24" : "#A67C1E"}
                            bg={s.estado === "Pago" ? "#DCEBE4" : s.estado === "Não pago" ? "#F5D9D6" : "#F5EADD"}
                          />
                        </td>
                        <td className="text-stone text-xs">{s.estado_envio || "Não Definido"}</td>
                        <td className={`font-mono text-xs font-medium ${delta > 0 ? "text-sage-dark" : delta < 0 ? "text-clay-dark" : "text-stone"}`}>
                          {delta > 0 ? `+${Math.round(delta)}` : delta < 0 ? Math.round(delta) : "— (por confirmar)"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-stone text-[11px] mt-3">
              💡 Cada euro pago soma um ponto; cada venda "Não pago" retira o valor correspondente. Reservas "Aguarda pagamento" ainda não contam para os pontos.
              {c.pontosBonus ? ` Bónus de boas-vindas: +${Math.round(c.pontosBonus)} pontos.` : ""}
            </p>
          </>
        )}
      </Section>

      {/* Histórico */}
      <Section title="Histórico deste cliente">
        {history.length === 0 ? (
          <p className="text-stone text-sm">Sem alterações registadas ainda.</p>
        ) : (
          <div className="relative pl-6 border-l-2 border-line space-y-3">
            {history.map((h) => {
              const ac = ActionColor(h.action);
              return (
                <div key={h.id} className="relative">
                  <span className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full border-2 border-paper" style={{ background: ac.color }} />
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono text-stone">{new Date(h.changed_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <Badge text={ac.text} color={ac.color} bg={ac.bg} />
                    <span className="text-stone">{h.changed_by_email || "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {showMessage && (
        <MessageComposer
          templates={messageTemplates}
          telefone={c.telefone}
          dados={{ ...dadosEmpresa(settings), cliente: c.nome || c.rede_social || "cliente", data: fmtDate(new Date().toISOString().slice(0, 10)) }}
          onClose={() => setShowMessage(false)}
        />
      )}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="bg-white border border-line rounded-xl p-5 mb-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
