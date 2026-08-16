// Regras que geram tarefas automáticas a partir de outros dados da app (vendas, artigos,
// conteúdo, listas de espera). Cada regra devolve uma lista de { chave, titulo, origem_tab,
// origem_id } — a "chave" identifica a regra+registo de forma estável, para nunca duplicar
// a mesma tarefa, e para se poder detetar quando deixa de se aplicar (a app conclui-a sozinha).

import { datasMarketingProximas } from "./specialDays";
import { DEFAULT_SETTINGS, ARTICLE_ESTADOS_SEM_ALERTA } from "./constants";
import { todayISO } from "./computations";

export function gerarTarefasAutomaticas({ sales, articles, contentItems, liveRegistos, clients, articleName, clientName, settings = DEFAULT_SETTINGS, marketingDates }) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const tarefas = [];

  // 📦 Preparar encomenda — venda já paga, ainda por preparar
  (sales || []).forEach((s) => {
    if (s.estado === "Pago" && (s.estado_envio === "Em Preparação" || s.estado_envio === "Não Definido" || !s.estado_envio)) {
      tarefas.push({
        chave: `prep:sale:${s.id}`,
        titulo: `📦 Preparar encomenda da venda ${s.codigo || articleName(s.article_id)}`,
        origem_tab: "sales", origem_id: s.id,
      });
    }
  });

  // 💳 Confirmar pagamento — reserva por pagar
  (sales || []).forEach((s) => {
    if (s.estado === "Aguarda pagamento") {
      tarefas.push({
        chave: `pay:sale:${s.id}`,
        titulo: `💳 Confirmar pagamento de ${clientName(s.client_id)}`,
        origem_tab: "sales", origem_id: s.id,
      });
    }
  });

  // 📦 Enviar encomenda — venda paga, já preparada
  (sales || []).forEach((s) => {
    if (s.estado === "Pago" && s.estado_envio === "Preparado") {
      tarefas.push({
        chave: `ship:sale:${s.id}`,
        titulo: `📦 Enviar encomenda da venda ${s.codigo || articleName(s.article_id)}`,
        origem_tab: "sales", origem_id: s.id,
      });
    }
  });

  // 📸 Fotografar artigo novo
  (articles || []).forEach((a) => {
    if (!a.foto_url && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)) {
      tarefas.push({
        chave: `foto:article:${a.id}`,
        titulo: `📸 Fotografar ${a.artigo || "artigo"}`,
        origem_tab: "articles", origem_id: a.id,
      });
    }
  });

  // 🏷️ Colocar etiqueta física
  (articles || []).forEach((a) => {
    if (!a.etiquetado && !ARTICLE_ESTADOS_SEM_ALERTA.includes(a.estado)) {
      tarefas.push({
        chave: `label:article:${a.id}`,
        titulo: `🏷️ Colocar etiqueta em ${a.artigo || "artigo"}`,
        origem_tab: "articles", origem_id: a.id,
      });
    }
  });

  // 📱 Publicar artigo — conteúdo já fotografado/editado, ainda por publicar
  (contentItems || []).forEach((c) => {
    if (c.estado === "Fotografado" || c.estado === "Editado") {
      const nome = c.article_id ? articleName(c.article_id) : (c.titulo || "conteúdo");
      tarefas.push({
        chave: `publish:content:${c.id}`,
        titulo: `📱 Publicar ${nome}`,
        origem_tab: "content", origem_id: c.id,
      });
    }
  });

  // 🔄 Contactar cliente da lista de espera
  (liveRegistos || []).forEach((r) => {
    if (r.estado === "Lista de espera" && (r.estado_lista_espera || "Pendente") === "Pendente" && r.client_id) {
      tarefas.push({
        chave: `waitlist:registo:${r.id}`,
        titulo: `🔄 Contactar ${clientName(r.client_id)} (lista de espera)`,
        origem_tab: "lives-waitlist", origem_id: r.id,
      });
    }
  });

  // 📢 Preparar conteúdo para uma data de marketing próxima (Dia dos Namorados, Black Friday,
  // Natal, etc.) — só sugere se ainda não houver nenhuma publicação agendada para esse dia.
  const datasFixasAtivas = marketingDates ? marketingDates.filter((d) => d.ativo !== false) : undefined;
  datasMarketingProximas(cfg.conteudo_aviso_dias, new Date(), datasFixasAtivas).forEach(({ iso, nome, diasFalta }) => {
    const jaTemConteudo = (contentItems || []).some((c) => c.data_publicacao === iso);
    if (!jaTemConteudo) {
      const quando = diasFalta === 0 ? "é hoje" : diasFalta === 1 ? "é amanhã" : `daqui a ${diasFalta} dias`;
      tarefas.push({
        chave: `content-suggestion:${iso}`,
        titulo: `📢 Preparar conteúdo para ${nome} (${quando})`,
        origem_tab: "content", origem_id: null,
      });
    }
  });

  // 🎂 Dar os parabéns a um cliente no dia do aniversário — com prazo = o próprio dia, para
  // aparecer também no Calendário (secção 12).
  const hoje = todayISO();
  (clients || []).forEach((c) => {
    if (!c.aniversario) return;
    const dataEsteAno = `${hoje.slice(0, 4)}${c.aniversario.slice(4)}`; // troca só o ano pelo atual
    if (dataEsteAno === hoje) {
      tarefas.push({
        chave: `birthday:client:${c.id}:${hoje.slice(0, 4)}`,
        titulo: `🎂 Dar os parabéns a ${c.nome || "cliente"}`,
        origem_tab: "clients", origem_id: c.id,
        prazo: dataEsteAno,
      });
    }
  });

  return tarefas;
}
