export const money = (n) =>
  (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

export const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

export const uid = () => crypto.randomUUID();

export const todayISO = () => new Date().toISOString().slice(0, 10);

// Janela legal de troca, em dias (14 dias, prazo legal em Portugal, por defeito) — conta
// sempre a partir da data da venda. Ajustável na página de Definições (ver windowDays).
export const EXCHANGE_WINDOW_DAYS = 14;

// Data limite para pedir troca de uma venda: data da venda + windowDays dias (usa o prazo
// legal por defeito se não for passado nenhum, mas aceita o valor configurado em Definições).
// Devolve null se a venda não tiver data.
export function dataLimiteTroca(sale, windowDays = EXCHANGE_WINDOW_DAYS) {
  const base = sale?.data;
  if (!base) return null;
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + Number(windowDays || EXCHANGE_WINDOW_DAYS));
  return d.toISOString().slice(0, 10);
}

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
};

// SKU tal como aparece na app: código base + tamanho, se o artigo tiver tamanho.
export const displaySku = (a) => (a?.tamanho ? `${a.sku}-${a.tamanho}` : (a?.sku || ""));

// Preenche um modelo de mensagem (com variáveis {{chave}}) a partir de um objeto de dados.
// Uma variável sem valor correspondente fica simplesmente vazia (não rebenta nem mostra "undefined").
export function preencherTemplate(corpo, dados = {}) {
  return (corpo || "").replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, chave) => {
    const valor = dados[chave];
    return valor === undefined || valor === null ? "" : String(valor);
  });
}

// Lista das variáveis suportadas, para mostrar como ajuda no formulário de modelos.
export const MESSAGE_TEMPLATE_VARS = [
  { chave: "cliente", desc: "nome do cliente" },
  { chave: "artigo", desc: "nome do artigo" },
  { chave: "quantidade", desc: "quantidade" },
  { chave: "valor", desc: "valor (€)" },
  { chave: "codigo", desc: "código da venda/direto" },
  { chave: "codigo_envio", desc: "código de envio" },
  { chave: "metodo_envio", desc: "método de envio" },
  { chave: "direto", desc: "nome do direto" },
  { chave: "data", desc: "data" },
  { chave: "a_o", desc: '"a" ou "o" (concordância, ex: "reservada")' },
  { chave: "transportadora", desc: "transportadora pré-definida (Definições → Encomendas)" },
  { chave: "prazo_envio", desc: "prazo de envio, em dias úteis (Definições → Encomendas)" },
  { chave: "portes_nacionais", desc: "valor dos portes nacionais (Definições → Encomendas)" },
  { chave: "portes_internacionais", desc: "valor dos portes internacionais (Definições → Encomendas)" },
  { chave: "portes_gratis_acima", desc: "valor a partir do qual os portes são grátis (Definições → Encomendas)" },
  { chave: "iban_rosa", desc: "IBAN da Rosa (Definições → Pagamentos)" },
  { chave: "iban_rita", desc: "IBAN da Rita (Definições → Pagamentos)" },
  { chave: "mbway_rosa", desc: "nº de MB Way da Rosa (Definições → Pagamentos)" },
  { chave: "mbway_rita", desc: "nº de MB Way da Rita (Definições → Pagamentos)" },
];

// Junta ao objeto de dados de uma mensagem os valores de Dados para Encomendas/Pagamentos
// definidos em Definições — para poderem usar {{transportadora}}, {{iban_rosa}}, etc. em
// qualquer modelo. Campos por preencher ficam simplesmente vazios (nunca "undefined").
export function dadosEmpresa(settings = {}) {
  return {
    transportadora: settings.transportadora_padrao || "",
    prazo_envio: settings.prazo_envio_dias ? `${settings.prazo_envio_dias} dias úteis` : "",
    portes_nacionais: settings.portes_nacionais !== undefined && settings.portes_nacionais !== "" ? money(settings.portes_nacionais) : "",
    portes_internacionais: settings.portes_internacionais !== undefined && settings.portes_internacionais !== "" ? money(settings.portes_internacionais) : "",
    portes_gratis_acima: settings.portes_gratis_acima !== undefined && settings.portes_gratis_acima !== "" ? money(settings.portes_gratis_acima) : "",
    iban_rosa: settings.iban_rosa || "",
    iban_rita: settings.iban_rita || "",
    mbway_rosa: settings.mbway_rosa || "",
    mbway_rita: settings.mbway_rita || "",
  };
}

// Gera o link do WhatsApp Web/App com a mensagem já preenchida, a partir de um telefone (PT por defeito).
export function whatsappLink(telefone, mensagem) {
  const digits = (telefone || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const comIndicativo = digits.startsWith("351") ? digits : `351${digits.replace(/^0+/, "")}`;
  return `https://wa.me/${comIndicativo}?text=${encodeURIComponent(mensagem || "")}`;
}

// Código único tipo SKU baseado numa data (ex: LIVE-20260815, com sufixo -2/-3 se repetir no mesmo dia).
// `lista` é o array de registos já existentes (com deleted_at já filtrado pelo useRealtimeTable);
// `campo` é o nome do campo onde o código está guardado (normalmente "codigo").
export function sugerirCodigoPorData(prefixo, dataStr, lista, campo = "codigo", excludeId) {
  const base = `${prefixo}-${(dataStr || todayISO()).replaceAll("-", "")}`;
  const existentes = new Set(lista.filter((x) => x.id !== excludeId).map((x) => (x[campo] || "").trim().toLowerCase()));
  if (!existentes.has(base.toLowerCase())) return base;
  let n = 2;
  while (existentes.has(`${base}-${n}`.toLowerCase())) n++;
  return `${base}-${n}`;
}

// Código único tipo SKU sequencial (ex: FORN-001, FORN-002…), para entidades sem data natural.
export function sugerirCodigoSequencial(prefixo, lista, campo = "codigo", excludeId, digitos = 3) {
  const re = new RegExp(`^${prefixo}-(\\d+)$`, "i");
  const nums = lista.filter((x) => x.id !== excludeId).map((x) => { const m = re.exec((x[campo] || "").trim()); return m ? parseInt(m[1], 10) : 0; });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefixo}-${String(next).padStart(digitos, "0")}`;
}

// Enriquece os artigos com stock atual, margens e valores calculados.
// "Reservado" = vendas com estado de pagamento "Aguarda pagamento" (ainda não saiu, mas já tem dono).
// "Vendido" = vendas já "Pago" — o estado de envio é só acompanhamento, não mexe no stock.
// "Não pago" NÃO conta como saída de stock — a peça continua disponível para vender.
// `exchanges` (opcional): trocas com stock_ajustado=true devolvem 1+ unidades ao artigo
// devolvido e retiram 1+ unidades ao novo artigo escolhido — aplicado uma única vez, no
// momento em que se confirma a receção do artigo devolvido.
export function computeArticles(articles, sales, exchanges = []) {
  return articles.map((a) => {
    const vendasArtigo = sales.filter((s) => s.article_id === a.id);
    const reservedQty = vendasArtigo.filter((s) => s.estado === "Aguarda pagamento").reduce((sum, s) => sum + Number(s.quantidade || 0), 0);
    // "Não pago" não conta como saída de stock — a venda não se concretizou, a peça continua disponível.
    const soldQty = vendasArtigo.filter((s) => s.estado === "Pago").reduce((sum, s) => sum + Number(s.quantidade || 0), 0);
    const vendidas = reservedQty + soldQty;
    const devolvidoQty = exchanges.filter((e) => e.stock_ajustado && e.original_article_id === a.id).reduce((sum, e) => sum + Number(e.quantidade || 0), 0);
    const trocaSaidaQty = exchanges.filter((e) => e.stock_ajustado && e.novo_article_id === a.id).reduce((sum, e) => sum + Number(e.quantidade || 0), 0);
    const qtd = Number(a.quantidade) || 0;
    const preco = Number(a.preco_unitario) || 0;
    const iva = Number(a.iva) || 0;
    const valorVenda = Number(a.valor_venda) || 0;
    const semIVA = preco * qtd;
    const comIVA = semIVA * (1 + iva / 100);
    const physicalStock = qtd - soldQty - trocaSaidaQty + devolvidoQty; // ainda fisicamente no stock (livre ou reservado)
    const stockAtual = physicalStock - reservedQty; // livre para vender agora
    const margemUnit = valorVenda - preco * (1 + iva / 100);
    const margemPct = valorVenda > 0 ? (margemUnit / valorVenda) * 100 : 0;
    return {
      ...a,
      vendidas, reservedQty, soldQty, physicalStock,
      valorTotalSemIVA: semIVA,
      valorTotalComIVA: comIVA,
      stockAtual,
      valorStockSemIVA: stockAtual * preco,
      valorStockComIVA: stockAtual * preco * (1 + iva / 100),
      margemUnit,
      margemPct,
    };
  });
}

// Estados de fidelização (calculados a cada render, nunca guardados na BD):
// - Bloqueado: saldo de pontos negativo — impede novas vendas a este cliente.
// - Top 5: entre os 5 clientes com maior valor gasto (só clientes com compras "Pago").
// - Regular: teve pelo menos uma compra "Pago" nos últimos 30 dias.
// - Novato: já fez pelo menos uma compra "Pago", mas não se enquadra nos estados acima.
// Prioridade quando várias condições se aplicam: Bloqueado > Top 5 > Regular > Novato.
//
// Pontos: +1 ponto por cada 1€ gasto em vendas "Pago"; -1 ponto por cada 1€ de peças
// marcadas "Não pago" (peça entregue mas não paga). Saldo = ganhos - perdidos.
export function pointsRangeLabel(pontos) {
  if (pontos < 0) return "Negativo (bloqueado)";
  if (pontos < 50) return "0 – 49";
  if (pontos < 100) return "50 – 99";
  if (pontos < 200) return "100 – 199";
  return "200+";
}

export function computeClients(clients, sales) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoISO = oneYearAgo.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().slice(0, 10);

  const base = clients.map((c) => {
    const vendasCliente = sales.filter((s) => s.client_id === c.id);
    const vendasConcluidas = vendasCliente.filter((s) => s.estado === "Pago");
    const vendasPendentes = vendasCliente.filter((s) => s.estado === "Aguarda pagamento");
    const vendasNaoPagas = vendasCliente.filter((s) => s.estado === "Não pago");
    const datas = vendasConcluidas.map((s) => s.data).filter(Boolean).sort();
    const ultima = datas.length ? datas[datas.length - 1] : null;
    const primeira = datas.length ? datas[0] : null;
    const totalGasto = vendasConcluidas.reduce((sum, s) => sum + Number(s.valor_venda || 0), 0);
    const totalGastoAno = vendasConcluidas
      .filter((s) => s.data >= oneYearAgoISO)
      .reduce((sum, s) => sum + Number(s.valor_venda || 0), 0);
    const totalNaoPago = vendasNaoPagas.reduce((sum, s) => sum + Number(s.valor_venda || 0), 0);
    const pontosBonus = Number(c.pontos_bonus || 0);
    const pontos = Math.round(pontosBonus + totalGasto - totalNaoPago);
    const compraRecente = !!ultima && ultima >= thirtyDaysAgoISO;
    return {
      ...c, dataUltimaCompra: ultima, dataPrimeiraCompra: primeira, totalGasto, totalGastoAno,
      nCompras: vendasConcluidas.length, nReservasPendentes: vendasPendentes.length,
      nNaoPagas: vendasNaoPagas.length, totalNaoPago, pontosBonus, pontos, compraRecente,
      faixaPontos: pointsRangeLabel(pontos),
    };
  });

  const top5Ids = new Set(
    [...base]
      .filter((c) => c.totalGasto > 0)
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 5)
      .map((c) => c.id)
  );

  return base.map((c) => {
    let estadoCliente = null;
    if (c.pontos < 0) estadoCliente = "Bloqueado";
    else if (top5Ids.has(c.id)) estadoCliente = "Top 5";
    else if (c.compraRecente) estadoCliente = "Regular";
    else if (c.nCompras >= 1) estadoCliente = "Novato";
    return { ...c, estadoCliente };
  });
}

export function computeDashboardStats({ articles, articlesComputed, sales, purchases, suppliers, clients, clientsComputed }) {
  const stockValueSemIVA = articlesComputed.reduce((s, a) => s + a.valorStockSemIVA, 0);
  const stockDisponivel = articlesComputed.reduce((s, a) => s + Math.max(a.stockAtual, 0), 0);
  const semStock = articlesComputed.filter((a) => a.stockAtual <= 0);
  const lowStock = articlesComputed.filter((a) => a.stockAtual > 0 && a.stockAtual <= 3);
  const thisMonth = todayISO().slice(0, 7);
  const salesMonth = sales.filter((s) => s.data?.startsWith(thisMonth));
  const revenueMonth = salesMonth.reduce((s, x) => s + Number(x.valor_venda || 0), 0);
  const purchasesMonth = purchases.filter((p) => p.data?.startsWith(thisMonth));
  const spentMonth = purchasesMonth.reduce((s, x) => s + (Number(x.valor_aquisicao || 0) - Number(x.desconto || 0)), 0);

  const custoUnitComIVA = (articleId) => {
    const a = articlesComputed.find((x) => x.id === articleId);
    return a ? a.preco_unitario * (1 + (Number(a.iva) || 0) / 100) : 0;
  };
  const lucroMes = salesMonth.reduce(
    (sum, s) => sum + (Number(s.valor_venda || 0) - custoUnitComIVA(s.article_id) * Number(s.quantidade || 0)),
    0
  );

  const qtyByArticle = {};
  sales.forEach((s) => { qtyByArticle[s.article_id] = (qtyByArticle[s.article_id] || 0) + Number(s.quantidade || 0); });
  const topProdutos = Object.entries(qtyByArticle)
    .map(([articleId, qty]) => ({ articleId, qty, nome: articlesComputed.find((a) => a.id === articleId)?.artigo || "—" }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const clientesNovos = clientsComputed.filter((c) => c.dataPrimeiraCompra?.startsWith(thisMonth)).length;
  const clientesRecorrentes = clientsComputed.filter((c) => c.nCompras > 1).length;

  const faturasPendentesPorOwner = {};
  sales.filter((s) => !s.fatura).forEach((s) => {
    const owner = articlesComputed.find((a) => a.id === s.article_id)?.owner;
    if (owner) faturasPendentesPorOwner[owner] = (faturasPendentesPorOwner[owner] || 0) + 1;
  });

  const monthLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    monthLabels.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("pt-PT", { month: "short" }) });
  }
  const monthlySeries = monthLabels.map(({ key, label }) => ({
    mes: label,
    Vendas: Number(sales.filter((s) => s.data?.startsWith(key)).reduce((sum, s) => sum + Number(s.valor_venda || 0), 0).toFixed(2)),
    Compras: Number(purchases.filter((p) => p.data?.startsWith(key)).reduce((sum, p) => sum + (Number(p.valor_aquisicao || 0) - Number(p.desconto || 0)), 0).toFixed(2)),
  }));

  return {
    totalArtigos: articles.length, stockDisponivel, stockValueSemIVA, semStock, lowStock,
    revenueMonth, spentMonth, lucroMes, topProdutos, clientesNovos, clientesRecorrentes,
    monthlySeries, faturasPendentesPorOwner, nSuppliers: suppliers.length, nClients: clients.length,
  };
}
