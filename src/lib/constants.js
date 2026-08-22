export const OWNERS = ["Rosa", "Rita"];

// Deduz quem está a usar a app a partir do email de login (ex: "rosa@lojaR2.pt" → "Rosa").
// Sem correspondência, devolve "" — o campo fica por indicar, nunca assume um valor errado.
export function ownerFromEmail(email) {
  const e = (email || "").toLowerCase();
  return OWNERS.find((o) => e.includes(o.toLowerCase())) || "";
}
export const SUPPLIER_STATUS = ["Ativo", "Em negociação", "Inativo"];
export const PAYMENT_METHODS = ["", "Dinheiro", "MB Way", "Transferência", "Cartão", "Outro"];
export const PAYMENT_METHOD_LABELS = { "": "— por definir —", Dinheiro: "Dinheiro", "MB Way": "MB Way", Transferência: "Transferência", Cartão: "Cartão", Outro: "Outro" };
// Margem habitual em negócios de revenda de vestuário/acessórios em segunda mão.
// Ajusta este valor se a margem que costumam usar for diferente.
export const DEFAULT_MARGIN_PCT = 55;

// Valores por defeito, usados até a linha de "settings" carregar da base de dados (ou se
// ainda não existir) — têm de bater certo com os defaults definidos no schema.sql.
// ---------- Versão da aplicação ----------
export const APP_VERSION = "1.8.0";
export const APP_RELEASE_DATE = "2026-08-14";
// Histórico de alterações — a entrada [0] é sempre a mais recente. Cada uma tem "data"
// (fiável, vem do dia em que a alteração foi feita) e, sempre que a Rosa a fornece
// diretamente (não há acesso a um relógio em tempo real), "hora" — dentro do mesmo dia, a
// ordem da lista é a ordem em que as alterações foram feitas. Sempre que se pede uma
// alteração nova, acrescenta-se uma entrada aqui, no topo.
export const APP_CHANGELOG = [
  { data: "2026-08-22", hora: "23:47", titulo: "Diretos: trocar tamanho dentro de um conjunto", notas: "Junto a cada peça de um conjunto, um botão \"🔁 tamanho\" troca-a por outro tamanho do mesmo artigo (mesmo SKU base) — útil quando só se sabe o tamanho do cliente já durante o direto. Só afeta esse conjunto, a partir dali; vendas já registadas mantêm-se." },
  { data: "2026-08-22", hora: "23:47", titulo: "Correção: botão \"← Voltar\" em falta ao pedir troca", notas: "O atalho \"🔁 Pedir troca\", numa venda, esqueceu-se de avisar o histórico de navegação — por isso o botão \"← Voltar\" nunca aparecia depois. Corrigido." },
  { data: "2026-08-22", hora: "23:47", titulo: "Artigos: aplicar preço de venda com um clique", notas: "Um artigo vendável ainda sem preço mostra \"✨ aplicar\" na tabela — aplica logo a sugestão da margem-alvo, sem abrir a ficha. Novo filtro na coluna \"Venda\" (Com preço / Sem preço) e novo alerta no Painel para artigos vendáveis sem preço definido." },
  { data: "2026-08-22", hora: "23:47", titulo: "Compras: ordenar por data e duplicar", notas: "A lista passa a mostrar sempre as compras mais recentes primeiro. Novo botão \"⎘ Duplicar\" copia fornecedor, itens e preços para uma compra nova (código, fatura e datas em branco) — útil para comprar o mesmo, ao mesmo preço, mas noutro tamanho ou cor." },
  { data: "2026-08-22", hora: "23:47", titulo: "Pesquisa global cobre Vendas e Encomendas", notas: "Ctrl/⌘+K passa a procurar também por código de venda, artigo vendido, código de encomenda ou código de rastreio." },
  { data: "2026-08-22", hora: "23:47", titulo: "Painel: tempo médio de preparação de encomenda", notas: "Novo KPI em \"Vendas & Encomendas\" — dias entre a encomenda ser criada e ser enviada, só nas já enviadas." },
  { data: "2026-08-21", hora: "13:10", titulo: "Novo módulo: Marca de Água", notas: "Nova secção para carregar fotos das peças e sobrepor o logotipo da loja antes de publicar — posição, tamanho, rotação e opacidade ajustáveis, deteção automática do centro da peça, várias marcas por foto, 4 formatos de exportação, e download em lote. O logotipo fica guardado entre sessões." },
  { data: "2026-08-21", hora: "12:36", titulo: "Novo módulo: Consumos e Transformações", notas: "Dois botões em Artigos & Stock: \"📉 Registar consumo\" (baixa avulsa de material interno, com motivo) e \"🔄 Registar transformação\" (consome vários materiais e produz um artigo novo, ex: papel + tinteiro → etiquetas — com receitas reutilizáveis em Definições). Lista de últimos movimentos com botão para anular." },
  { data: "2026-08-21", hora: "06:51", titulo: "Revisão geral: Lixeira, Histórico e Exportar Excel", notas: "Embalagens e Transformações passam a poder ser recuperadas na Lixeira; Trocas, Diretos e Modelos de mensagem também (já eram eliminados com segurança, mas nunca lá apareciam). Exportar Excel ganha as folhas Encomendas, Embalagens e Transformações. Histórico com rótulos e filtro para todas as tabelas novas." },
  { data: "2026-08-20", hora: "22:11", titulo: "Painel: Encomendas e Material Interno com KPIs próprios", notas: "\"Vendas & Encomendas\" ganha total de encomendas, em preparação, prontas a enviar, valor em aberto, gasto em embalamento/etiquetas. Material Interno ganha KPI \"Parado\" (sem consumo há mais de X dias) e alerta próprio." },
  { data: "2026-08-18", hora: "19:44", titulo: "Módulo de Etiquetas e Embalagens", notas: "Novo em Definições: Tipos de Embalagem (ex: \"Normal\", \"Premium\") são uma receita fixa de material interno — nunca etiquetas. Escolher a Embalagem passa a ser obrigatório em toda a Encomenda, e dá baixa de stock de uma vez a todos os artigos da receita." },
  { data: "2026-08-18", hora: "19:44", titulo: "Correção: Material Interno já não aparece para vender", notas: "Etiquetas, caixas, sacos e outro material interno deixam de aparecer nos seletores de artigo em Vendas, Trocas, Centro de Conteúdo e Diretos." },
  { data: "2026-08-18", hora: "19:44", titulo: "Encomendas passam a viver dentro de Vendas", notas: "Sem aba própria — as vendas da mesma encomenda aparecem agrupadas na tabela de Vendas. Nova possibilidade de duas Faturas por encomenda (Rosa e Rita), cada venda mostra sempre a de quem a vendeu." },
  { data: "2026-08-18", hora: "08:36", titulo: "Encomendas", notas: "Nova aba: junta várias Vendas do mesmo cliente para um único envio. Estado de envio, método, código de rastreio e fatura passam a viver na Encomenda, partilhados por todas as vendas que contém — pode acrescentar-se mais vendas enquanto \"Em Preparação\". Vendas soltas continuam a funcionar exatamente como antes." },
  { data: "2026-08-17", hora: "19:22", titulo: "Cor \"N/A\" por defeito", notas: "Um artigo novo nasce sempre com a cor \"N/A\" (protegida, tal como \"Liso\" no Padrão)." },
  { data: "2026-08-17", hora: "19:22", titulo: "Baixa automática de stock ao etiquetar", notas: "Marcar \"Peça já etiquetada\" dá baixa de 1 unidade a um artigo do Tipo \"Etiqueta física?\"; com várias etiquetas em stock, pergunta qual usar. Desmarcar devolve a unidade." },
  { data: "2026-08-17", hora: "19:22", titulo: "Campos escondidos em artigos não vendáveis", notas: "\"Peça já etiquetada\" e \"Publicado nas redes sociais\" deixam de aparecer em artigos de Material Interno." },
  { data: "2026-08-17", hora: "19:22", titulo: "Cor e Padrão separados e parametrizáveis", notas: "Deixaram de ser um só campo combinado — cada um com a sua lista editável em Definições. Padrão nasce sempre \"Liso\"." },
  { data: "2026-08-17", hora: "19:22", titulo: "Tipos de Artigo totalmente parametrizáveis", notas: "A lista de Tipos passou de fixa no código para totalmente editável em Definições — Grupo, Peça, Código, Permite venda?, Tem tamanho? e Etiqueta física?." },
  { data: "2026-08-17", hora: "19:22", titulo: "Tipo \"Material Interno\"", notas: "Novo grupo para material de apoio nunca vendido (etiquetas, caixas, sacos de envio, etc.) — pisco \"Material interno\" automático, escondido por defeito na lista de Artigos." },
  { data: "2026-08-17", hora: "19:22", titulo: "Preço médio, referência e criação rápida nas Compras", notas: "Novo \"Preço médio\" no artigo; campo \"Referência do fornecedor\" por item de compra, pesquisável; criar um artigo na hora só com descrição (fica \"A aguardar validação\" até completar)." },
  { data: "2026-08-17", hora: "19:22", titulo: "Stock só entra com a compra \"Concluída\"", notas: "Uma compra \"Reservado\" ou \"Enviado\" já não soma stock nem atualiza o preço do artigo — só ao passar a \"Concluída\"." },
  { data: "2026-08-17", hora: "19:22", titulo: "Compras passam a ter itens", notas: "Uma compra pode agora ter vários artigos, cada um com a sua quantidade e custo — antes era um artigo por compra." },
  { data: "2026-08-16", titulo: "Logótipo atualizado", notas: "Nova imagem de marca, com tamanho maior na barra lateral." },
  { data: "2026-08-16", titulo: "Correção da saudação", notas: "O nome mostrado no Painel passou a ser sempre \"Rosa\" ou \"Rita\", independentemente do resto do endereço de email de login." },
  { data: "2026-08-16", titulo: "\"Sobre\" com changelog", notas: "A janela \"Sobre\" passou a mostrar o histórico de alterações por data, com a mais recente sempre no topo." },
  { data: "2026-08-16", titulo: "Correções de robustez", notas: "Exportar Excel e Restaurar Cópia de Segurança passaram a avisar claramente quando algo corre mal, em vez de falhar em silêncio." },
  { data: "2026-08-16", titulo: "Pontos do cliente na lista de compras", notas: "Cada venda na ficha do cliente mostra agora o efeito nos pontos (+X, −X, ou por confirmar)." },
  { data: "2026-08-16", titulo: "Mensagens ligadas a Encomendas/Pagamentos", notas: "Novas variáveis de mensagem: transportadora, prazo de envio, portes, IBAN e MB Way da Rosa/Rita." },
  { data: "2026-08-16", titulo: "Mensagem dentro da edição de venda", notas: "Já não é preciso gravar e reabrir a partir da tabela para enviar uma mensagem ao cliente." },
  { data: "2026-08-16", titulo: "Correção: eliminar venda de um direto", notas: "Passa a devolver o registo do direto a \"Por validar\", em vez de ficar preso a uma venda já eliminada." },
  { data: "2026-08-16", titulo: "Preço de conjuntos nos Diretos", notas: "Conjunto completo usa o preço combinado (dividido proporcionalmente); peças vendidas em separado usam o preço individual." },
  { data: "2026-08-16", titulo: "Venda parcial de conjuntos", notas: "Um conjunto com só uma peça sem stock já permite vender as restantes, com lista de espera só para a que falta." },
  { data: "2026-08-16", titulo: "Aniversário do cliente no Centro de Tarefas", notas: "Tarefa automática \"Dar os parabéns\", com prazo já preenchido, visível também no Calendário." },
  { data: "2026-08-16", titulo: "Link do artigo nas Vendas", notas: "O nome do artigo na tabela de Vendas passou a abrir a ficha completa." },
  { data: "2026-08-16", titulo: "Correção: alertas de foto/etiqueta", notas: "Artigos \"Sem Reposição\" ou \"Pausados\" deixaram de entrar nos alertas de fotografia e etiqueta, tal como já acontecia no stock." },
  { data: "2026-08-16", titulo: "Botão \"← Voltar\"", notas: "Qualquer atalho (alerta, tarefa, pesquisa) passou a permitir voltar exatamente a onde se estava antes." },
  { data: "2026-08-16", titulo: "Análise de engenharia", notas: "Tratamento de erros centralizado em todos os formulários — avisos claros sempre que uma gravação falha." },
  { data: "2026-08-16", titulo: "Novos KPIs do Painel", notas: "Nova secção \"Diretos, Conteúdo & Trocas\", com o valor de stock em risco de liquidação." },
  { data: "2026-08-16", titulo: "Correção: janela de troca", notas: "A definição de dias para troca não estava a chegar à página de Trocas — corrigido." },
  { data: "2026-08-15", titulo: "Datas de Marketing parametrizáveis", notas: "Lista de datas editável nas Definições, para gerar sozinha sugestões de conteúdo." },
  { data: "2026-08-15", titulo: "Modo de Teste", notas: "Interruptor para experimentar a app sem qualquer risco para os dados reais — isolamento completo, incluindo stock." },
  { data: "2026-08-15", titulo: "Dados da Empresa, Encomendas e Pagamentos", notas: "Novas secções nas Definições — logótipo, redes sociais, portes, IBAN e MB Way." },
  { data: "2026-08-15", titulo: "Cópia de Segurança", notas: "Descarregar e restaurar todos os dados da app num ficheiro." },
  { data: "2026-08-15", titulo: "\"Sobre\"", notas: "Janela com a versão da aplicação e o manual de utilizador." },
  { data: "2026-08-15", titulo: "Definições parametrizáveis", notas: "Limiares e prazos usados nos alertas e regras automáticas passaram a ser editáveis, em vez de fixos no código." },
  { data: "2026-08-14", titulo: "v1.0.0 — Primeira versão completa", notas: "Fornecedores, Compras, Artigos & Stock, Clientes, Vendas, Trocas, Centro de Conteúdo, Calendário, Diretos, Comunicação, Centro de Tarefas e Sugestões de Preço." },
];

export const DEFAULT_SETTINGS = {
  margem_alvo_pct: 55,
  stock_baixo_limite: 3,
  artigo_parado_dias: 60,
  troca_janela_dias: 14,
  troca_aviso_dias: 5,
  sugestao_promover_dias: 60,
  sugestao_liquidar_dias: 90,
  sugestao_stock_alto_qtd: 5,
  sugestao_margem_baixa_pct: 25,
  conteudo_aviso_dias: 10,
  pontos_boas_vindas: 50,

  marca_nome: "R² (Rosa e Rita)",
  logo_url: "",
  empresa_email: "",
  instagram: "",
  tiktok: "",
  rosa_telefone: "",
  rosa_morada: "",
  rosa_nif: "",
  rita_telefone: "",
  rita_morada: "",
  rita_nif: "",

  transportadora_padrao: "",
  portes_nacionais: "",
  portes_internacionais: "",
  portes_gratis_acima: "",
  prazo_envio_dias: "",

  pagamento_mbway: true,
  pagamento_transferencia: true,
  pagamento_numerario: true,
  pagamento_outros: false,
  iban_rosa: "",
  iban_rita: "",
  mbway_rosa: "",
  mbway_rita: "",
};
export const PAYMENT_STATUS = ["Aguarda pagamento", "Pago", "Não pago"];

// Estados de fidelização do cliente (calculados, não editáveis diretamente).
// Prioridade quando várias condições se aplicam: Bloqueado > Top 5 > Regular > Novato.
export const CLIENT_STATUS_COLORS = {
  Bloqueado: { color: "#7A2A24", bg: "#F5D9D6" },
  "Top 5": { color: "#832F72", bg: "#F7E3F2" },
  Regular: { color: "#254238", bg: "#DCEBE4" },
  Novato: { color: "#A67C1E", bg: "#F5EADD" },
};
export const SHIPPING_STATUS = ["Não Definido", "Em Preparação", "Preparado", "Enviado", "Entregue em mãos"];
export const SHIPPING_METHODS = ["CTT", "Entrega em mão", "Transportadora"];
export const PURCHASE_STATUS = ["Reservado", "Enviado", "Concluída"];
export const SOCIAL_PLATFORM_OPTIONS = ["Facebook", "Instagram", "Outro", "TikTok", "WhatsApp"];

// ---------- Estado do artigo ----------
export const ARTICLE_ESTADOS = ["A aguardar validação", "Novo — Sem compras", "Em stock", "Esgotado — vai repor", "Sem Reposição", "Pausado"];
export const ARTICLE_ESTADO_COLORS = {
  "A aguardar validação": { color: "#B34700", bg: "#FCE8D5" },
  "Novo — Sem compras": { color: "#4A2A85", bg: "#EEE1FB" },
  "Em stock": { color: "#254238", bg: "#DCEBE4" },
  "Esgotado — vai repor": { color: "#A67C1E", bg: "#F5EADD" },
  "Sem Reposição": { color: "#7A2A24", bg: "#F5D9D6" },
  "Pausado": { color: "#8A8677", bg: "#F1EDE3" },
};
// Estes estados representam artigos que não estão ativamente à venda / prontos a vender
// por escolha ou por ainda não terem sido repostos — não fazem sentido nos alertas de
// "stock esgotado/baixo" do Painel (um artigo "Novo — Sem compras" ainda está em
// preparação, nunca teve stock, não é um esgotamento a alertar; um "A aguardar
// validação" nem sequer tem tipo/cor/SKU definidos ainda, muito menos alertar por stock).
export const ARTICLE_ESTADOS_SEM_ALERTA = ["A aguardar validação", "Novo — Sem compras", "Sem Reposição", "Pausado"];

// ---------- Lista de espera dos Diretos ----------
export const WAITLIST_ESTADOS = ["Pendente", "Encerrado — Artigo sem reposição"];
export const WAITLIST_ESTADO_COLORS = {
  "Pendente": { color: "#832F72", bg: "#F7E3F2" },
  "Encerrado — Artigo sem reposição": { color: "#8A8677", bg: "#F1EDE3" },
};

// ---------- Trocas ----------
export const EXCHANGE_ESTADOS = ["Pedido registado", "Aguarda devolução do cliente", "Artigo devolvido recebido", "Novo artigo enviado", "Concluída", "Cancelada"];
export const EXCHANGE_ESTADO_COLORS = {
  "Pedido registado": { color: "#A67C1E", bg: "#F5EADD" },
  "Aguarda devolução do cliente": { color: "#7A2A24", bg: "#F5D9D6" },
  "Artigo devolvido recebido": { color: "#832F72", bg: "#F7E3F2" },
  "Novo artigo enviado": { color: "#832F72", bg: "#F7E3F2" },
  "Concluída": { color: "#254238", bg: "#DCEBE4" },
  "Cancelada": { color: "#8A8677", bg: "#F1EDE3" },
};
export const EXCHANGE_MOTIVOS = ["Tamanho errado", "Não gostou", "Defeito", "Artigo diferente do anunciado", "Outro"];

// Cor e Padrão passaram a ser listas parametrizáveis em Definições (tabelas article_cores
// e article_padroes) — já não são constantes fixas no código.
export function opcoesAtivas(lista) {
  return (lista || []).filter((v) => v.ativo !== false && !v.deleted_at).sort((a, b) => a.valor.localeCompare(b.valor, "pt"));
}

// ---------- Tipos de artigo (totalmente parametrizável em Definições, tabela article_tipos) ----------
// A lista de Tipos já não é fixa no código — cada linha (Grupo + Peça + Código + Permite
// venda? + Tem tamanho?) é gerida livremente pela Rosa/Rita nas Definições. Estas funções
// leem sempre a lista viva (passada como `tipos`, vinda de useRealtimeTable("article_tipos")).

export function tipoEntryFor(tipoLabel, tipos) {
  return (tipos || []).find((t) => t.peca === tipoLabel) || null;
}

export function tipoTemTamanho(tipoLabel, tipos) {
  return !!tipoEntryFor(tipoLabel, tipos)?.tem_tamanho;
}

// Um Tipo com "permite_venda" desligado é material interno (etiquetas, caixas, sacos de
// envio, cabides, etc.) — nunca vendido a clientes, só para controlar o stock desse
// material de apoio. O pisco "Material interno" (uso_interno) do artigo marca-se sozinho
// consoante o Tipo escolhido — nunca à mão.
export function tipoUsoInterno(tipoLabel, tipos) {
  const entry = tipoEntryFor(tipoLabel, tipos);
  return entry ? !entry.permite_venda : false;
}

// Um Tipo marcado "eh_etiqueta" (ex: "Etiquetas") serve para dar baixa de stock quando um
// artigo vendável é marcado "Peça já etiquetada" (ver ArticleModal / etiqueta_consumos).
export function tipoEhEtiqueta(tipoLabel, tipos) {
  return !!tipoEntryFor(tipoLabel, tipos)?.eh_etiqueta;
}

// Agrupa os Tipos ativos por Grupo, ordenados — pronto a usar num <select> com <optgroup>.
// Grupos que só têm Tipos "Não vendáveis" (ex: Material Interno) aparecem sempre no fim da
// lista — os grupos vendáveis vêm primeiro, para não atrapalhar a escolha do dia a dia.
export function tiposAgrupados(tipos) {
  const ativos = (tipos || []).filter((t) => t.ativo !== false && !t.deleted_at);
  const grupos = [...new Set(ativos.map((t) => t.grupo))];
  const vendavel = (grupo) => ativos.some((t) => t.grupo === grupo && t.permite_venda);
  grupos.sort((a, b) => {
    const va = vendavel(a), vb = vendavel(b);
    if (va !== vb) return va ? -1 : 1;
    return a.localeCompare(b, "pt");
  });
  return grupos.map((grupo) => ({
    grupo,
    pecas: ativos.filter((t) => t.grupo === grupo).sort((a, b) => a.peca.localeCompare(b.peca, "pt")),
  }));
}

export const TAG_OPTIONS = [
  { value: "VIP", label: "VIP", color: "#832F72", bg: "#F7E3F2" },
  { value: "Urgente", label: "Urgente", color: "#7A2A24", bg: "#F5D9D6" },
  { value: "Novo", label: "Novo", color: "#254238", bg: "#DCEBE4" },
  { value: "Atenção", label: "Atenção", color: "#A67C1E", bg: "#F5EADD" },
  { value: "Sazonal", label: "Sazonal", color: "#4A2A85", bg: "#EEE1FB" },
];
export function tagColor(value) {
  return TAG_OPTIONS.find((t) => t.value === value) || null;
}

export function nextSkuForCode(code, articles) {
  const nums = articles
    .map((a) => a.sku)
    .filter((s) => s && s.startsWith(code + "-"))
    .map((s) => parseInt(s.split("-")[1], 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${code}-${String(next).padStart(3, "0")}`;
}

// ---------- Centro de Conteúdo ----------
export const CONTENT_STATUS = ["Por fotografar", "Fotografado", "Editado", "Publicado"];
export const CONTENT_STATUS_COLORS = {
  "Por fotografar": { color: "#7A2A24", bg: "#F5D9D6" },
  Fotografado: { color: "#A67C1E", bg: "#F5EADD" },
  Editado: { color: "#4A2A85", bg: "#EEE1FB" },
  Publicado: { color: "#254238", bg: "#DCEBE4" },
};
export const CONTENT_NETWORKS = ["Instagram", "TikTok", "Facebook"];
export const CONTENT_NETWORK_COLORS = {
  Instagram: { color: "#832F72", bg: "#F7E3F2" },
  TikTok: { color: "#1C2541", bg: "#E4E6ED" },
  Facebook: { color: "#254238", bg: "#DCEBE4" },
};
export const CONTENT_TIPOS = ["Reel", "Post", "Stories"];
export const CONTENT_TIPO_PREFIXO = { Reel: "REEL", Post: "POST", Stories: "STORY" };
export const CONTENT_TIPO_COLORS = {
  Reel: { color: "#832F72", bg: "#F7E3F2" },
  Post: { color: "#1C2541", bg: "#E4E6ED" },
  Stories: { color: "#A67C1E", bg: "#F5EADD" },
};

// ---------- Diretos ----------
export const LIVE_ESTADOS = ["Preparação", "Em curso", "Terminado"];
export const LIVE_ESTADO_COLORS = {
  "Preparação": { color: "#A67C1E", bg: "#F5EADD" },
  "Em curso": { color: "#7A2A24", bg: "#F5D9D6" },
  "Terminado": { color: "#254238", bg: "#DCEBE4" },
};
export const REGISTO_ESTADOS = ["Por validar", "Vendido", "Lista de espera", "Cancelado"];
export const REGISTO_ESTADO_COLORS = {
  "Por validar": { color: "#A67C1E", bg: "#F5EADD" },
  Vendido: { color: "#254238", bg: "#DCEBE4" },
  "Lista de espera": { color: "#832F72", bg: "#F7E3F2" },
  Cancelado: { color: "#7A2A24", bg: "#F5D9D6" },
};

// ---------- Saudação do Painel ----------
export const MOTIVATIONAL_QUOTES = [
  "Cada peça em segunda mão é uma história que continua.",
  "Vender com alma é dar uma segunda vida a cada peça.",
  "Pequenos passos todos os dias constroem grandes negócios.",
  "A moda passa, o estilo — e o cuidado com o planeta — fica.",
  "Hoje é um bom dia para vender mais uma história.",
  "Cuidar do que já existe também é criar.",
  "O sucesso é feito de detalhes bem tratados, um a um.",
  "Cada cliente satisfeito é a melhor publicidade que existe.",
  "Reutilizar é um ato de estilo e de consciência.",
  "Um negócio feito com carinho nota-se em cada venda.",
  "A consistência de hoje é o resultado de amanhã.",
  "Vestir bem não precisa custar ao planeta.",
  "Cada dia é uma nova oportunidade de fazer melhor.",
  "O que é dado com cuidado, vende-se com orgulho.",
  "Devagar e sempre também se chega longe.",
  "Bom trabalho não pede pressa, pede constância.",
];
