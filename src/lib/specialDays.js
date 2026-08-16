// Feriados nacionais de Portugal (fixos e móveis) e dias especiais/internacionais, para
// mostrar junto à data no Painel. A lista de dias especiais cobre os mais conhecidos, mas
// não é exaustiva — há centenas de "dias internacionais" por ano; dá para acrescentar mais
// aqui.
//
// Feriados municipais: como a loja vende para todo o país, não faz sentido seguir um único
// concelho — em vez disso, mostram-se os feriados municipais das localidades combinadas:
// Lisboa, Porto, Seixal e Alcobaça. Se um dia se justificar acrescentar mais, é só somar
// outra linha a FERIADOS_MUNICIPAIS.

const FERIADOS_FIXOS = [
  { mes: 1, dia: 1, nome: "Ano Novo" },
  { mes: 4, dia: 25, nome: "Dia da Liberdade" },
  { mes: 5, dia: 1, nome: "Dia do Trabalhador" },
  { mes: 6, dia: 10, nome: "Dia de Portugal" },
  { mes: 8, dia: 15, nome: "Assunção de Nossa Senhora" },
  { mes: 10, dia: 5, nome: "Implantação da República" },
  { mes: 11, dia: 1, nome: "Dia de Todos os Santos" },
  { mes: 12, dia: 1, nome: "Restauração da Independência" },
  { mes: 12, dia: 8, nome: "Imaculada Conceição" },
  { mes: 12, dia: 25, nome: "Natal" },
];

const FERIADOS_MUNICIPAIS = [
  { mes: 6, dia: 13, nome: "Feriado Municipal de Lisboa (Santo António)" },
  { mes: 6, dia: 24, nome: "Feriado Municipal do Porto (São João Baptista)" },
  { mes: 6, dia: 29, nome: "Feriado Municipal do Seixal (São Pedro)" },
  { mes: 8, dia: 20, nome: "Feriado Municipal de Alcobaça (São Bernardo)" },
];

// Domingo de Páscoa, pelo algoritmo do calendário gregoriano (Meeus/Jones/Butcher).
function domingoDePascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function maisDias(data, n) {
  const r = new Date(data);
  r.setDate(r.getDate() + n);
  return r;
}

function feriadosMoveis(ano) {
  const pascoa = domingoDePascoa(ano);
  return [
    { data: maisDias(pascoa, -47), nome: "Carnaval (facultativo)" },
    { data: maisDias(pascoa, -2), nome: "Sexta-feira Santa" },
    { data: pascoa, nome: "Páscoa" },
    { data: maisDias(pascoa, 60), nome: "Corpo de Deus" },
  ];
}

// Dias especiais/internacionais mais conhecidos, por "MM-DD".
const DIAS_ESPECIAIS = {
  "01-04": ["Dia Mundial do Braille"],
  "01-21": ["Dia do Abraço"],
  "02-02": ["Dia da Marmota"],
  "02-04": ["Dia Mundial do Cancro"],
  "02-11": ["Dia Internacional da Mulher e Rapariga na Ciência"],
  "02-14": ["Dia dos Namorados"],
  "02-20": ["Dia Mundial da Justiça Social"],
  "02-21": ["Dia Internacional da Língua Materna"],
  "03-01": ["Dia Mundial da Zero Discriminação"],
  "03-03": ["Dia Mundial da Vida Selvagem"],
  "03-08": ["Dia Internacional da Mulher"],
  "03-20": ["Dia Internacional da Felicidade"],
  "03-21": ["Dia Mundial da Poesia", "Dia Internacional para a Eliminação da Discriminação Racial"],
  "03-22": ["Dia Mundial da Água"],
  "03-23": ["Dia Meteorológico Mundial"],
  "03-27": ["Dia Mundial do Teatro"],
  "04-01": ["Dia da Mentira"],
  "04-02": ["Dia Mundial de Consciencialização do Autismo"],
  "04-07": ["Dia Mundial da Saúde"],
  "04-22": ["Dia da Terra"],
  "04-23": ["Dia Mundial do Livro"],
  "04-29": ["Dia Internacional da Dança"],
  "05-03": ["Dia Mundial da Liberdade de Imprensa"],
  "05-04": ["Star Wars Day"],
  "05-08": ["Dia Mundial da Cruz Vermelha"],
  "05-12": ["Dia Mundial do Enfermeiro"],
  "05-15": ["Dia Internacional da Família"],
  "05-17": ["Dia Mundial das Telecomunicações", "Dia Internacional Contra a Homofobia"],
  "05-20": ["Dia Mundial das Abelhas"],
  "05-21": ["Dia Mundial da Diversidade Cultural"],
  "05-25": ["Dia Mundial da Toalha"],
  "05-31": ["Dia Mundial sem Tabaco"],
  "06-01": ["Dia Mundial da Criança"],
  "06-05": ["Dia Mundial do Ambiente"],
  "06-08": ["Dia Mundial dos Oceanos"],
  "06-14": ["Dia Mundial do Dador de Sangue"],
  "06-20": ["Dia Mundial do Refugiado"],
  "06-21": ["Dia Mundial da Música", "Dia Internacional do Yoga"],
  "06-23": ["Dia Olímpico"],
  "07-06": ["Dia Internacional do Beijo"],
  "07-11": ["Dia Mundial da População"],
  "07-17": ["Dia Mundial dos Emojis"],
  "07-18": ["Dia Internacional de Nelson Mandela"],
  "07-30": ["Dia Internacional da Amizade"],
  "08-08": ["Dia Internacional do Gato"],
  "08-09": ["Dia Internacional dos Povos Indígenas"],
  "08-12": ["Dia Internacional da Juventude"],
  "08-13": ["Dia Internacional do Canhoto"],
  "08-19": ["Dia Mundial Humanitário", "Dia Mundial da Fotografia"],
  "08-26": ["Dia da Igualdade das Mulheres"],
  "09-08": ["Dia Internacional da Alfabetização"],
  "09-09": ["Dia Internacional da Beleza"],
  "09-13": ["Dia Internacional do Chocolate"],
  "09-15": ["Dia Internacional da Democracia"],
  "09-21": ["Dia Internacional da Paz"],
  "09-27": ["Dia Mundial do Turismo"],
  "09-29": ["Dia Mundial do Coração"],
  "09-30": ["Dia Internacional da Tradução"],
  "10-01": ["Dia Internacional do Café", "Dia Internacional das Pessoas Idosas"],
  "10-02": ["Dia Internacional da Não-Violência"],
  "10-04": ["Dia Mundial dos Animais"],
  "10-10": ["Dia Mundial da Saúde Mental"],
  "10-16": ["Dia Mundial da Alimentação"],
  "10-24": ["Dia das Nações Unidas"],
  "10-31": ["Dia das Bruxas"],
  "11-14": ["Dia Mundial da Diabetes"],
  "11-16": ["Dia Internacional da Tolerância"],
  "11-19": ["Dia Internacional do Homem"],
  "11-20": ["Dia Universal da Criança"],
  "11-21": ["Dia Mundial da Televisão"],
  "11-25": ["Dia Internacional pela Eliminação da Violência contra as Mulheres"],
  "12-01": ["Dia Mundial de Luta contra a Sida"],
  "12-03": ["Dia Internacional das Pessoas com Deficiência"],
  "12-05": ["Dia Internacional do Voluntariado"],
  "12-10": ["Dia dos Direitos Humanos"],
};

function partesData(dateOrISO) {
  const d = typeof dateOrISO === "string" ? new Date(`${dateOrISO}T00:00:00`) : dateOrISO;
  return { d, mes: d.getMonth() + 1, dia: d.getDate(), ano: d.getFullYear() };
}

// Feriado do dia: { nome, tipo: "nacional" | "municipal" } ou null. Inclui os móveis
// (Páscoa, Carnaval, etc.) e os municipais definidos em FERIADOS_MUNICIPAIS.
export function feriadoDoDia(dateOrISO) {
  const { mes, dia, ano } = partesData(dateOrISO);
  const fixo = FERIADOS_FIXOS.find((f) => f.mes === mes && f.dia === dia);
  if (fixo) return { nome: fixo.nome, tipo: "nacional" };
  const movel = feriadosMoveis(ano).find((f) => f.data.getMonth() + 1 === mes && f.data.getDate() === dia);
  if (movel) return { nome: movel.nome, tipo: "nacional" };
  const municipal = FERIADOS_MUNICIPAIS.find((f) => f.mes === mes && f.dia === dia);
  if (municipal) return { nome: municipal.nome, tipo: "municipal" };
  return null;
}

// Lista de dias especiais/curiosos/internacionais para esse dia (pode ter mais do que um).
export function diasEspeciaisDoDia(dateOrISO) {
  const { mes, dia } = partesData(dateOrISO);
  const chave = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return DIAS_ESPECIAIS[chave] || [];
}

// ---------- Calendário de marketing (datas boas para conteúdo, para uma loja de moda) ----------
// Distinto da lista genérica de dias especiais acima — aqui só entram datas que costumam
// motivar compras/publicações de roupa e acessórios. Serve de base às sugestões automáticas
// de conteúdo no Centro de Tarefas. A lista de datas FIXAS é gerida pela Rosa/Rita nas
// Definições (tabela "marketing_dates") — os valores abaixo são só a semente inicial.
export const DATAS_MARKETING_FIXAS_DEFEITO = [
  { mes: 1, dia: 1, nome: "Ano Novo" },
  { mes: 2, dia: 14, nome: "Dia dos Namorados" },
  { mes: 3, dia: 8, nome: "Dia Internacional da Mulher" },
  { mes: 3, dia: 19, nome: "Dia do Pai" },
  { mes: 6, dia: 1, nome: "Dia da Criança" },
  { mes: 10, dia: 31, nome: "Halloween" },
  { mes: 12, dia: 25, nome: "Natal" },
];

function primeiroDomingoDeMaio(ano) {
  const d = new Date(ano, 4, 1); // 1 de maio
  const offset = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + offset);
  return d;
}

// Black Friday: sexta-feira depois da 4ª quinta-feira de novembro (mesma convenção dos EUA,
// já adotada em Portugal). Estas duas datas móveis não são editáveis — mudam de dia todos os
// anos por fórmula, por isso não fazem sentido como "mes/dia" fixo geríveis à mão.
function blackFriday(ano) {
  const d = new Date(ano, 10, 1); // 1 de novembro
  let quintas = 0;
  while (quintas < 4) {
    if (d.getDay() === 4) quintas++;
    if (quintas < 4) d.setDate(d.getDate() + 1);
  }
  d.setDate(d.getDate() + 1); // sexta-feira seguinte
  return d;
}

function datasMarketingMoveis(ano) {
  return [
    { data: primeiroDomingoDeMaio(ano), nome: "Dia da Mãe" },
    { data: blackFriday(ano), nome: "Black Friday" },
  ];
}

// Todas as datas de marketing entre hoje e "diasAntecedencia" dias à frente (inclusive),
// já ordenadas pela mais próxima primeiro. Cada entrada: { iso, nome, diasFalta }.
// "datasFixas" — lista vinda da base de dados (tabela marketing_dates, já sem as inativas);
// se não for passada, usa a semente por defeito (útil em testes/preview antes de carregar).
export function datasMarketingProximas(diasAntecedencia = 10, hojeDate = new Date(), datasFixas = DATAS_MARKETING_FIXAS_DEFEITO) {
  const hoje = new Date(hojeDate.getFullYear(), hojeDate.getMonth(), hojeDate.getDate());
  const resultado = [];
  [hoje.getFullYear(), hoje.getFullYear() + 1].forEach((ano) => {
    const todas = [
      ...datasFixas.map((f) => ({ data: new Date(ano, f.mes - 1, f.dia), nome: f.nome })),
      ...datasMarketingMoveis(ano),
    ];
    todas.forEach(({ data, nome }) => {
      const diasFalta = Math.round((data.getTime() - hoje.getTime()) / 86400000);
      if (diasFalta >= 0 && diasFalta <= diasAntecedencia) {
        resultado.push({ iso: data.toISOString().slice(0, 10), nome, diasFalta });
      }
    });
  });
  return resultado.sort((a, b) => a.diasFalta - b.diasFalta);
}

