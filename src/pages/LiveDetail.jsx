import { useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { getTestMode } from "../lib/testMode";
import { LIVE_ESTADO_COLORS, REGISTO_ESTADO_COLORS, SOCIAL_PLATFORM_OPTIONS } from "../lib/constants";
import { money, todayISO, uid, displaySku, fmtDate, dadosEmpresa } from "../lib/computations";
import { resolveLiveItem, liveItemLabel, liveItemStock, effectiveArticleId } from "../lib/liveHelpers";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, EmptyRow, inputCls } from "../components/ui";
import MessageComposer from "../components/MessageComposer";
import WaitlistRow from "../components/WaitlistRow";

export default function LiveDetail({ live, registos, clients, clientsComputed, articlesComputed, articleName, messageTemplates, onBack, onEdit, onOpenSale, loggedInOwner, settings }) {
  const notify = useToast();
  const confirm = useConfirm();
  const [clientModal, setClientModal] = useState(null); // { username, redeSocial }

  if (!live) return <div className="text-stone">Direto não encontrado. <button onClick={onBack} className="text-purple-600 underline">Voltar</button></div>;
  const ec = LIVE_ESTADO_COLORS[live.estado] || LIVE_ESTADO_COLORS["Preparação"];

  async function iniciar() {
    await updateRow("lives", live.id, { estado: "Em curso", posicao_atual: 0 });
    notify("Direto iniciado.");
  }
  async function finalizar() {
    const ok = await confirm({ title: "Finalizar direto?", message: "Deixas de poder adicionar novos registos — segue para a validação.", confirmLabel: "Finalizar" });
    if (!ok) return;
    await updateRow("lives", live.id, { estado: "Terminado" });
    notify("Direto finalizado — segue para a validação.");
  }
  async function mudarPosicao(pos) {
    await updateRow("lives", live.id, { posicao_atual: pos });
  }
  async function criarClientePara(username, redeSocial) {
    setClientModal({ username, redeSocial });
  }

  return (
    <div>
      <button onClick={onBack} className="text-stone text-xs mb-2.5">← Voltar aos diretos</button>
      <div className="flex justify-between items-start mb-4.5 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-xl font-semibold">{live.nome}</h1>
            <Badge text={live.estado} color={ec.color} bg={ec.bg} />
          </div>
          <p className="text-stone text-xs mt-1">
            <span className="font-mono">{live.codigo || "sem código"}</span> · {fmtDate(live.data)} · {live.hora_inicio || "—"}{live.hora_fim ? ` – ${live.hora_fim}` : ""} · {(live.redes_sociais || []).join(", ") || "sem rede definida"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onEdit(live)}>Editar preparação</Button>
          {live.estado === "Preparação" && <Button variant="primary" onClick={iniciar} disabled={!live.itens?.length}>▶ Iniciar direto</Button>}
          {live.estado === "Em curso" && <Button variant="primary" onClick={finalizar}>■ Finalizar direto</Button>}
        </div>
      </div>

      {live.estado === "Preparação" && <PrepSummary live={live} articleName={articleName} articlesComputed={articlesComputed} />}
      {live.estado === "Em curso" && (
        <SessionView live={live} registos={registos} clients={clients} articleName={articleName} articlesComputed={articlesComputed} onMudarPosicao={mudarPosicao} notify={notify} />
      )}
      {live.estado === "Terminado" && (
        <ValidationView live={live} registos={registos} clients={clients} clientsComputed={clientsComputed} articlesComputed={articlesComputed} articleName={articleName}
          onCreateClientFor={criarClientePara} notify={notify} confirm={confirm} onOpenSale={onOpenSale} messageTemplates={messageTemplates} loggedInOwner={loggedInOwner} />
      )}

      {clientModal && (
        <ClientQuickModal
          username={clientModal.username}
          redeSocial={clientModal.redeSocial}
          onClose={() => setClientModal(null)}
          onSave={async (values) => {
            const novo = await insertRow("clients", values);
            const needle = clientModal.username.trim().toLowerCase();
            const paraLigar = registos.filter((r) => !r.client_id && (r.username || "").trim().toLowerCase() === needle);
            for (const r of paraLigar) await updateRow("live_registos", r.id, { client_id: novo.id });
            notify("Cliente adicionado.");
            setClientModal(null);
          }}
        />
      )}
    </div>
  );
}

function PrepSummary({ live, articleName, articlesComputed }) {
  const [expandedId, setExpandedId] = useState(null);
  if (!live.itens?.length) return <div className="text-stone text-sm">Ainda sem artigos/conjuntos definidos — usa "Editar preparação" para os adicionar antes de iniciar.</div>;
  return (
    <div className="bg-white border border-line rounded-xl p-1">
      <table>
        <thead><tr><th>Ordem</th><th>Item</th><th>SKU</th><th>Stock</th><th>Preço atual</th><th>Preço de direto</th></tr></thead>
        <tbody>
          {live.itens.map((item, idx) => {
            if (item.tipo !== "conjunto") {
              const a = articlesComputed.find((x) => x.id === item.article_ids[0]);
              return (
                <tr key={item.id}>
                  <td className="font-mono text-stone">{idx + 1}º</td>
                  <td>👕 {articleName(item.article_ids[0])}</td>
                  <td className="font-mono text-[11px] text-stone">{a ? displaySku(a) : "—"}</td>
                  <td className={`font-mono ${(a?.stockAtual ?? 0) > 0 ? "" : "text-clay-dark"}`}>{a?.stockAtual ?? "—"}</td>
                  <td className="font-mono text-[11px] text-stone">{a ? money(a.valor_venda) : "—"}</td>
                  <td className="font-mono text-sage-dark font-medium">{money(item.preco_direto)}</td>
                </tr>
              );
            }
            const expanded = expandedId === item.id;
            return (
              <>
                <tr key={item.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : item.id)}>
                  <td className="font-mono text-stone">{idx + 1}º</td>
                  <td>{expanded ? "▾" : "▸"} 📦 {item.nome} ({item.article_ids.length} peças)</td>
                  <td className="font-mono text-[11px] text-stone">—</td>
                  <td className="font-mono text-stone">—</td>
                  <td className="font-mono text-[11px] text-stone">—</td>
                  <td className="font-mono text-sage-dark font-medium">{money(item.preco_direto)}</td>
                </tr>
                {expanded && item.article_ids.map((aid) => {
                  const a = articlesComputed.find((x) => x.id === aid);
                  return (
                    <tr key={aid} className="bg-paper">
                      <td></td>
                      <td className="pl-5">↳ 👕 {articleName(aid)}</td>
                      <td className="font-mono text-[11px] text-stone">{a ? displaySku(a) : "—"}</td>
                      <td className={`font-mono ${(a?.stockAtual ?? 0) > 0 ? "" : "text-clay-dark"}`}>{a?.stockAtual ?? "—"}</td>
                      <td className="font-mono text-[11px] text-stone">{a ? money(a.valor_venda) : "—"}</td>
                      <td></td>
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Em curso: registo rápido (avança pela ordem definida na preparação) ----------
function SessionView({ live, registos, clients, articleName, articlesComputed, onMudarPosicao, notify }) {
  const itens = live.itens || [];
  const posicao = Math.max(0, Math.min(live.posicao_atual || 0, itens.length - 1));
  const currentItem = itens[posicao];
  const [selecionados, setSelecionados] = useState([]); // acumula várias peças até "Registar" — [{ key, label, quantidade }]
  const [username, setUsername] = useState("");
  const [rede, setRede] = useState(live.redes_sociais?.[0] || "");
  const [busca, setBusca] = useState("");
  const multiRede = (live.redes_sociais || []).length > 1;

  const resultadosBusca = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    itens.forEach((item, idx) => {
      if (item.tipo === "conjunto") {
        item.article_ids.forEach((aid) => {
          const a = articlesComputed.find((x) => x.id === aid);
          if (a && ((a.sku || "").toLowerCase().includes(q) || a.artigo.toLowerCase().includes(q))) {
            out.push({ idx, key: `${item.id}::${aid}`, sku: displaySku(a), label: `${item.nome} — só ${a.artigo}` });
          }
        });
      } else {
        const a = articlesComputed.find((x) => x.id === item.article_ids[0]);
        if (a && ((a.sku || "").toLowerCase().includes(q) || a.artigo.toLowerCase().includes(q))) {
          out.push({ idx, key: item.id, sku: displaySku(a), label: a.artigo });
        }
      }
    });
    return out.slice(0, 8);
  }, [busca, itens, articlesComputed]);

  function isSelecionado(key) { return selecionados.some((s) => s.key === key); }
  function addSelecionado(key, label) {
    setSelecionados((prev) => prev.some((s) => s.key === key) ? prev : [...prev, { key, label, quantidade: 1 }]);
  }
  function toggleSelecionado(key, label) {
    setSelecionados((prev) => prev.some((s) => s.key === key) ? prev.filter((s) => s.key !== key) : [...prev, { key, label, quantidade: 1 }]);
  }
  function removeSelecionado(key) { setSelecionados((prev) => prev.filter((s) => s.key !== key)); }
  function setQtd(key, qtd) { setSelecionados((prev) => prev.map((s) => s.key === key ? { ...s, quantidade: Math.max(1, qtd) } : s)); }

  async function irPara(res) {
    await onMudarPosicao(res.idx);
    addSelecionado(res.key, res.label);
    setBusca("");
  }

  const normalizeHandle = (s) => (s || "").trim().toLowerCase().replace(/^@/, "");
  const clienteDetetado = useMemo(() => {
    const h = normalizeHandle(username);
    if (!h) return null;
    return clients.find((c) => normalizeHandle(c.rede_social) === h) || null;
  }, [username, clients]);

  if (!currentItem) return <div className="text-stone text-sm">Este direto não tem artigos/conjuntos definidos.</div>;
  const registosDoItem = registos.filter((r) => r.live_item_id === currentItem.id || r.live_item_id.startsWith(`${currentItem.id}::`));

  async function registar() {
    if (!username.trim() || selecionados.length === 0) return;
    let ordemBase = registos.length;
    for (const s of selecionados) {
      await insertRow("live_registos", {
        id: uid(), live_id: live.id, live_item_id: s.key, ordem: ordemBase++,
        quantidade: s.quantidade, quantidade_vendida: 0, username: username.trim(),
        client_id: clienteDetetado ? clienteDetetado.id : null,
        rede_social: multiRede ? rede : (live.redes_sociais?.[0] || ""), estado: "Por validar", sale_id: null,
      });
    }
    setSelecionados([]); setUsername("");
  }

  async function desfazerUltimo() {
    const mine = [...registos].sort((a, b) => a.ordem - b.ordem);
    const last = mine[mine.length - 1];
    if (!last) return;
    await deleteRow("live_registos", last.id);
  }

  async function apagarRegisto(id) {
    await deleteRow("live_registos", id);
  }

  return (
    <div>
      <div className="relative mb-2.5">
        <input className={inputCls} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Ir para SKU ou nome da peça… (adiciona à seleção)" />
        {resultadosBusca.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 bg-white border border-line rounded-md mt-1 shadow-2xl max-h-56 overflow-y-auto">
            {resultadosBusca.map((res) => (
              <div key={res.key} onClick={() => irPara(res)} className="px-2.5 py-1.5 text-xs cursor-pointer border-b border-line last:border-0 flex justify-between gap-2">
                <span>{isSelecionado(res.key) && "✓ "}{res.label}</span>
                <span className="font-mono text-stone text-[11px] whitespace-nowrap">{res.sku} · {res.idx + 1}º</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <Button variant="ghost" onClick={() => onMudarPosicao(posicao - 1)} disabled={posicao === 0}>◀ Anterior</Button>
        <div className="text-xs text-stone font-mono">{posicao + 1} de {itens.length}</div>
        <Button variant="ghost" onClick={() => onMudarPosicao(posicao + 1)} disabled={posicao === itens.length - 1}>Próximo ▶</Button>
      </div>

      <div className="bg-white border border-line rounded-xl p-3.5 mb-4">
        <div className="font-display text-lg font-semibold mb-1.5">
          {currentItem.tipo === "conjunto" ? `📦 ${currentItem.nome}` : `👕 ${liveItemLabel(currentItem, articleName)}`}
          <span className="font-mono text-sm text-sage-dark font-medium ml-2.5">direto: {money(currentItem.preco_direto)}</span>
        </div>

        {currentItem.tipo === "conjunto" ? (
          <div className="flex flex-col gap-1 mb-3">
            <SelecaoLinha selecionado={isSelecionado(currentItem.id)} onToggle={() => toggleSelecionado(currentItem.id, currentItem.nome)} label={`Conjunto inteiro (${currentItem.article_ids.length} peças)`} />
            {currentItem.article_ids.map((aid) => {
              const a = articlesComputed.find((x) => x.id === aid);
              const key = `${currentItem.id}::${aid}`;
              return (
                <SelecaoLinha key={aid} selecionado={isSelecionado(key)} onToggle={() => toggleSelecionado(key, `${currentItem.nome} — só ${articleName(aid)}`)}
                  label={`↳ só ${articleName(aid)}`} sub={a ? `${displaySku(a)} · stock: ${a.stockAtual} · atual: ${money(a.valor_venda)}` : ""} disabledStock={a && a.stockAtual <= 0} />
              );
            })}
          </div>
        ) : (
          (() => {
            const a = articlesComputed.find((x) => x.id === currentItem.article_ids[0]);
            return (
              <div className="mb-3">
                <SelecaoLinha selecionado={isSelecionado(currentItem.id)} onToggle={() => toggleSelecionado(currentItem.id, liveItemLabel(currentItem, articleName))}
                  label={liveItemLabel(currentItem, articleName)} sub={a ? `${displaySku(a)} · stock: ${a.stockAtual} · preço atual: ${money(a.valor_venda)}` : ""} disabledStock={a && a.stockAtual <= 0} />
              </div>
            );
          })()
        )}
      </div>

      <div className="bg-white border border-line rounded-xl p-3.5 mb-4">
        <div className="text-xs font-semibold mb-2">Seleção atual ({selecionados.length})</div>
        {selecionados.length === 0 && <div className="text-stone text-xs mb-2.5">Ainda não escolheste nenhuma peça — usa a pesquisa acima ou marca aqui em cima.</div>}
        {selecionados.map((s) => (
          <div key={s.key} className="flex items-center gap-2 px-2 py-1.5 bg-paper rounded-md mb-1.5">
            <span className="flex-1 text-xs">{s.label}</span>
            <input type="number" min="1" className={`${inputCls} w-14 py-1`} value={s.quantidade} onChange={(e) => setQtd(s.key, Number(e.target.value) || 1)} />
            <button type="button" onClick={() => removeSelecionado(s.key)} className="text-clay-dark">✕</button>
          </div>
        ))}
        <div className="flex gap-2 items-end flex-wrap mt-2">
          <Field label="Username / cliente">
            <input className={`${inputCls} min-w-[180px]`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" onKeyDown={(e) => e.key === "Enter" && registar()} />
          </Field>
          {username.trim() && (
            clienteDetetado
              ? <span className="text-[11px] text-sage-dark self-center mb-2">✓ cliente existente: {clienteDetetado.nome}</span>
              : <span className="text-[11px] text-stone self-center mb-2">cliente novo — cria-se ficha depois do direto</span>
          )}
          {multiRede && (
            <Field label="Rede"><select className={inputCls} value={rede} onChange={(e) => setRede(e.target.value)}>{live.redes_sociais.map((r) => <option key={r}>{r}</option>)}</select></Field>
          )}
          <Button variant="primary" onClick={registar} disabled={!username.trim() || selecionados.length === 0}>+ Registar seleção</Button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2">
        <div className="text-xs font-semibold">Registos deste item ({registosDoItem.length}) · total do direto: {registos.length}</div>
        <Button variant="ghost" onClick={desfazerUltimo} disabled={!registos.length}>↩ Desfazer último</Button>
      </div>
      <div className="bg-white border border-line rounded-xl">
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th>Item</th><th>Qtd</th><th>Rede</th><th></th></tr></thead>
          <tbody>
            {registosDoItem.length === 0 && <EmptyRow span={6} text="Ainda sem registos para este item." />}
            {[...registosDoItem].reverse().map((r) => {
              const item = resolveLiveItem(live, r.live_item_id);
              return (
                <tr key={r.id}>
                  <td className="font-mono text-stone">{r.ordem + 1}</td>
                  <td className="font-medium">{r.username}{r.client_id && <span title="Cliente já com ficha" className="ml-1">✓</span>}</td>
                  <td>{item ? (item._conjuntoNome ? `${item._conjuntoNome} — só ${liveItemLabel(item, articleName)}` : liveItemLabel(item, articleName)) : "—"}</td>
                  <td className="font-mono">{r.quantidade}</td>
                  <td>{r.rede_social || "—"}</td>
                  <td>
                    <button type="button" onClick={() => apagarRegisto(r.id)} title="Eliminar este registo" className="text-stone hover:text-clay-dark text-xs">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelecaoLinha({ selecionado, onToggle, label, sub, disabledStock }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
      <input type="checkbox" checked={selecionado} onChange={onToggle} />
      {label}
      {sub && <span className={`font-mono text-[11px] ${disabledStock ? "text-clay-dark" : "text-stone"}`}>{sub}</span>}
    </label>
  );
}

// ---------- Terminado: validação em duas etapas ----------
function ValidationView({ live, registos, clients, clientsComputed, articlesComputed, articleName, onCreateClientFor, notify, confirm, onOpenSale, messageTemplates, loggedInOwner }) {
  const ativos = registos.filter((r) => r.estado !== "Cancelado");
  const [messageFor, setMessageFor] = useState(null); // { registo, item }
  const usernamesEmFalta = [...new Map(
    ativos.filter((r) => !r.client_id).map((r) => [r.username.trim().toLowerCase(), r])
  ).values()];
  const step1Completo = usernamesEmFalta.length === 0;

  async function cancelarRegisto(id) {
    await updateRow("live_registos", id, { estado: "Cancelado" });
  }

  async function definirSubstituto(registoId, articleId) {
    await updateRow("live_registos", registoId, { artigo_substituto_id: articleId });
  }

  async function definirEstadoEspera(registoId, estado) {
    await updateRow("live_registos", registoId, { estado_lista_espera: estado });
  }

  // Processa um registo de CONJUNTO peça a peça — mas o preço aplicado depende de se o
  // conjunto é vendido completo ou não:
  //  · Conjunto completo (todas as peças com stock) → preço do conjunto (definido na
  //    preparação do direto), dividido proporcionalmente pelo valor individual de cada peça —
  //    para as contas/margens por artigo continuarem corretas, mas a soma bater com o preço
  //    combinado negociado para o conjunto.
  //  · Conjunto incompleto (falta stock nalguma peça) → cada peça vendida agora fica ao seu
  //    preço individual normal (já não é "o conjunto", são peças separadas), e a(s) que
  //    faltam ficam em lista de espera, para serem vendidas mais tarde também ao preço
  //    individual, tal como já acontece quando alguém pede só uma peça durante o direto.
  // Em ambos os casos, cada peça gera a sua própria venda — o stock de todas desce, nunca só
  // o da primeira. Reaproveita o mecanismo já existente de "peça dentro de um conjunto"
  // (live_item_id no formato "conjuntoId::articleId"), por isso a lista de espera, o
  // "🔁 Trocar artigo" e as mensagens já funcionam sem alterações.
  async function processarConjunto(registo, item) {
    const pecas = item.article_ids.map((articleId) => ({ articleId, article: articlesComputed.find((a) => a.id === articleId) }));
    const conjuntoCompleto = pecas.every(({ article }) => (article?.stockAtual ?? 0) >= registo.quantidade);

    // preços a atribuir a cada peça: se o conjunto sai completo, divide o preço do conjunto
    // proporcionalmente ao valor individual de cada peça (a última absorve o arredondamento,
    // para a soma bater sempre certo); caso contrário, cada peça ao seu preço normal.
    let precos;
    if (conjuntoCompleto) {
      const somaIndividual = pecas.reduce((s, { article }) => s + Number(article?.valor_venda || 0), 0);
      const precoConjunto = Number(item.preco_direto ?? somaIndividual);
      let somaAtribuida = 0;
      precos = pecas.map(({ article }, i) => {
        if (i === pecas.length - 1) return Math.round((precoConjunto - somaAtribuida) * 100) / 100;
        const peso = somaIndividual > 0 ? Number(article?.valor_venda || 0) / somaIndividual : 1 / pecas.length;
        const p = Math.round(precoConjunto * peso * 100) / 100;
        somaAtribuida += p;
        return p;
      });
    } else {
      precos = pecas.map(({ article }) => Number(article?.valor_venda || 0));
    }

    let vendidas = 0, emEspera = 0;
    for (let i = 0; i < pecas.length; i++) {
      const { articleId, article } = pecas[i];
      const stockPeca = article?.stockAtual ?? 0;
      if (stockPeca >= registo.quantidade) {
        const saleId = uid();
        const { error } = await supabase.rpc("save_sale", {
          p_id: saleId, p_codigo: null, p_article_id: articleId, p_quantidade: registo.quantidade,
          p_valor_venda: precos[i],
          p_quem_vendeu: loggedInOwner || "", p_client_id: registo.client_id,
          p_forma_pagamento: "", p_estado: "Aguarda pagamento", p_estado_envio: "Em Preparação",
          p_metodo_envio: null, p_codigo_envio: null, p_fatura: null, p_fatura_url: null, p_comprovativo_url: null,
          p_data_reserva: todayISO(), p_data_limite_reserva: null, p_data_pagamento: null, p_data_envio: null,
          p_data: todayISO(), p_notas: conjuntoCompleto ? `Direto: ${live.nome} (peça de "${item.nome}", conjunto)` : `Direto: ${live.nome} (peça de "${item.nome}")`, p_is_test: getTestMode(),
        });
        if (error) { notify(error.message.replace(/^.*save_sale: /, ""), "error"); continue; }
        await insertRow("live_registos", {
          id: uid(), live_id: live.id, live_item_id: `${item.id}::${articleId}`, ordem: registo.ordem,
          quantidade: registo.quantidade, quantidade_vendida: registo.quantidade, username: registo.username,
          client_id: registo.client_id, rede_social: registo.rede_social, estado: "Vendido", sale_id: saleId,
        });
        vendidas++;
      } else {
        await insertRow("live_registos", {
          id: uid(), live_id: live.id, live_item_id: `${item.id}::${articleId}`, ordem: registo.ordem,
          quantidade: registo.quantidade, quantidade_vendida: 0, username: registo.username,
          client_id: registo.client_id, rede_social: registo.rede_social, estado: "Lista de espera", sale_id: null,
        });
        emEspera++;
      }
    }
    await deleteRow("live_registos", registo.id); // substituído pelas peças acima
    if (conjuntoCompleto) notify("Conjunto vendido completo — preço do conjunto dividido pelas peças.");
    else if (vendidas > 0 && emEspera > 0) notify(`Conjunto dividido: ${vendidas} peça(s) vendida(s) ao preço individual, ${emEspera} em lista de espera.`);
    else if (vendidas > 0) notify("Peças vendidas ao preço individual.");
    else notify("Sem stock em nenhuma peça — todas ficaram em lista de espera.");
  }

  async function fazerVenda(registo, item, quantidadeAVender) {
    const articleId = effectiveArticleId(registo, item);
    if (quantidadeAVender <= 0 || !articleId) {
      await updateRow("live_registos", registo.id, { estado: "Lista de espera" });
      notify("Sem stock — registo em lista de espera.");
      return;
    }
    const article = articlesComputed.find((a) => a.id === articleId);
    const saleId = uid();
    const { error } = await supabase.rpc("save_sale", {
      p_id: saleId,
      p_codigo: null,
      p_article_id: articleId,
      p_quantidade: quantidadeAVender,
      p_valor_venda: item.preco_direto ?? article?.valor_venda ?? 0,
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
      p_notas: `Direto: ${live.nome}`,
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
    notify(restante > 0 ? `Vendidas ${quantidadeAVender}, restantes ${restante} em lista de espera.` : "Venda criada a partir do direto.");
  }

  const emEspera = ativos.filter((r) => r.estado === "Lista de espera");

  return (
    <div>
      {emEspera.length > 0 && (
        <div className="bg-white border border-plum/30 rounded-xl p-3.5 mb-4">
          <div className="text-xs font-semibold mb-2 text-purple-600">📋 Lista de espera ({emEspera.length})</div>
          <p className="text-stone text-xs mb-2.5">Acesso independente — não depende de teres criado todas as fichas de clientes em falta. Útil para voltar aqui mais tarde, quando o stock destas peças for reposto ou libertado.</p>
          <div className="overflow-auto">
            <table>
              <thead><tr><th>#</th><th>Cliente</th><th>Item</th><th>SKU / Stock</th><th>Qtd</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {emEspera.map((r) => {
                  const item = resolveLiveItem(live, r.live_item_id);
                  return (
                    <WaitlistRow key={r.id} r={r} live={live} item={item}
                      clients={clients} clientName={(id) => clients.find((c) => c.id === id)?.nome || "—"}
                      articlesComputed={articlesComputed} articleName={articleName} allArticles={articlesComputed}
                      onFazerVenda={fazerVenda} onCancelarRegisto={cancelarRegisto} onOpenSale={onOpenSale}
                      onSetSubstituto={definirSubstituto} onSetEstadoEspera={definirEstadoEspera}
                      onMessage={() => setMessageFor({ registo: r, item })} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white border border-line rounded-xl p-3.5 mb-4">
        <div className="text-xs font-semibold mb-2">1. Criar fichas de clientes em falta {step1Completo && <span className="text-sage-dark">✓ concluído</span>}</div>
        {step1Completo
          ? <div className="text-stone text-xs">Todos os registos já têm cliente associado.</div>
          : (
            <div className="flex flex-col gap-1.5">
              {usernamesEmFalta.map((r) => (
                <div key={r.username} className="flex items-center justify-between px-2.5 py-1.5 bg-paper rounded-md">
                  <span className="text-sm font-medium">{r.username} <span className="text-stone font-normal">({r.rede_social || "sem rede"})</span></span>
                  <Button onClick={() => onCreateClientFor(r.username, r.rede_social)}>+ Criar ficha de cliente</Button>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className={`text-xs font-semibold mb-2 ${step1Completo ? "" : "opacity-40"}`}>2. Validar registos e criar vendas</div>
      <div className={`bg-white border border-line rounded-xl ${step1Completo ? "" : "opacity-40 pointer-events-none"}`}>
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th>Item</th><th>SKU / Stock</th><th>Qtd</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {ativos.length === 0 && <EmptyRow span={7} text="Sem registos por validar." />}
            {ativos.map((r) => {
              const item = resolveLiveItem(live, r.live_item_id);
              const rc = REGISTO_ESTADO_COLORS[r.estado] || REGISTO_ESTADO_COLORS["Por validar"];
              const disponivel = item ? liveItemStock(item, articlesComputed) : 0;
              return (
                <ValidationRow key={r.id} r={r} item={item} disponivel={disponivel} rc={rc} clients={clients} articlesComputed={articlesComputed} articleName={articleName}
                  onFazerVenda={fazerVenda} onProcessarConjunto={processarConjunto} onCancelarRegisto={cancelarRegisto} onOpenSale={onOpenSale}
                  onMessage={() => setMessageFor({ registo: r, item })} />
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
            cliente: clients.find((c) => c.id === messageFor.registo.client_id)?.nome || messageFor.registo.username,
            artigo: messageFor.item ? (messageFor.item.tipo === "conjunto" ? messageFor.item.nome : articleName(messageFor.item.article_ids[0])) : "",
            quantidade: messageFor.registo.quantidade,
            valor: money(messageFor.item?.preco_direto || 0),
            codigo: live.codigo,
            direto: live.nome,
            data: fmtDate(live.data),
          }}
          onClose={() => setMessageFor(null)}
        />
      )}
    </div>
  );
}

function ValidationRow({ r, item, disponivel, rc, clients, articlesComputed, articleName, onFazerVenda, onProcessarConjunto, onCancelarRegisto, onOpenSale, onMessage }) {
  const [parcial, setParcial] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const podeValidar = r.estado === "Por validar" || r.estado === "Lista de espera";
  const ehConjuntoInteiro = item?.tipo === "conjunto";
  const artigoUnico = !ehConjuntoInteiro && item ? articlesComputed.find((a) => a.id === item.article_ids[0]) : null;
  const nomeCliente = clients.find((c) => c.id === r.client_id)?.nome || "—";
  const pecasComStock = ehConjuntoInteiro
    ? item.article_ids.filter((aid) => (articlesComputed.find((a) => a.id === aid)?.stockAtual ?? 0) >= r.quantidade).length
    : 0;
  return (
    <>
      <tr>
        <td className="font-mono text-stone">{r.ordem + 1}</td>
        <td className="font-medium">{nomeCliente}</td>
        <td>{item ? (item._conjuntoNome ? `${item._conjuntoNome} — só ${liveItemLabel(item, articleName)}` : liveItemLabel(item, articleName)) : "—"}</td>
        <td className="font-mono text-[11px]">
          {ehConjuntoInteiro ? (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="text-purple-600 text-[11px]">{expanded ? "▾ esconder peças" : "▸ ver peças"}</button>
          ) : artigoUnico ? (
            <span className={artigoUnico.stockAtual > 0 ? "text-stone" : "text-clay-dark"}>{displaySku(artigoUnico)} · stock: {artigoUnico.stockAtual} · atual: {money(artigoUnico.valor_venda)}</span>
          ) : "—"}
        </td>
        <td className="font-mono">{r.quantidade}{r.quantidade_vendida ? <span className="text-stone text-[11px]"> (+{r.quantidade_vendida} já vendidas)</span> : ""}</td>
        <td><Badge text={r.estado} color={rc.color} bg={rc.bg} /></td>
        <td>
          {podeValidar && item && (
            ehConjuntoInteiro ? (
              pecasComStock === item.article_ids.length ? (
                <Button onClick={() => onProcessarConjunto(r, item)}>Fazer nova venda</Button>
              ) : pecasComStock > 0 ? (
                <Button variant="ghost" onClick={() => onProcessarConjunto(r, item)}>🔀 Dividir por peça ({pecasComStock}/{item.article_ids.length} disponíveis)</Button>
              ) : (
                <Button variant="ghost" onClick={() => onProcessarConjunto(r, item)}>Sem stock — lista de espera</Button>
              )
            ) : (
              disponivel >= r.quantidade ? (
                <Button onClick={() => onFazerVenda(r, item, r.quantidade)}>Fazer nova venda</Button>
              ) : disponivel > 0 ? (
                parcial === null ? (
                  <Button variant="ghost" onClick={() => setParcial(disponivel)}>⚠ Só há {disponivel} de {r.quantidade} — decidir</Button>
                ) : (
                  <div className="flex gap-1.5 items-center">
                    <input type="number" min="0" max={disponivel} className={`${inputCls} w-14 py-1`} value={parcial} onChange={(e) => setParcial(Math.max(0, Math.min(disponivel, Number(e.target.value))))} />
                    <Button variant="primary" onClick={() => onFazerVenda(r, item, parcial)}>Confirmar</Button>
                  </div>
                )
              ) : (
                <Button variant="ghost" onClick={() => onFazerVenda(r, item, 0)}>Sem stock — lista de espera</Button>
              )
            )
          )}
          {r.sale_id && (
            <button onClick={() => onOpenSale?.(r.sale_id)} className="text-sage-dark text-xs underline decoration-sage/40 hover:decoration-sage" title="Abrir esta venda">
              ✓ venda criada — ver venda ↗
            </button>
          )}
          {r.client_id && (
            <button onClick={onMessage} title="Enviar mensagem ao cliente" className="ml-2 text-purple-600 text-xs">✉️</button>
          )}
          {podeValidar && (
            <button onClick={() => onCancelarRegisto(r.id)} title="Cancelar registo" className="ml-2 text-stone text-xs">✕</button>
          )}
        </td>
      </tr>
      {ehConjuntoInteiro && expanded && item.article_ids.map((aid) => {
        const a = articlesComputed.find((x) => x.id === aid);
        return (
          <tr key={aid} className="bg-paper">
            <td></td><td></td>
            <td className="pl-2.5 text-xs text-stone">↳ {a?.artigo || "—"}</td>
            <td className={`font-mono text-[11px] ${(a?.stockAtual ?? 0) > 0 ? "text-stone" : "text-clay-dark"}`}>{a ? `${displaySku(a)} · stock: ${a.stockAtual}` : "—"}</td>
            <td></td><td></td><td></td>
          </tr>
        );
      })}
    </>
  );
}

function ClientQuickModal({ username, redeSocial, onClose, onSave }) {
  const [nome, setNome] = useState("");
  const [rs, setRs] = useState(username);
  const [plataforma, setPlataforma] = useState(redeSocial || "Instagram");
  const [error, setError] = useState("");
  return (
    <ModalShell title="Nova ficha de cliente" subtitle={`A partir do username "${username}" registado no direto.`} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
        <Field label="Plataforma (rede social)">
          <select className={inputCls} value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
            {SOCIAL_PLATFORM_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <div className="mb-4">
        <Field label="Utilizador / rede social"><input className={inputCls} value={rs} onChange={(e) => setRs(e.target.value)} /></Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-2 mb-3">{error}</p>}
      <ModalActions
        onClose={onClose}
        onSave={async () => {
          if (!nome.trim()) { setError("Indica o nome do cliente."); return; }
          return onSave({ id: uid(), nome: nome.trim(), plataforma, rede_social: rs, pontos_bonus: 50 });
        }}
        label="Criar ficha"
      />
    </ModalShell>
  );
}
