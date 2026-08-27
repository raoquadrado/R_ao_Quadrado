import { todayISO, dataLimiteTroca } from "./computations";
import { OWNERS, ARTICLE_ESTADOS_SEM_ALERTA, DEFAULT_SETTINGS, tipoEntryFor } from "./constants";
import { gerarSugestoesPreco } from "./priceSuggestions";

const toISO = (d) => d.toISOString().slice(0, 10);

export function getPeriodRange(key, customStart, customEnd) {
  const now = new Date();
  if (key === "today") { const s = toISO(now); return { start: s, end: s }; }
  if (key === "week") {
    const day = now.getDay() || 7;
    const monday = new Date(now); monday.setDate(now.getDate() - day + 1);
    return { start: toISO(monday), end: toISO(now) };
  }
  if (key === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toISO(first), end: toISO(now) };
  }
  if (key === "year") {
    const first = new Date(now.getFullYear(), 0, 1);
    return { start: toISO(first), end: toISO(now) };
  }
  if (key === "custom") return { start: customStart || toISO(now), end: customEnd || toISO(now) };
  return { start: "0001-01-01", end: "9999-12-31" };
}

function prevPeriodRange(range) {
  const start = new Date(range.start + "T00:00:00");
  const end = new Date(range.end + "T00:00:00");
  const lengthMs = Math.max(end - start, 0);
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);
  return { start: toISO(prevStart), end: toISO(prevEnd) };
}

const inRange = (date, range) => date && date >= range.start && date <= range.end;

export function pctDelta(curr, prev) {
  if (!prev) return curr > 0 ? 100 : curr < 0 ? -100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function tipoGroup(tipo, tipos) {
  return tipoEntryFor(tipo, tipos)?.grupo || "Outro";
}

/**
 * Calcula tudo o que o painel precisa: KPIs (com variação face ao
 * período anterior equivalente), dados para os 6 gráficos, listas
 * rápidas e alertas — já filtrado por período e por owner.
 */
export function computeFullDashboard({ articles, articlesComputed, purchases, purchaseItems, sales, suppliers, clients, clientsComputed, lives, liveRegistos, exchanges, contentItems, encomendas, embalagemConsumos, etiquetaConsumos, gastosDiversos, movimentosCapital, periodKey, customStart, customEnd, owner, settings, tipos }) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const range = getPeriodRange(periodKey, customStart, customEnd);
  const prevRange = prevPeriodRange(range);
  const ownerFilter = owner && owner !== "Todos" ? owner : null;

  const articlesF = ownerFilter ? articlesComputed.filter((a) => a.owner === ownerFilter) : articlesComputed;
  // Distinção pedida: KPIs de "stock" e "unidades" (linhas 1 e 2) passam a olhar só para
  // artigos vendáveis — o material interno (etiquetas, caixas, sacos…) tem os seus
  // próprios KPIs e alertas mais abaixo, para não misturar valores de negócio (venda,
  // margem) com material de apoio que nunca é vendido.
  const articlesVendaveis = articlesF.filter((a) => !a.uso_interno);
  const articlesInternos = articlesF.filter((a) => a.uso_interno);
  const purchasesAll = ownerFilter ? purchases.filter((p) => p.quem_comprou === ownerFilter) : purchases;
  const salesAll = ownerFilter ? sales.filter((s) => s.quem_vendeu === ownerFilter) : sales;
  const gastosDiversosAll = (ownerFilter ? (gastosDiversos || []).filter((g) => g.owner === ownerFilter) : (gastosDiversos || [])).filter((g) => !g.deleted_at);

  const purchasesCur = purchasesAll.filter((p) => inRange(p.data, range));
  const purchasesPrev = purchasesAll.filter((p) => inRange(p.data, prevRange));
  const salesCur = salesAll.filter((s) => inRange(s.data, range));
  const salesPrev = salesAll.filter((s) => inRange(s.data, prevRange));
  const gastosDiversosCur = gastosDiversosAll.filter((g) => inRange(g.data, range));
  const gastosDiversosPrev = gastosDiversosAll.filter((g) => inRange(g.data, prevRange));

  const sum = (arr, fn) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
  const purchaseValue = (p) => Number(p.valor_aquisicao || 0) - Number(p.desconto || 0);
  const custoUnitComIVA = (articleId) => {
    const a = articlesComputed.find((x) => x.id === articleId);
    return a ? a.preco_unitario * (1 + (Number(a.iva) || 0) / 100) : 0;
  };
  const lucroDeVendas = (arr) => sum(arr, (s) => Number(s.valor_venda || 0) - custoUnitComIVA(s.article_id) * Number(s.quantidade || 0));

  // ---------- linha 1: valores de stock (só artigos vendáveis) ----------
  const investido = sum(articlesVendaveis, (a) => a.valorTotalSemIVA);
  const valorAtualStock = sum(articlesVendaveis, (a) => a.valorStockSemIVA);
  const valorPotencialVenda = sum(articlesVendaveis, (a) => a.stockAtual * a.valor_venda);
  const lucroPotencial = valorPotencialVenda - valorAtualStock;

  // ---------- linha 2: unidades (só artigos vendáveis) ----------
  const totalArtigos = articlesVendaveis.length;
  const unidadesDisponiveis = sum(articlesVendaveis, (a) => Math.max(a.stockAtual, 0));
  const unidadesReservadas = sum(articlesVendaveis, (a) => a.reservedQty);
  const unidadesVendidas = sum(articlesVendaveis, (a) => a.soldQty);

  // ---------- linha 3: negócio ----------
  const nClientes = clients.length;
  const nFornecedores = suppliers.length;
  const comprasMes = sum(purchasesCur, purchaseValue);
  const comprasMesPrev = sum(purchasesPrev, purchaseValue);
  const vendasMes = sum(salesCur, (s) => s.valor_venda);
  const vendasMesPrev = sum(salesPrev, (s) => s.valor_venda);

  const kpis = {
    row1: [
      { key: "investido", icon: "💰", label: "Valor investido em stock", value: investido, kind: "money" },
      { key: "atual", icon: "🏬", label: "Valor atual do stock (custo)", value: valorAtualStock, kind: "money" },
      { key: "potencial", icon: "🏷️", label: "Valor potencial de venda", value: valorPotencialVenda, kind: "money" },
      { key: "lucro", icon: "📈", label: "Lucro potencial", value: lucroPotencial, kind: "money" },
    ],
    row2: [
      { key: "total", icon: "📦", label: "Total de artigos", value: totalArtigos, kind: "int" },
      { key: "disp", icon: "✅", label: "Artigos disponíveis", value: unidadesDisponiveis, kind: "int", suffix: " un." },
      { key: "res", icon: "⏳", label: "Artigos reservados", value: unidadesReservadas, kind: "int", suffix: " un." },
      { key: "vend", icon: "🛍️", label: "Artigos vendidos", value: unidadesVendidas, kind: "int", suffix: " un." },
    ],
    row3: [
      { key: "clientes", icon: "👥", label: "Nº de clientes", value: nClientes, kind: "int" },
      { key: "forn", icon: "🚚", label: "Nº de fornecedores", value: nFornecedores, kind: "int" },
      { key: "comprasMes", icon: "🛒", label: "Compras (período)", value: comprasMes, prev: comprasMesPrev, kind: "money" },
      { key: "vendasMes", icon: "🧾", label: "Vendas (período)", value: vendasMes, prev: vendasMesPrev, kind: "money" },
    ],
  };
  kpis.row3[2].delta = pctDelta(comprasMes, comprasMesPrev);
  kpis.row3[3].delta = pctDelta(vendasMes, vendasMesPrev);

  // ---------- linha financeira: recebido / por receber / lucro realizado ----------
  const salesCurPagas = salesCur.filter((s) => s.estado === "Pago");
  const salesPrevPagas = salesPrev.filter((s) => s.estado === "Pago");
  const recebidoPeriodo = sum(salesCurPagas, (s) => s.valor_venda);
  const recebidoPeriodoPrev = sum(salesPrevPagas, (s) => s.valor_venda);
  const gastosDiversosPeriodo = sum(gastosDiversosCur, (g) => g.valor);
  const gastosDiversosPeriodoPrev = sum(gastosDiversosPrev, (g) => g.valor);
  const lucroRealizadoPeriodo = lucroDeVendas(salesCurPagas) - gastosDiversosPeriodo;
  const lucroRealizadoPeriodoPrev = lucroDeVendas(salesPrevPagas) - gastosDiversosPeriodoPrev;
  // "Por receber" é um saldo em aberto (não um fluxo do período): reservas por pagar + peças não pagas, sempre até hoje.
  const porReceber = sum(salesAll.filter((s) => s.estado === "Aguarda pagamento" || s.estado === "Não pago"), (s) => s.valor_venda);

  const financas = [
    { key: "recebido", icon: "💶", label: "Recebido (período)", value: recebidoPeriodo, prev: recebidoPeriodoPrev, kind: "money" },
    { key: "porReceber", icon: "⏳", label: "Por receber", value: porReceber, kind: "money" },
    { key: "gastosDiversos", icon: "💸", label: "Gastos diversos (período)", value: gastosDiversosPeriodo, prev: gastosDiversosPeriodoPrev, kind: "money" },
    { key: "lucroRealizado", icon: "📊", label: "Lucro realizado (período)", value: lucroRealizadoPeriodo, prev: lucroRealizadoPeriodoPrev, kind: "money" },
  ];
  financas[0].delta = pctDelta(recebidoPeriodo, recebidoPeriodoPrev);
  financas[3].delta = pctDelta(lucroRealizadoPeriodo, lucroRealizadoPeriodoPrev);

  // ---------- Saldo em Caixa ----------
  // Diferente do Lucro (rentabilidade, por período): é um saldo acumulado desde sempre —
  // quanto dinheiro há disponível agora. Sempre conjunto (Rosa + Rita), nunca filtrado por
  // owner nem por período, mesmo que o resto do Painel esteja.
  const movimentosCapitalTodos = (movimentosCapital || []).filter((m) => !m.deleted_at);
  const totalEntradasCapital = sum(movimentosCapitalTodos.filter((m) => m.tipo === "Entrada"), (m) => m.valor);
  const totalSaidasCapital = sum(movimentosCapitalTodos.filter((m) => m.tipo === "Saída"), (m) => m.valor);
  const totalVendasPagasSempre = sum(sales.filter((s) => s.estado === "Pago"), (s) => s.valor_venda);
  const totalComprasSempre = sum(purchases, purchaseValue);
  const totalGastosDiversosSempre = sum((gastosDiversos || []).filter((g) => !g.deleted_at), (g) => g.valor);
  const saldoEmCaixa = totalEntradasCapital - totalSaidasCapital + totalVendasPagasSempre - totalComprasSempre - totalGastosDiversosSempre;
  financas.push({ key: "saldoEmCaixa", icon: "🏦", label: "Saldo em Caixa", value: saldoEmCaixa, kind: "money" });

  // ---------- pulso: hoje / esta semana / este mês (independente do filtro de período) ----------
  const pulseRanges = { hoje: getPeriodRange("today"), semana: getPeriodRange("week"), mes: getPeriodRange("month") };
  const pulse = {};
  for (const [key, r] of Object.entries(pulseRanges)) {
    const p = purchasesAll.filter((x) => inRange(x.data, r));
    const s = salesAll.filter((x) => inRange(x.data, r));
    pulse[key] = { compras: sum(p, purchaseValue), vendas: sum(s, (x) => x.valor_venda), lucro: lucroDeVendas(s) };
  }

  // ---------- saúde do negócio (todo o histórico, respeita filtro de owner) ----------
  const receitaTotal = sum(salesAll, (s) => s.valor_venda);
  const custoTotalVendido = sum(salesAll, (s) => custoUnitComIVA(s.article_id) * Number(s.quantidade || 0));
  const ticketMedio = salesAll.length ? receitaTotal / salesAll.length : 0;
  const margemMedia = receitaTotal > 0 ? ((receitaTotal - custoTotalVendido) / receitaTotal) * 100 : 0;

  const purchaseById = {};
  purchases.forEach((p) => { purchaseById[p.id] = p; });
  // Data de aquisição de um artigo = data da PRIMEIRA compra "Concluída" que teve um
  // item deste artigo (o stock só entra no artigo quando a compra fica concluída, por
  // isso só essas contam como "aquisição" real). Sem compras concluídas ainda, cai
  // para a data de criação do artigo.
  const primeiraCompraPorArtigo = {};
  (purchaseItems || []).forEach((pi) => {
    const p = purchaseById[pi.purchase_id];
    if (!p?.data || p.estado !== "Concluída") return;
    const atual = primeiraCompraPorArtigo[pi.article_id];
    if (!atual || p.data < atual) primeiraCompraPorArtigo[pi.article_id] = p.data;
  });
  const vendasConcluidas = salesAll.filter((s) => s.estado === "Pago");
  const temposDeVenda = vendasConcluidas.map((s) => {
    const artigo = articlesComputed.find((a) => a.id === s.article_id);
    if (!artigo || !s.data) return null;
    const dataAquisicao = primeiraCompraPorArtigo[s.article_id] || (artigo.created_at || "").slice(0, 10);
    if (!dataAquisicao) return null;
    const dias = (new Date(s.data) - new Date(dataAquisicao)) / 86400000;
    return dias >= 0 ? dias : null;
  }).filter((d) => d !== null);
  const tempoMedioVenda = temposDeVenda.length ? temposDeVenda.reduce((a, b) => a + b, 0) / temposDeVenda.length : null;

  const artigosSemFotoCount = articlesF.filter((a) => !a.foto_url && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)).length;
  const artigosSemEtiquetaCount = articlesF.filter((a) => !a.etiquetado && !a.uso_interno && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)).length;
  const artigosPublicados = articlesF.filter((a) => a.publicado).length;
  const artigosPorPublicar = articlesF.filter((a) => !a.publicado && !a.uso_interno && a.stockAtual > 0).length;

  const saude = [
    { key: "ticket", icon: "🎫", label: "Ticket médio", value: ticketMedio, kind: "money" },
    { key: "margemMedia", icon: "📐", label: "Margem média", value: margemMedia, kind: "int", suffix: "%" },
    { key: "tempoVenda", icon: "⏱️", label: "Tempo médio para vender", value: tempoMedioVenda ?? 0, kind: "int", suffix: " dias" },
    { key: "semFoto", icon: "🖼️", label: "Artigos sem fotografia", value: artigosSemFotoCount, kind: "int" },
    { key: "semEtiqueta", icon: "🏷️", label: "Artigos por etiquetar", value: artigosSemEtiquetaCount, kind: "int" },
    { key: "publicados", icon: "✅", label: "Artigos publicados", value: artigosPublicados, kind: "int" },
    { key: "porPublicar", icon: "📢", label: "Artigos por publicar", value: artigosPorPublicar, kind: "int" },
  ];

  // ---------- resumo do dia (para a saudação inicial) ----------
  const hojeISO = todayISO();
  const proximoDireto = (lives || [])
    .filter((l) => (l.estado === "Preparação" || l.estado === "Em curso") && l.data >= hojeISO)
    .sort((a, b) => (a.data + (a.hora_inicio || "")).localeCompare(b.data + (b.hora_inicio || "")))[0] || null;
  const seteDiasISO = toISO(new Date(Date.now() + 7 * 86400000));
  const mmddEntre = (mmdd, hojeStr, limiteStr) => {
    // compara só mês-dia (aniversário), tratando a virada de ano corretamente
    const hMD = hojeStr.slice(5), lMD = limiteStr.slice(5);
    return hMD <= lMD ? (mmdd >= hMD && mmdd <= lMD) : (mmdd >= hMD || mmdd <= lMD);
  };
  // Conta "encomendas" na aceção certa: um grupo de vendas com a mesma encomenda_id conta
  // como 1 (mesmo que tenha várias peças); uma venda solta conta como 1 encomenda dela
  // própria — evita inflacionar o número quando várias peças vão na mesma encomenda.
  const contarEncomendas = (salesArr) => new Set(salesArr.map((s) => s.encomenda_id || `solta:${s.id}`)).size;

  const resumoHoje = {
    porPreparar: contarEncomendas(salesAll.filter((s) => s.estado === "Pago" && (s.estado_envio === "Em Preparação" || s.estado_envio === "Não Definido" || !s.estado_envio))),
    prontasEnviar: contarEncomendas(salesAll.filter((s) => s.estado === "Pago" && s.estado_envio === "Preparado")),
    enviadasHoje: contarEncomendas(salesAll.filter((s) => (s.estado_envio === "Enviado" || s.estado_envio === "Entregue em mãos") && s.data_envio === hojeISO)),
    vendasHoje: salesAll.filter((s) => (s.data || "").slice(0, 10) === hojeISO).length,
    reservas: salesAll.filter((s) => s.estado === "Aguarda pagamento").length,
    porPublicar: artigosPorPublicar,
    aniversarios: clients.filter((c) => c.aniversario && c.aniversario.slice(5) === hojeISO.slice(5)).length,
    aniversariosSemana: clients.filter((c) => c.aniversario && mmddEntre(c.aniversario.slice(5), hojeISO, seteDiasISO)).length,
    novosClientes: clients.filter((c) => (c.created_at || "").slice(0, 10) === hojeISO).length,
    proximoDireto,
  };

  // ---------- gráficos ----------
  const monthLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    monthLabels.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("pt-PT", { month: "short" }) });
  }
  const comprasPorMes = monthLabels.map(({ key, label }) => ({
    mes: label, Compras: Number(sum(purchasesAll.filter((p) => p.data?.startsWith(key)), purchaseValue).toFixed(2)),
  }));
  const vendasPorMes = monthLabels.map(({ key, label }) => ({
    mes: label, Vendas: Number(sum(salesAll.filter((s) => s.data?.startsWith(key)), (s) => s.valor_venda).toFixed(2)),
  }));
  const lucroPorMes = monthLabels.map(({ key, label }) => ({
    mes: label,
    Lucro: Number((lucroDeVendas(salesAll.filter((s) => s.data?.startsWith(key))) - sum((gastosDiversos || []).filter((g) => !g.deleted_at && g.data?.startsWith(key) && (!ownerFilter || g.owner === ownerFilter)), (g) => g.valor)).toFixed(2)),
  }));

  const catCount = {};
  articlesF.forEach((a) => { const g = tipoGroup(a.tipo, tipos); catCount[g] = (catCount[g] || 0) + 1; });
  const artigosPorCategoria = Object.entries(catCount).map(([name, value]) => ({ name, value }));

  const ownerCount = {};
  OWNERS.forEach((o) => { ownerCount[o] = 0; });
  articlesF.forEach((a) => { if (a.owner) ownerCount[a.owner] = (ownerCount[a.owner] || 0) + 1; });
  const artigosPorOwner = Object.entries(ownerCount).map(([name, value]) => ({ name, value }));

  // Lucro por owner: compara sempre Rosa vs Rita (todo o histórico), independentemente do filtro de owner selecionado.
  const vendasPagasTodas = sales.filter((s) => s.estado === "Pago");
  const gastosDiversosTodos = (gastosDiversos || []).filter((g) => !g.deleted_at);
  const lucroPorOwner = OWNERS.map((o) => ({
    name: o,
    Lucro: Number((lucroDeVendas(vendasPagasTodas.filter((s) => s.quem_vendeu === o)) - sum(gastosDiversosTodos.filter((g) => g.owner === o), (g) => g.valor)).toFixed(2)),
  }));

  const estadoStock = [
    { name: "Disponível", value: unidadesDisponiveis },
    { name: "Reservado", value: unidadesReservadas },
    { name: "Vendido", value: unidadesVendidas },
  ];

  // ---------- listas rápidas ----------
  const ultimasCompras = [...purchasesAll].sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 5);
  const ultimasVendas = [...salesAll].sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 5);
  const ultimosClientes = [...clientsComputed]
    .filter((c) => c.dataUltimaCompra)
    .sort((a, b) => (b.dataUltimaCompra || "").localeCompare(a.dataUltimaCompra || ""))
    .slice(0, 5);
  const artigosReservados = salesAll
    .filter((s) => s.estado === "Aguarda pagamento")
    .map((s) => ({ ...s, article: articlesComputed.find((a) => a.id === s.article_id) }))
    .filter((s) => s.article)
    .slice(0, 6);

  const ultimosPagamentos = [...salesAll]
    .filter((s) => s.data_pagamento)
    .sort((a, b) => (b.data_pagamento || "").localeCompare(a.data_pagamento || ""))
    .slice(0, 5);

  const ultimosMovimentos = [
    ...purchasesAll.map((p) => ({ ...p, kind: "compra" })),
    ...salesAll.map((s) => ({ ...s, kind: "venda" })),
  ].sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 7);

  const clientesReservaPendente = clientsComputed
    .map((c) => {
      const pendentes = salesAll.filter((s) => s.client_id === c.id && s.estado === "Aguarda pagamento");
      return { ...c, nPendentes: pendentes.length, valorPendente: sum(pendentes, (s) => s.valor_venda), ultimaReserva: pendentes.map((s) => s.data).sort().pop() };
    })
    .filter((c) => c.nPendentes > 0)
    .sort((a, b) => (b.ultimaReserva || "").localeCompare(a.ultimaReserva || ""));

  // ---------- top 10 clientes por pontos (melhores / piores) ----------
  const melhoresClientes = [...clientsComputed]
    .filter((c) => c.nCompras > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 10);
  const pioresClientes = [...clientsComputed]
    .filter((c) => c.pontos < 0)
    .sort((a, b) => a.pontos - b.pontos)
    .slice(0, 10);

  // ---------- top 10 artigos (mais vendidos / maior margem) e nunca vendidos ----------
  const maisVendidosArtigos = [...articlesVendaveis]
    .filter((a) => a.soldQty > 0)
    .sort((a, b) => b.soldQty - a.soldQty)
    .slice(0, 10);

  const maiorMargemArtigos = [...articlesVendaveis]
    .filter((a) => a.valorVenda > 0)
    .sort((a, b) => b.margemPct - a.margemPct)
    .slice(0, 10);

  const artigosNuncaVendidos = articlesVendaveis
    .filter((a) => a.soldQty === 0 && a.stockAtual > 0)
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    .slice(0, 10);

  // ---------- alertas ----------
  const hoje = hojeISO;
  const alerts = [];

  const reservasExpiradas = salesAll.filter((s) => s.estado === "Aguarda pagamento" && s.data_limite_reserva && s.data_limite_reserva < hoje);
  if (reservasExpiradas.length > 0) alerts.push({ icon: "⏰", text: `${reservasExpiradas.length} reserva(s) expirada(s)`, severity: "high", tab: "sales" });

  const semStockCount = articlesVendaveis.filter((a) => a.stockAtual <= 0 && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)).length;
  if (semStockCount > 0) alerts.push({ icon: "🚫", text: `${semStockCount} artigo(s) esgotado(s)`, severity: "high", tab: "articles" });

  const stockBaixoCount = articlesVendaveis.filter((a) => a.stockAtual > 0 && a.stockAtual <= cfg.stock_baixo_limite && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)).length;
  if (stockBaixoCount > 0) alerts.push({ icon: "📉", text: `${stockBaixoCount} artigo(s) com stock baixo`, severity: "medium", tab: "articles" });

  const diasAtrasParado = new Date(); diasAtrasParado.setDate(diasAtrasParado.getDate() - cfg.artigo_parado_dias);
  const paradoISO = toISO(diasAtrasParado);
  const stockParado = articlesVendaveis.filter((a) => {
    if (a.stockAtual <= 0 || a.estado === "Pausado") return false;
    const vendasArtigo = salesAll.filter((s) => s.article_id === a.id).map((s) => s.data).filter(Boolean).sort();
    const ultimoMovimento = vendasArtigo.length ? vendasArtigo[vendasArtigo.length - 1] : (a.created_at || "").slice(0, 10);
    return ultimoMovimento && ultimoMovimento < paradoISO;
  });
  if (stockParado.length > 0) alerts.push({ icon: "🐌", text: `${stockParado.length} artigo${stockParado.length > 1 ? "s" : ""} não vendido${stockParado.length > 1 ? "s" : ""} há mais de ${cfg.artigo_parado_dias} dias`, severity: "medium", tab: "articles" });

  const semFoto = articlesVendaveis.filter((a) => !a.foto_url && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado));
  if (semFoto.length > 0) alerts.push({ icon: "🖼️", text: `${semFoto.length} artigo(s) sem fotografia`, severity: "low", tab: "articles" });

  const semEtiqueta = articlesVendaveis.filter((a) => !a.etiquetado && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado));
  if (semEtiqueta.length > 0) alerts.push({ icon: "🏷️", text: `${semEtiqueta.length} artigo(s) por etiquetar`, severity: "low", tab: "articles" });

  const semPrecoVenda = articlesVendaveis.filter((a) => !(Number(a.valor_venda) > 0) && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado));
  if (semPrecoVenda.length > 0) alerts.push({ icon: "💰", text: `${semPrecoVenda.length} artigo(s) vendável(eis) sem preço de venda`, severity: "high", tab: "articles" });

  const comprasSemFatura = purchasesAll.filter((p) => !p.fatura);
  if (comprasSemFatura.length > 0) alerts.push({ icon: "🧾", text: `${comprasSemFatura.length} compra(s) sem fatura`, severity: "medium", tab: "purchases" });

  const clientesComPendente = clientsComputed.filter((c) => salesAll.some((s) => s.client_id === c.id && s.estado === "Aguarda pagamento"));
  if (clientesComPendente.length > 0) alerts.push({ icon: "📬", text: `${clientesComPendente.length} cliente(s) com reservas por pagar`, severity: "low", tab: "clients" });

  const descontosExpirados = clients.filter((c) => c.codigo_desconto && !c.desconto_utilizado && c.data_fim_desconto && c.data_fim_desconto < hoje);
  if (descontosExpirados.length > 0) alerts.push({ icon: "🎟️", text: `${descontosExpirados.length} desconto(s) de cliente expirado(s)`, severity: "medium", tab: "clients" });

  const clientesBloqueados = clientsComputed.filter((c) => c.estadoCliente === "Bloqueado");
  if (clientesBloqueados.length > 0) alerts.push({ icon: "⛔", text: `${clientesBloqueados.length} cliente(s) bloqueado(s) por pontos negativos`, severity: "high", tab: "clients" });

  const avisoDiasISO = toISO(new Date(Date.now() + cfg.troca_aviso_dias * 86400000));
  const trocasAbertas = (exchanges || []).filter((e) => !["Concluída", "Cancelada"].includes(e.estado));
  const trocasExpiradas = trocasAbertas.filter((e) => { const l = dataLimiteTroca(sales.find((s) => s.id === e.sale_id), cfg.troca_janela_dias); return l && l < hoje; });
  const trocasAExpirar = trocasAbertas.filter((e) => { const l = dataLimiteTroca(sales.find((s) => s.id === e.sale_id), cfg.troca_janela_dias); return l && l >= hoje && l <= avisoDiasISO; });
  if (trocasExpiradas.length > 0) alerts.push({ icon: "⏳", text: `${trocasExpiradas.length} troca(s) com prazo já expirado`, severity: "high", tab: "exchanges" });
  if (trocasAExpirar.length > 0) alerts.push({ icon: "🔁", text: `${trocasAExpirar.length} troca(s) com prazo a terminar nos próximos ${cfg.troca_aviso_dias} dias`, severity: "medium", tab: "exchanges" });

  const publicacoesAtrasadas = (contentItems || []).filter((c) => c.data_publicacao && c.data_publicacao < hoje && c.estado !== "Publicado");
  if (publicacoesAtrasadas.length > 0) alerts.push({ icon: "📅", text: `${publicacoesAtrasadas.length} publicação(ões) atrasada(s)`, severity: "medium", tab: "content" });

  const sugestoesPreco = gerarSugestoesPreco(articlesComputed, salesAll, cfg);
  const sugestoesLiquidar = sugestoesPreco.filter((s) => s.nivel === "vermelho").length;
  const sugestoesPromover = sugestoesPreco.filter((s) => s.nivel === "amarelo").length;
  if (sugestoesLiquidar > 0) alerts.push({ icon: "💰", text: `${sugestoesLiquidar} artigo(s) com sugestão de liquidar`, severity: "medium", tab: "price-suggestions" });
  if (sugestoesPromover > 0) alerts.push({ icon: "🟡", text: `${sugestoesPromover} artigo(s) com sugestão de promover`, severity: "low", tab: "price-suggestions" });

  const listaEsperaPendente = (liveRegistos || []).filter((r) => r.estado === "Lista de espera" && (r.estado_lista_espera || "Pendente") === "Pendente").length;
  if (listaEsperaPendente > 0) alerts.push({ icon: "🔄", text: `${listaEsperaPendente} registo(s) em lista de espera`, severity: "low", tab: "lives" });

  // ---------- linha 4: Diretos, Conteúdo & Trocas (módulos sem representação nas linhas 1-3) ----------
  const livesAll = lives || []; // diretos não têm campo "owner" — mostram-se sempre, independentemente do filtro
  const diretosNoPeriodo = livesAll.filter((l) => inRange(l.data, range)).length;
  const publicacoesConcluidasPeriodo = (contentItems || []).filter((c) => c.estado === "Publicado" && inRange(c.data_publicacao, range)).length;
  const valorStockEmRisco = sum(sugestoesPreco.filter((s) => s.nivel === "vermelho"), (s) => s.article.stockAtual * s.article.valor_venda);

  kpis.row4 = [
    { key: "diretos", icon: "🎥", label: "Diretos (período)", value: diretosNoPeriodo, kind: "int" },
    { key: "trocasAbertas", icon: "🔁", label: "Trocas em aberto", value: trocasAbertas.length, kind: "int" },
    { key: "publicacoesPeriodo", icon: "📱", label: "Publicações concluídas (período)", value: publicacoesConcluidasPeriodo, kind: "int" },
    { key: "stockRisco", icon: "💰", label: "Stock em risco (sugestão de liquidar)", value: valorStockEmRisco, kind: "money" },
  ];

  // ---------- linha 5: Material Interno (etiquetas, embalagens e outro apoio ao negócio) ----------
  // Nunca é vendido, por isso tem os seus próprios KPIs — separados dos de stock vendável
  // (linhas 1-2) para não misturar valores de negócio com material de apoio.
  const totalArtigosInternos = articlesInternos.length;
  const unidadesInternasDisponiveis = sum(articlesInternos, (a) => Math.max(a.stockAtual, 0));
  const valorInvestidoInterno = sum(articlesInternos, (a) => a.valorTotalSemIVA);
  const valorStockInternoAtual = sum(articlesInternos, (a) => a.valorStockSemIVA);
  const semStockInternoCount = articlesInternos.filter((a) => a.stockAtual <= 0 && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)).length;
  const stockBaixoInternoCount = articlesInternos.filter((a) => a.stockAtual > 0 && a.stockAtual <= cfg.stock_baixo_limite && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)).length;
  // "Parado" para material interno é medido pelo último CONSUMO (etiqueta usada numa venda,
  // ou artigo gasto numa Embalagem), já que nunca há vendas para o próprio artigo interno.
  const stockParadoInterno = articlesInternos.filter((a) => {
    if (a.stockAtual <= 0 || a.estado === "Pausado") return false;
    const consumosEtq = (etiquetaConsumos || []).filter((c) => c.etiqueta_article_id === a.id).map((c) => (c.created_at || "").slice(0, 10));
    const consumosEmb = (embalagemConsumos || []).filter((c) => c.article_id === a.id).map((c) => (c.created_at || "").slice(0, 10));
    const movimentos = [...consumosEtq, ...consumosEmb].filter(Boolean).sort();
    const ultimoMovimento = movimentos.length ? movimentos[movimentos.length - 1] : (a.created_at || "").slice(0, 10);
    return ultimoMovimento && ultimoMovimento < paradoISO;
  });

  kpis.row5 = [
    { key: "totalInternos", icon: "📦", label: "Tipos de material interno", value: totalArtigosInternos, kind: "int" },
    { key: "dispInternos", icon: "✅", label: "Unidades disponíveis", value: unidadesInternasDisponiveis, kind: "int", suffix: " un." },
    { key: "investidoInterno", icon: "💰", label: "Valor investido", value: valorInvestidoInterno, kind: "money" },
    { key: "atualInterno", icon: "🏬", label: "Valor atual em stock", value: valorStockInternoAtual, kind: "money" },
    { key: "paradoInterno", icon: "🐌", label: `Parado há mais de ${cfg.artigo_parado_dias} dias`, value: stockParadoInterno.length, kind: "int" },
  ];
  if (semStockInternoCount > 0) alerts.push({ icon: "🚫", text: `${semStockInternoCount} material(is) interno(s) esgotado(s)`, severity: "high", tab: "articles" });
  if (stockBaixoInternoCount > 0) alerts.push({ icon: "📉", text: `${stockBaixoInternoCount} material(is) interno(s) com stock baixo`, severity: "medium", tab: "articles" });
  if (stockParadoInterno.length > 0) alerts.push({ icon: "🐌", text: `${stockParadoInterno.length} material(is) interno(s) parado(s) há mais de ${cfg.artigo_parado_dias} dias`, severity: "low", tab: "articles" });

  // ---------- linha 6: Encomendas (várias vendas do mesmo cliente, agrupadas para envio) ----------
  const encomendasAll = encomendas || [];
  const totalEncomendas = encomendasAll.length;
  const encomendasEmPreparacao = encomendasAll.filter((e) => e.estado_envio === "Em Preparação" || e.estado_envio === "Não Definido" || !e.estado_envio).length;
  const encomendasProntas = encomendasAll.filter((e) => e.estado_envio === "Preparado").length;
  const encomendasAbertasIds = new Set(encomendasAll.filter((e) => e.estado_envio !== "Enviado" && e.estado_envio !== "Entregue em mãos").map((e) => e.id));
  const valorEncomendasAbertas = sum(salesAll.filter((s) => s.encomenda_id && encomendasAbertasIds.has(s.encomenda_id)), (s) => s.valor_venda);
  // Custo total (histórico) de material de embalagem e de etiquetas consumido — ligado às
  // Encomendas e às vendas etiquetadas, respetivamente (ver secção "Etiquetas e Embalagens").
  const custoTotalEmbalagem = sum((embalagemConsumos || []).filter((c) => !c.deleted_at), (c) => {
    const artigo = articlesComputed.find((a) => a.id === c.article_id);
    return Number(c.quantidade || 0) * Number(artigo?.preco_unitario || 0);
  });
  const custoTotalEtiquetas = sum((etiquetaConsumos || []).filter((c) => !c.deleted_at), (c) => {
    const artigo = articlesComputed.find((a) => a.id === c.etiqueta_article_id);
    return Number(artigo?.preco_unitario || 0);
  });
  // Tempo médio entre a encomenda ser criada e ser enviada — usa a data de criação (sempre
  // disponível) até à Data de envio, só nas já enviadas/entregues.
  const encomendasEnviadasComDatas = encomendasAll.filter((e) => (e.estado_envio === "Enviado" || e.estado_envio === "Entregue em mãos") && e.data_envio && e.created_at);
  const temposPreparacaoDias = encomendasEnviadasComDatas.map((e) => {
    const dias = (new Date(e.data_envio) - new Date(e.created_at)) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.round(dias));
  });
  const tempoMedioPreparacao = temposPreparacaoDias.length ? Math.round(temposPreparacaoDias.reduce((s, d) => s + d, 0) / temposPreparacaoDias.length) : 0;

  kpis.row6 = [
    { key: "totalEncomendas", icon: "📦", label: "Total de encomendas", value: totalEncomendas, kind: "int" },
    { key: "encPreparacao", icon: "🛠️", label: "Em preparação", value: encomendasEmPreparacao, kind: "int" },
    { key: "encProntas", icon: "✅", label: "Prontas a enviar", value: encomendasProntas, kind: "int" },
    { key: "valorEncAbertas", icon: "💰", label: "Valor em encomendas abertas", value: valorEncomendasAbertas, kind: "money" },
    { key: "custoEmbalagem", icon: "📦", label: "Gasto total em embalamento", value: custoTotalEmbalagem, kind: "money" },
    { key: "custoEtiquetas", icon: "🏷️", label: "Gasto total em etiquetas", value: custoTotalEtiquetas, kind: "money" },
    { key: "tempoPreparacao", icon: "⏱️", label: "Tempo médio de preparação", value: tempoMedioPreparacao, kind: "int", suffix: " dias" },
  ];
  const encomendasSemFatura = encomendasAll.filter((e) => (e.estado_envio === "Enviado" || e.estado_envio === "Entregue em mãos") && !e.fatura_rosa && !e.fatura_rita);
  if (encomendasSemFatura.length > 0) alerts.push({ icon: "🧾", text: `${encomendasSemFatura.length} encomenda(s) enviada(s) sem fatura emitida`, severity: "medium", tab: "sales" });

  // ---------- top artigos mais comprados (soma das quantidades em compras "Concluída") ----------
  const compradasPorArtigo = {};
  (purchaseItems || []).forEach((pi) => {
    const p = purchaseById[pi.purchase_id];
    if (!p || p.estado !== "Concluída") return;
    if (ownerFilter && p.quem_comprou !== ownerFilter) return;
    compradasPorArtigo[pi.article_id] = (compradasPorArtigo[pi.article_id] || 0) + Number(pi.quantidade || 0);
  });
  const maisCompradosArtigos = Object.entries(compradasPorArtigo)
    .map(([articleId, qtdComprada]) => ({ ...(articlesComputed.find((a) => a.id === articleId) || {}), qtdComprada }))
    .filter((a) => a.id)
    .sort((a, b) => b.qtdComprada - a.qtdComprada)
    .slice(0, 10);

  const proximosDiretos = livesAll
    .filter((l) => (l.estado === "Preparação" || l.estado === "Em curso") && l.data >= hoje)
    .sort((a, b) => (a.data + (a.hora_inicio || "")).localeCompare(b.data + (b.hora_inicio || "")))
    .slice(0, 5);
  const trocasAbertasLista = trocasAbertas
    .map((e) => ({ ...e, limite: dataLimiteTroca(sales.find((s) => s.id === e.sale_id), cfg.troca_janela_dias) }))
    .sort((a, b) => (a.limite || "").localeCompare(b.limite || ""))
    .slice(0, 5);

  return {
    range, kpis, pulse, saude, financas, resumoHoje,
    charts: { comprasPorMes, vendasPorMes, lucroPorMes, artigosPorCategoria, artigosPorOwner, estadoStock, lucroPorOwner },
    lists: { ultimasCompras, ultimasVendas, ultimosClientes, artigosReservados, ultimosPagamentos, ultimosMovimentos, clientesReservaPendente, melhoresClientes, pioresClientes, maisVendidosArtigos, maiorMargemArtigos, artigosNuncaVendidos, maisCompradosArtigos, proximosDiretos, trocasAbertasLista },
    alerts,
  };
}
