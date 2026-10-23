import { useState, useEffect } from "react";
import { updateRow, useAuditLogForRecord } from "../lib/useRealtimeTable";
import { money, pct, fmtDate, displaySku } from "../lib/computations";
import { CONTENT_STATUS_COLORS, CONTENT_NETWORK_COLORS, ARTICLE_ESTADO_COLORS, tipoTemTamanho, FAMILIAS_MEDIDAS, familiaMedidasDoTipo } from "../lib/constants";
import { useToast } from "../lib/overlays";
import { Badge, Card, inputCls, TagBadge } from "../components/ui";

function ActionColor(action) {
  if (action === "insert") return { text: "criado", color: "#254238", bg: "#DCEBE4" };
  if (action === "delete") return { text: "eliminado", color: "#7A2A24", bg: "#F5D9D6" };
  return { text: "editado", color: "#A67C1E", bg: "#F5EADD" };
}

export default function ArticleDetail({
  articleId, articlesComputed, suppliers, purchases, purchaseItems, sales, contentItems, supplierName, clientName, tipos,
  onBack, onEdit, onDuplicate, onNewSize, onRegisterSale, onRegisterPurchase, onNewContent, onViewAllContent, onOpenClient, onOpenSale,
}) {
  const a = articlesComputed.find((x) => x.id === articleId);
  const { rows: history } = useAuditLogForRecord("articles", articleId);
  const notify = useToast();
  const [notas, setNotas] = useState(a?.notas || "");
  const [savingNotas, setSavingNotas] = useState(false);

  useEffect(() => { setNotas(a?.notas || ""); }, [a?.id]);

  if (!a) {
    return (
      <div>
        <button onClick={onBack} className="text-sm text-stone underline mb-4">← Voltar aos artigos</button>
        <p className="text-stone">Este artigo já não existe (foi eliminado).</p>
      </div>
    );
  }

  const historicoCompras = (purchaseItems || [])
    .filter((it) => it.article_id === a.id)
    .map((it) => ({ ...it, compra: purchases.find((p) => p.id === it.purchase_id) }))
    .filter((it) => it.compra)
    .sort((x, y) => (y.compra.data || "").localeCompare(x.compra.data || ""));
  const vendasArtigo = sales.filter((s) => s.article_id === a.id).sort((x, y) => (y.data || "").localeCompare(x.data || ""));
  const vendasPagas = vendasArtigo.filter((s) => s.estado === "Pago");
  const reservas = vendasArtigo.filter((s) => s.estado === "Aguarda pagamento");
  const custoUnitComIVA = Number(a.preco_unitario || 0) * (1 + Number(a.iva || 0) / 100);
  const lucroRealizado = vendasPagas.reduce((sum, s) => sum + (Number(s.valor_venda || 0) - custoUnitComIVA * Number(s.quantidade || 0)), 0);
  const conteudos = (contentItems || []).filter((c) => c.article_id === a.id).sort((x, y) => (y.data_publicacao || "").localeCompare(x.data_publicacao || ""));

  async function saveNotas() {
    setSavingNotas(true);
    try {
      await updateRow("articles", a.id, { notas });
      notify("Notas guardadas.");
    } catch (err) {
      notify("Não foi possível guardar as notas.", "error");
    } finally {
      setSavingNotas(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-stone underline mb-4">← Voltar aos artigos</button>

      {/* Cabeçalho */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5 flex flex-col sm:flex-row gap-5">
        {a.foto_url ? (
          <img src={a.foto_url} alt="" className="w-full sm:w-40 h-40 object-cover rounded-lg border border-line flex-shrink-0" />
        ) : (
          <div className="w-full sm:w-40 h-40 rounded-lg bg-line/30 flex items-center justify-center text-stone text-sm flex-shrink-0">Sem foto</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-semibold">{a.artigo}</h1>
                {a.favorito && <span className="text-gold-500 text-lg" title="Favorito">★</span>}
                {a.etiqueta && <TagBadge value={a.etiqueta} />}
              </div>
              <p className="text-stone text-sm font-mono mt-0.5">{displaySku(a) || "sem SKU"} · {a.tipo || "—"} · {a.cor || "—"}{a.padrao && a.padrao !== "Liso" ? ` (${a.padrao})` : ""}{a.tamanho ? ` · Tamanho ${a.tamanho}` : ""}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => onEdit(a)} className="text-xs font-medium bg-white border border-line rounded px-3 py-1.5 text-ink">Editar</button>
              <button onClick={() => onDuplicate(a)} className="text-xs font-medium bg-white border border-line rounded px-3 py-1.5 text-ink">⎘ Duplicar</button>
              {tipoTemTamanho(a.tipo, tipos) && (
                <button onClick={() => onNewSize(a)} className="text-xs font-medium bg-white border border-line rounded px-3 py-1.5 text-ink">📏 Novo tamanho</button>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            <Badge text={a.owner} color={a.owner === "Rosa" ? "#832F72" : "#A67C1E"} bg={a.owner === "Rosa" ? "#F7E3F2" : "#F5EADD"} />
            <Badge text={a.publicado ? "Publicado" : "Não publicado"} color={a.publicado ? "#254238" : "#8A8677"} bg={a.publicado ? "#DCEBE4" : "#F1EDE3"} />
            <Badge text={a.etiquetado ? "🏷️ Etiquetado" : "Não etiquetado"} color={a.etiquetado ? "#254238" : "#8A8677"} bg={a.etiquetado ? "#DCEBE4" : "#F1EDE3"} />
            {(() => { const ec = ARTICLE_ESTADO_COLORS[a.estado] || ARTICLE_ESTADO_COLORS["Em stock"]; return <Badge text={a.estado || "Em stock"} color={ec.color} bg={ec.bg} />; })()}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Card label="Stock atual" value={a.stockAtual} color={a.stockAtual <= 3 ? "#7A2A24" : "#1C2541"} />
        <Card label="Preço médio (compras)" value={money(a.preco_medio)} color="#1C2541" />
        <Card label="Valor de venda" value={money(a.valor_venda)} color="#1C2541" />
        <Card label={`Margem (${pct(a.margemPct)})`} value={money(a.margemUnit)} color={a.margemUnit >= 0 ? "#254238" : "#7A2A24"} />
        <Card label="Lucro realizado (vendas pagas)" value={money(lucroRealizado)} color="#254238" />
      </div>

      {/* Histórico de compras */}
      <Section
        title={`Histórico de compras (${historicoCompras.length})`}
        action={onRegisterPurchase && <button onClick={() => onRegisterPurchase(a.id)} className="text-xs font-medium text-purple-600 underline">+ Registar compra</button>}
      >
        {historicoCompras.length === 0 ? (
          <p className="text-stone text-sm">Ainda sem compras registadas para este artigo — a quantidade e o preço unitário ficam a 0 até à primeira compra ficar "Concluída".</p>
        ) : (
          <div className="overflow-auto">
            <table>
              <thead><tr><th>Código</th><th>Data</th><th>Fornecedor</th><th>Referência</th><th>Qtd</th><th>Custo unit.</th><th>Fatura</th><th>Estado</th></tr></thead>
              <tbody>
                {historicoCompras.map((it) => (
                  <tr key={it.id}>
                    <td className="font-mono text-xs">{it.compra.codigo || "—"}</td>
                    <td className="font-mono text-xs text-stone">{fmtDate(it.compra.data)}</td>
                    <td>{supplierName(it.compra.supplier_id)}</td>
                    <td className="font-mono text-xs text-stone">{it.referencia || "—"}</td>
                    <td className="font-mono">{it.quantidade}</td>
                    <td className="font-mono text-xs">{money(it.valor_unitario)}</td>
                    <td className="text-stone text-xs">
                      {it.compra.fatura || "—"}
                      {it.compra.fatura_url && <a href={it.compra.fatura_url} target="_blank" rel="noreferrer" className="text-purple-600 underline ml-1">ver 📎</a>}
                    </td>
                    <td className="text-stone text-xs">{it.compra.estado || "Reservado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Ficha para o site */}
      {!a.uso_interno && (() => {
        const fam = FAMILIAS_MEDIDAS[familiaMedidasDoTipo(a.tipo, tipos)];
        const irmaos = articlesComputed.filter((x) => x.sku === a.sku && !x.deleted_at);
        const vazio = <span className="text-stone">—</span>;
        return (
          <Section title="🌐 Ficha para o site" action={<button onClick={() => onEdit(a)} className="text-xs font-medium text-purple-600 underline">Editar</button>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-3">
              <div><p className="text-xs text-stone">Publicar no site</p>{a.publicar_site ? <span className="text-sage-dark">✓ Sim</span> : <span className="text-stone">Não</span>}</div>
              <div><p className="text-xs text-stone">Escolha</p>{a.escolha ? (a.escolha === "Das duas" ? "Das duas" : `Da ${a.escolha}`) : vazio}</div>
              <div />
              <div><p className="text-xs text-stone">Composição</p>{a.composicao || vazio}</div>
              <div><p className="text-xs text-stone">Cuidados de lavagem</p>{a.cuidados || vazio}</div>
              <div><p className="text-xs text-stone">Porque a escolhemos</p>{a.porque_escolhemos || vazio}</div>
            </div>
            {fam && (
              <div className="overflow-auto">
                <p className="text-xs text-stone mb-1">Medidas em cm — {fam.label}</p>
                <table>
                  <thead><tr><th>Tamanho</th>{fam.campos.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
                  <tbody>
                    {irmaos.sort((x, y) => String(x.tamanho || "").localeCompare(String(y.tamanho || ""), "pt", { numeric: true })).map((x) => (
                      <tr key={x.id}><td className="font-mono text-xs">{x.tamanho || "—"}</td>{fam.campos.map(([k]) => <td key={k}>{x.medidas?.[k] !== undefined && x.medidas?.[k] !== "" ? String(x.medidas[k]).replace(".", ",") : "—"}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        );
      })()}

      {/* Notas */}
      <Section title="Notas">
        <textarea
          rows={3}
          className={inputCls}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas internas sobre este artigo…"
        />
        {notas !== (a.notas || "") && (
          <button onClick={saveNotas} disabled={savingNotas} className="mt-2 text-xs font-medium bg-rust text-white rounded px-3 py-1.5 disabled:opacity-50">
            {savingNotas ? "A guardar…" : "Guardar notas"}
          </button>
        )}
      </Section>

      {/* Vendas & Reservas */}
      <Section
        title={`Vendas & Reservas (${vendasArtigo.length})`}
        action={<button onClick={() => onRegisterSale(a.id)} className="text-xs font-medium text-purple-600 underline">+ Registar venda</button>}
      >
        {vendasArtigo.length === 0 ? (
          <p className="text-stone text-sm">Ainda sem vendas registadas.</p>
        ) : (
          <div className="overflow-auto">
            <table>
              <thead><tr><th>Código</th><th>Data</th><th>Cliente</th><th>Qtd</th><th>Valor</th><th>Pagamento</th><th>Envio</th></tr></thead>
              <tbody>
                {vendasArtigo.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">
                      {onOpenSale ? (
                        <button type="button" onClick={() => onOpenSale(s.id)} className="text-ink underline decoration-line hover:decoration-rust">
                          {s.codigo || "ver venda"}
                        </button>
                      ) : (s.codigo || "—")}
                    </td>
                    <td className="font-mono text-xs text-stone">{fmtDate(s.data)}</td>
                    <td>
                      {onOpenClient && s.client_id ? (
                        <button type="button" onClick={() => onOpenClient(s.client_id)} className="text-ink underline decoration-line hover:decoration-rust">
                          {clientName ? clientName(s.client_id) : "—"}
                        </button>
                      ) : (clientName ? clientName(s.client_id) : "—")}
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reservas.length > 0 && (
          <p className="text-clay-dark text-xs mt-2 font-medium">⚠ {reservas.length} reserva(s) por pagar deste artigo.</p>
        )}
      </Section>

      {/* Publicações */}
      <Section
        title={`Publicações (${conteudos.length})`}
        action={
          <div className="flex gap-3">
            <button onClick={() => onNewContent(a.id)} className="text-xs font-medium text-purple-600 underline">+ Nova publicação</button>
            {conteudos.length > 0 && <button onClick={() => onViewAllContent(a.id)} className="text-xs font-medium text-purple-600 underline">Ver no Centro de Conteúdo</button>}
          </div>
        }
      >
        {conteudos.length === 0 ? (
          <p className="text-stone text-sm">Ainda sem publicações no Centro de Conteúdo.</p>
        ) : (
          <div className="space-y-2">
            {conteudos.map((c) => {
              const sc = CONTENT_STATUS_COLORS[c.estado] || CONTENT_STATUS_COLORS["Por fotografar"];
              const nc = c.rede ? CONTENT_NETWORK_COLORS[c.rede] : null;
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm border-b border-line last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge text={c.estado || "Por fotografar"} color={sc.color} bg={sc.bg} />
                    {nc && <Badge text={c.rede} color={nc.color} bg={nc.bg} />}
                    <span className="text-stone text-xs">{c.data_publicacao ? fmtDate(c.data_publicacao) : "sem data"}</span>
                  </div>
                  {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="text-purple-600 underline text-xs">Abrir ↗</a>}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Histórico */}
      <Section title="Histórico deste artigo">
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
