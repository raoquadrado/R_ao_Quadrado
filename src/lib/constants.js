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
export const APP_VERSION = "1.4.0";
export const APP_RELEASE_DATE = "2026-08-14";
// Histórico de alterações — a entrada [0] é sempre a mais recente. Cada uma tem "data"
// (fiável, vem do dia em que a alteração foi feita) — sem hora exata, porque não há acesso
// a um relógio em tempo real; dentro do mesmo dia, a ordem da lista é a ordem em que as
// alterações foram feitas. Sempre que se pede uma alteração nova, acrescenta-se uma entrada
// aqui, no topo.
export const APP_CHANGELOG = [
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
export const ARTICLE_ESTADOS = ["Em stock", "Esgotado — vai repor", "Sem Reposição", "Pausado"];
export const ARTICLE_ESTADO_COLORS = {
  "Em stock": { color: "#254238", bg: "#DCEBE4" },
  "Esgotado — vai repor": { color: "#A67C1E", bg: "#F5EADD" },
  "Sem Reposição": { color: "#7A2A24", bg: "#F5D9D6" },
  "Pausado": { color: "#8A8677", bg: "#F1EDE3" },
};
// Estes dois estados representam artigos que não estão ativamente à venda por escolha —
// não fazem sentido nos alertas de "stock esgotado/baixo" do Painel, já que já se sabe.
export const ARTICLE_ESTADOS_SEM_ALERTA = ["Sem Reposição", "Pausado"];

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

export const COLOR_OPTIONS = [
  "Amarelo", "Amarelo mostarda", "Azul", "Azul bebé", "Azul claro", "Azul escuro", "Azul esverdeado",
  "Azul marinho", "Azul turquesa", "Bege", "Branco", "Caramelo", "Castanho", "Castanho claro", "Castanho escuro",
  "Cinzento", "Cinzento claro", "Cinzento escuro", "Coral", "Creme", "Dourado", "Grafite", "Laranja", "Lavanda",
  "Lilás", "Nude", "Prateado", "Preto", "Rosa", "Rosa choque", "Rosa claro", "Rosa velho", "Rosa vivo", "Roxo",
  "Terracota", "Verde", "Verde água", "Verde claro", "Verde escuro", "Verde esmeralda", "Verde lima", "Verde oliva",
  "Vermelho", "Vinho",
].sort((a, b) => a.localeCompare(b, "pt"));

export const PATTERN_OPTIONS = [
  "Animal print", "Estampado", "Floral", "Liso", "Multicolor", "Poás", "Riscas", "Xadrez",
].sort((a, b) => a.localeCompare(b, "pt"));

export const TIPO_OPTIONS = [
  { label: "Blazer", code: "BLZ", group: "Vestuário" },
  { label: "Blusa", code: "BLU", group: "Vestuário" },
  { label: "Calças", code: "CAL", group: "Vestuário" },
  { label: "Camisa", code: "CAM", group: "Vestuário" },
  { label: "Camisola", code: "CML", group: "Vestuário" },
  { label: "Casaco", code: "CAS", group: "Vestuário" },
  { label: "Colete", code: "CTE", group: "Vestuário" },
  { label: "Fato de banho", code: "FDB", group: "Vestuário" },
  { label: "Jeans", code: "JNS", group: "Vestuário" },
  { label: "Leggings", code: "LEG", group: "Vestuário" },
  { label: "Pijama", code: "PIJ", group: "Vestuário" },
  { label: "Roupa interior", code: "RIN", group: "Vestuário" },
  { label: "Saia", code: "SAI", group: "Vestuário" },
  { label: "Sweatshirt", code: "SWT", group: "Vestuário" },
  { label: "T-shirt", code: "TSH", group: "Vestuário" },
  { label: "Vestido", code: "VES", group: "Vestuário" },
  { label: "Bijuteria", code: "BIJ", group: "Acessórios" },
  { label: "Boné", code: "BON", group: "Acessórios" },
  { label: "Cachecol", code: "CCH", group: "Acessórios" },
  { label: "Carteira", code: "CRT", group: "Acessórios" },
  { label: "Chapéu", code: "CHP", group: "Acessórios" },
  { label: "Cinto", code: "CIN", group: "Acessórios" },
  { label: "Lenço", code: "LEN", group: "Acessórios" },
  { label: "Luvas", code: "LUV", group: "Acessórios" },
  { label: "Mala", code: "MAL", group: "Acessórios" },
  { label: "Óculos", code: "OCL", group: "Acessórios" },
  { label: "Botas", code: "BOT", group: "Calçado" },
  { label: "Chinelos", code: "CHL", group: "Calçado" },
  { label: "Sandálias", code: "SAN", group: "Calçado" },
  { label: "Sapatos", code: "SAP", group: "Calçado" },
  { label: "Saltos altos", code: "SLT", group: "Calçado" },
  { label: "Ténis", code: "TEN", group: "Calçado" },
].sort((a, b) => a.label.localeCompare(b.label, "pt"));

// Tipos que costumam ter tamanho: toda a Vestuário e Calçado, mais alguns Acessórios.
// Ajusta esta lista se quiseres que mais acessórios (Luvas, Chapéu, Boné…) também tenham tamanho.
const SIZED_ACESSORIOS = new Set(["Cinto"]);
export function tipoTemTamanho(tipoLabel) {
  const entry = TIPO_OPTIONS.find((t) => t.label === tipoLabel);
  if (!entry) return false;
  if (entry.group === "Vestuário" || entry.group === "Calçado") return true;
  return SIZED_ACESSORIOS.has(entry.label);
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
