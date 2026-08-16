// Sugestões de preço/promoção — regras claras e explicáveis (não é "IA" opaca), para a Rosa
// e a Rita perceberem sempre porquê. Analisa: margem, tempo em stock, quantidade disponível,
// vendas, e se já foi vendido com desconto antes (comparando o valor de venda registado com o
// valor de venda atual do artigo).

import { DEFAULT_SETTINGS } from "./constants";

function diasEmStock(article, vendasArtigo) {
  const datas = vendasArtigo.map((s) => s.data).filter(Boolean).sort();
  const ultimoMovimento = datas.length ? datas[datas.length - 1] : (article.created_at || "").slice(0, 10);
  if (!ultimoMovimento) return 0;
  const d = new Date(`${ultimoMovimento}T00:00:00`);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Sugestão para UM artigo. Devolve null se o artigo não tiver stock (não faz sentido sugerir).
export function sugerirPreco(article, sales, settings = DEFAULT_SETTINGS) {
  if (!article || article.stockAtual <= 0 || article.estado === "Pausado") return null;
  const cfg = { ...DEFAULT_SETTINGS, ...settings };

  const vendasArtigo = sales.filter((s) => s.article_id === article.id && s.estado !== "Não pago");
  const vendasPagas = vendasArtigo.filter((s) => s.estado === "Pago");
  const dias = diasEmStock(article, vendasArtigo);
  const jaTeveDesconto = vendasPagas.some((s) => Number(s.valor_venda) < Number(article.valor_venda));
  const margem = article.margemPct ?? 0;

  let nivel = "verde";
  let texto = "A rodar normalmente — sem necessidade de mexer no preço.";

  if (dias >= cfg.sugestao_liquidar_dias && vendasPagas.length === 0) {
    nivel = "vermelho";
    texto = `Mais de ${dias} dias em stock sem nenhuma venda.`;
  } else if ((dias >= cfg.sugestao_promover_dias && vendasPagas.length <= 1) || (article.stockAtual >= cfg.sugestao_stock_alto_qtd && dias >= 45 && vendasPagas.length === 0)) {
    nivel = "amarelo";
    texto = article.stockAtual >= cfg.sugestao_stock_alto_qtd && vendasPagas.length === 0
      ? `Stock alto (${article.stockAtual} un.) parado há ${dias} dias.`
      : `${dias} dias em stock, vendas muito lentas.`;
  }

  // margem já baixa — desce a urgência, uma liquidação a fundo já não compensa tanto
  if (nivel === "vermelho" && margem < cfg.sugestao_margem_baixa_pct) {
    nivel = "amarelo";
    texto += " Margem já é baixa — considerar um desconto pequeno em vez de liquidar a fundo.";
  }

  if (jaTeveDesconto && nivel !== "verde") {
    texto += " Já foi vendido com desconto antes e continua parado.";
  }

  return {
    nivel, // "verde" | "amarelo" | "vermelho"
    texto,
    dias,
    vendas: vendasPagas.length,
    jaTeveDesconto,
  };
}

export const NIVEL_LABEL = { verde: "🟢 Manter preço", amarelo: "🟡 Promover", vermelho: "🔴 Liquidar" };
export const NIVEL_COLORS = {
  verde: { color: "#254238", bg: "#DCEBE4" },
  amarelo: { color: "#A67C1E", bg: "#F5EADD" },
  vermelho: { color: "#7A2A24", bg: "#F5D9D6" },
};

// Sugestões para todos os artigos com stock, já ordenadas por urgência (🔴 primeiro).
export function gerarSugestoesPreco(articlesComputed, sales, settings = DEFAULT_SETTINGS) {
  const ordem = { vermelho: 0, amarelo: 1, verde: 2 };
  return articlesComputed
    .map((a) => { const s = sugerirPreco(a, sales, settings); return s ? { article: a, ...s } : null; })
    .filter(Boolean)
    .sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || b.dias - a.dias);
}
