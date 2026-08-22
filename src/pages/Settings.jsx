import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { updateRow, insertRow, deleteRow } from "../lib/useRealtimeTable";
import { getTestMode } from "../lib/testMode";
import { uid, displaySku } from "../lib/computations";
import { DEFAULT_SETTINGS, tipoUsoInterno, tipoEhEtiqueta } from "../lib/constants";
import { gerarCopiaSeguranca, descarregarJSON, restaurarCopiaSeguranca } from "../lib/backup";
import { uploadLogo } from "../lib/photoStorage";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, inputCls, ModalShell, ModalActions, EmptyRow } from "../components/ui";

const CAMPOS = [
  {
    grupo: "💰 Preços",
    campos: [
      { key: "margem_alvo_pct", label: "Margem-alvo sugerida (%)", ajuda: "Ao preencher o preço de compra de um artigo, a app sugere logo um valor de venda com base nesta margem." },
    ],
  },
  {
    grupo: "📦 Stock",
    campos: [
      { key: "stock_baixo_limite", label: "Limiar de \"stock baixo\" (unidades)", ajuda: "Um artigo entra no alerta de stock baixo quando tiver esta quantidade ou menos." },
      { key: "artigo_parado_dias", label: "Dias para considerar um artigo \"parado\"", ajuda: "Um artigo sem vender há mais destes dias entra no alerta de \"artigo parado\"." },
    ],
  },
  {
    grupo: "🔁 Trocas",
    campos: [
      { key: "troca_janela_dias", label: "Janela de troca (dias)", ajuda: "Prazo legal em Portugal: 14 dias. A data limite de cada troca conta-se a partir da data da venda." },
      { key: "troca_aviso_dias", label: "Antecedência do aviso de troca a expirar (dias)", ajuda: "Quantos dias antes do prazo terminar a app avisa no Painel." },
    ],
  },
  {
    grupo: "💡 Sugestões de Preço",
    campos: [
      { key: "sugestao_promover_dias", label: "Dias em stock para sugerir \"Promover\"", ajuda: "" },
      { key: "sugestao_liquidar_dias", label: "Dias em stock para sugerir \"Liquidar\"", ajuda: "" },
      { key: "sugestao_stock_alto_qtd", label: "Quantidade considerada \"stock alto\"", ajuda: "" },
      { key: "sugestao_margem_baixa_pct", label: "Margem considerada \"já baixa\" (%)", ajuda: "Abaixo deste valor, uma sugestão de \"Liquidar\" desce automaticamente para \"Promover\"." },
    ],
  },
  {
    grupo: "📢 Conteúdo",
    campos: [
      { key: "conteudo_aviso_dias", label: "Antecedência da sugestão de datas especiais (dias)", ajuda: "Quantos dias antes de uma data de marketing (Natal, Black Friday, etc.) a app sugere preparar conteúdo." },
    ],
  },
  {
    grupo: "👥 Clientes",
    campos: [
      { key: "pontos_boas_vindas", label: "Pontos de bónus de boas-vindas", ajuda: "Pontos com que um cliente novo começa. Não se aplica retroativamente a clientes já existentes." },
    ],
  },
];

const CAMPOS_ENCOMENDAS = [
  { key: "transportadora_padrao", label: "Transportadora pré-definida", tipo: "text", ajuda: "ex: CTT, DPD, GLS…" },
  { key: "prazo_envio_dias", label: "Prazo de envio (dias úteis)", tipo: "number", ajuda: "" },
  { key: "portes_nacionais", label: "Portes nacionais (€)", tipo: "number", ajuda: "" },
  { key: "portes_internacionais", label: "Portes internacionais (€)", tipo: "number", ajuda: "" },
  { key: "portes_gratis_acima", label: "Portes grátis a partir de (€)", tipo: "number", ajuda: "Deixar em branco se não houver portes grátis." },
];

export default function Settings({ settings, marketingDates, tipos, cores, padroes, articlesComputed, embalagens, embalagemItens, transformacoes, transformacaoItens }) {
  const [f, setF] = useState({ ...DEFAULT_SETTINGS, ...settings });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    setF({ ...DEFAULT_SETTINGS, ...settings });
    setDirty(false);
  }, [settings]);

  function set(key, value) {
    setF((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      set("logo_url", url);
    } catch (err) {
      notify("Não foi possível enviar o logótipo: " + (err.message || "erro desconhecido"), "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const { id, updated_at, ...clean } = f;
    await updateRow("settings", true, { ...clean, updated_at: new Date().toISOString() });
    setSaving(false);
    setDirty(false);
    notify("Definições guardadas.");
  }

  function handleReset() {
    setF({ ...DEFAULT_SETTINGS });
    setDirty(true);
  }

  const [novaData, setNovaData] = useState({ mes: "", dia: "", nome: "" });
  const [addingDate, setAddingDate] = useState(false);
  const datasOrdenadas = [...(marketingDates || [])].sort((a, b) => a.mes - b.mes || a.dia - b.dia);

  async function handleAddDate() {
    const mes = Number(novaData.mes), dia = Number(novaData.dia);
    if (!mes || mes < 1 || mes > 12) { notify("Indica um mês válido (1-12).", "error"); return; }
    if (!dia || dia < 1 || dia > 31) { notify("Indica um dia válido (1-31).", "error"); return; }
    if (!novaData.nome.trim()) { notify("Indica um nome para a data.", "error"); return; }
    setAddingDate(true);
    try {
      await insertRow("marketing_dates", { mes, dia, nome: novaData.nome.trim(), ativo: true });
      setNovaData({ mes: "", dia: "", nome: "" });
      notify("Data de marketing adicionada.");
    } catch (err) {
      notify(err.message || "Não foi possível adicionar a data.", "error");
    } finally {
      setAddingDate(false);
    }
  }
  async function toggleDateAtiva(d) {
    await updateRow("marketing_dates", d.id, { ativo: !d.ativo });
  }
  async function handleDeleteDate(d) {
    const ok = await confirm({ title: "Eliminar data de marketing?", message: `"${d.nome}" deixa de sugerir tarefas de conteúdo.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("marketing_dates", d.id);
    notify("Data removida.");
  }

  const [novoTipo, setNovoTipo] = useState({ grupo: "", peca: "", codigo: "", permite_venda: true, tem_tamanho: false });
  const [addingTipo, setAddingTipo] = useState(false);
  const gruposExistentes = [...new Set((tipos || []).map((t) => t.grupo))].sort((a, b) => a.localeCompare(b, "pt"));
  const tiposOrdenados = [...(tipos || [])].sort((a, b) => a.grupo.localeCompare(b.grupo, "pt") || a.peca.localeCompare(b.peca, "pt"));

  async function handleAddTipo() {
    const grupo = novoTipo.grupo.trim();
    const peca = novoTipo.peca.trim();
    const codigo = novoTipo.codigo.trim().toUpperCase();
    if (!grupo) { notify("Indica o Grupo (ex: Vestuário, Embalagens).", "error"); return; }
    if (!peca) { notify("Indica a Peça (ex: Blazer, Saco de plástico 10x10cm).", "error"); return; }
    if (!codigo) { notify("Indica um Código para gerar o SKU (ex: BLZ).", "error"); return; }
    const duplicadoPeca = (tipos || []).some((t) => !t.deleted_at && t.peca.trim().toLowerCase() === peca.toLowerCase());
    if (duplicadoPeca) { notify(`Já existe uma Peça "${peca}" — escolhe outro nome.`, "error"); return; }
    const duplicadoCodigo = (tipos || []).some((t) => !t.deleted_at && t.codigo.trim().toUpperCase() === codigo);
    if (duplicadoCodigo) { notify(`Já existe um Tipo com o código "${codigo}" — escolhe outro.`, "error"); return; }
    setAddingTipo(true);
    try {
      await insertRow("article_tipos", { grupo, peca, codigo, permite_venda: !!novoTipo.permite_venda, tem_tamanho: !!novoTipo.tem_tamanho, ativo: true });
      setNovoTipo({ grupo: "", peca: "", codigo: "", permite_venda: true, tem_tamanho: false });
      notify("Tipo de artigo adicionado.");
    } catch (err) {
      notify(err.message || "Não foi possível adicionar o Tipo.", "error");
    } finally {
      setAddingTipo(false);
    }
  }
  async function toggleTipoCampo(t, campo) {
    await updateRow("article_tipos", t.id, { [campo]: !t[campo] });
  }
  async function handleTipoField(t, campo, valor) {
    if (valor === t[campo]) return;
    await updateRow("article_tipos", t.id, { [campo]: valor });
  }
  async function handleDeleteTipo(t) {
    const ok = await confirm({ title: "Eliminar Tipo de artigo?", message: `"${t.peca}" deixa de aparecer nas opções de Tipo — artigos já criados com este Tipo mantêm-se, só a opção desaparece da lista.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("article_tipos", t.id);
    notify("Tipo removido.");
  }

  // ---------- Cores e Padrões (mesma forma simples: valor + ativo) ----------
  const [novaCor, setNovaCor] = useState("");
  const [addingCor, setAddingCor] = useState(false);
  const coresOrdenadas = [...(cores || [])].sort((a, b) => a.valor.localeCompare(b.valor, "pt"));
  const [novoPadrao, setNovoPadrao] = useState("");
  const [addingPadrao, setAddingPadrao] = useState(false);
  const padroesOrdenados = [...(padroes || [])].sort((a, b) => a.valor.localeCompare(b.valor, "pt"));

  async function handleAddValor(tabela, valorBruto, lista, setValor, setAdding) {
    const valor = valorBruto.trim();
    if (!valor) { notify("Escreve um valor antes de adicionar.", "error"); return; }
    if ((lista || []).some((v) => !v.deleted_at && v.valor.trim().toLowerCase() === valor.toLowerCase())) {
      notify(`"${valor}" já existe nesta lista.`, "error"); return;
    }
    setAdding(true);
    try {
      await insertRow(tabela, { valor, ativo: true });
      setValor("");
    } catch (err) {
      notify(err.message || "Não foi possível adicionar.", "error");
    } finally {
      setAdding(false);
    }
  }
  async function toggleValorAtivo(tabela, v) {
    await updateRow(tabela, v.id, { ativo: v.ativo === false ? true : false });
  }
  async function handleDeleteValor(tabela, v, label) {
    const ok = await confirm({ title: `Eliminar ${label}?`, message: `"${v.valor}" deixa de aparecer nas opções — artigos já criados com este valor mantêm-se.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow(tabela, v.id);
    notify(`${label} removido(a).`);
  }

  // ---------- Etiquetas e Embalagens ----------
  const [embalagemModal, setEmbalagemModal] = useState(null); // { embalagem } — a criar/editar
  const embalagensOrdenadas = [...(embalagens || [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  const itensPorEmbalagem = (embalagemId) => (embalagemItens || []).filter((it) => it.embalagem_id === embalagemId);
  // Candidatos a entrar numa receita: só material interno, nunca etiquetas (essas só saem
  // pelo pisco "Peça já etiquetada" de cada venda — ver secção 6/9).
  const artigosParaEmbalagem = (articlesComputed || []).filter((a) => tipoUsoInterno(a.tipo, tipos) && !tipoEhEtiqueta(a.tipo, tipos));

  async function toggleEmbalagemAtiva(e) {
    await updateRow("embalagens", e.id, { ativo: e.ativo === false ? true : false });
  }
  async function handleDeleteEmbalagem(e) {
    const ok = await confirm({ title: "Eliminar Tipo de Embalagem?", message: `"${e.nome}" deixa de aparecer nas opções — encomendas já criadas com esta Embalagem mantêm-se.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("embalagens", e.id);
    notify("Tipo de Embalagem removido.");
  }

  // ---------- Transformações ----------
  const [transformacaoModal, setTransformacaoModal] = useState(null); // { transformacao } — a criar/editar
  const transformacoesOrdenadas = [...(transformacoes || [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  const itensPorTransformacao = (transformacaoId) => (transformacaoItens || []).filter((it) => it.transformacao_id === transformacaoId);
  // Candidatos a entrar numa receita de transformação (inputs ou output): qualquer material
  // interno, incluindo etiquetas — ao contrário da Embalagem, aqui faz sentido produzir
  // etiquetas a partir de outros materiais (ex: papel + tinteiro → etiquetas).
  const artigosParaTransformacao = (articlesComputed || []).filter((a) => tipoUsoInterno(a.tipo, tipos));

  async function toggleTransformacaoAtiva(t) {
    await updateRow("transformacoes", t.id, { ativo: t.ativo === false ? true : false });
  }
  async function handleDeleteTransformacao(t) {
    const ok = await confirm({ title: "Eliminar Tipo de Transformação?", message: `"${t.nome}" deixa de aparecer nas opções — transformações já executadas mantêm-se.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("transformacoes", t.id);
    notify("Tipo de Transformação removido.");
  }

  async function handleBackup() {
    setBacking(true);
    try {
      const dados = await gerarCopiaSeguranca();
      const nome = `r2-copia-seguranca-${new Date().toISOString().slice(0, 10)}.json`;
      descarregarJSON(dados, nome);
      notify("Cópia de segurança descarregada.");
    } catch (e) {
      notify(e.message, "error");
    }
    setBacking(false);
  }

  function handleFileChosen(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let obj;
      try {
        obj = JSON.parse(reader.result);
      } catch {
        notify("Ficheiro inválido — não é um JSON válido.", "error");
        e.target.value = "";
        return;
      }
      if (!obj || typeof obj !== "object" || !obj.tabelas || typeof obj.tabelas !== "object") {
        notify("Ficheiro inválido — não parece ser uma cópia de segurança desta aplicação.", "error");
        e.target.value = "";
        return;
      }
      const ok = await confirm({
        title: "Restaurar cópia de segurança?",
        message: "Isto substitui, registo a registo (pelo identificador), os dados atuais pelos do ficheiro. Registos que só existam na app agora não são apagados. Não há como desfazer depois. Continuar?",
        confirmLabel: "Restaurar",
      });
      if (!ok) { e.target.value = ""; return; }
      setRestoring(true);
      try {
        await restaurarCopiaSeguranca(obj, (tabela) => setRestoreStep(tabela));
        notify("Cópia de segurança restaurada.");
      } catch (err) {
        notify(err.message, "error");
      }
      setRestoring(false);
      setRestoreStep("");
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold mb-0.5">⚙️ Definições</h1>
        <p className="text-stone text-sm">Os limiares e prazos que a app usa nas suas regras automáticas — ajustem à vontade, sem ser preciso pedir alterações ao código.</p>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">🧪 Modo de Teste</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-sm mb-2">
            O interruptor "🧪 Modo de Teste" está na barra lateral (ou no topo, no telemóvel) — não aqui, porque é algo que se liga/desliga muitas vezes, ao longo do dia.
          </p>
          <p className="text-stone text-sm">
            Com o Modo de Teste ligado, tudo o que criarem — fornecedores, artigos, vendas, diretos, etc. — fica marcado como "de teste" e nunca aparece misturado com os dados reais (nem entra nas contas do Painel, nem nos totais, nem na cópia de segurança dos dados reais). É um espaço à parte para experimentar a app ou testar uma alteração nova, sem qualquer risco. Desligar o interruptor volta a mostrar só os dados reais — o que estava em teste continua guardado, e reaparece da próxima vez que o Modo de Teste for ligado outra vez.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">💾 Cópia de Segurança</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-sm mb-3">
            Descarrega um ficheiro com todos os dados da app — fornecedores, artigos, compras, clientes, vendas, conteúdo, diretos, mensagens, trocas e tarefas. Guardem-no num sítio à parte (o computador, a cloud pessoal, etc.).
          </p>
          <p className="text-stone text-[11px] mb-3">💡 As fotografias dos artigos não vão dentro do ficheiro (ficam guardadas à parte, na nuvem) — só os links para elas, que continuam a funcionar depois de restaurar. Dados criados em Modo de Teste nunca entram aqui — só os dados reais.</p>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary" onClick={handleBackup} disabled={backing}>
              {backing ? "A gerar…" : "⭳ Descarregar cópia de segurança"}
            </Button>
            <label className="text-xs font-medium bg-white border border-line rounded px-3 py-2 cursor-pointer text-ink">
              {restoring ? `A restaurar (${restoreStep})…` : "⬆ Restaurar a partir de um ficheiro"}
              <input type="file" accept="application/json" className="hidden" onChange={handleFileChosen} disabled={restoring} />
            </label>
          </div>
          <p className="text-clay-dark text-[11px] mt-3">⚠ Restaurar substitui os registos existentes que tenham o mesmo identificador pelos do ficheiro — não é reversível. Usar só para recuperar de um problema (ex.: apagou-se algo por engano em massa), não como rotina.</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">🏪 Dados da Empresa</h2>
        <div className="bg-white border border-line rounded-xl p-4 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome da marca">
              <input className={inputCls} value={f.marca_nome || ""} onChange={(e) => set("marca_nome", e.target.value)} />
            </Field>
            <Field label="E-mail">
              <input type="email" className={inputCls} value={f.empresa_email || ""} onChange={(e) => set("empresa_email", e.target.value)} placeholder="loja@example.com" />
            </Field>
            <Field label="Instagram">
              <input className={inputCls} value={f.instagram || ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@utilizador" />
            </Field>
            <Field label="TikTok">
              <input className={inputCls} value={f.tiktok || ""} onChange={(e) => set("tiktok", e.target.value)} placeholder="@utilizador" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Logótipo">
              <div className="flex items-center gap-3">
                {f.logo_url ? (
                  <img src={f.logo_url} alt="Logótipo" className="w-14 h-14 object-contain rounded-lg border border-line bg-paper" />
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-dashed border-line flex items-center justify-center text-stone text-[10px] text-center">sem logo</div>
                )}
                <label className="text-xs font-medium bg-white border border-line rounded px-3 py-2 cursor-pointer text-ink">
                  {uploadingLogo ? "A enviar…" : "Escolher imagem"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploadingLogo} />
                </label>
                {f.logo_url && (
                  <button type="button" onClick={() => set("logo_url", "")} className="text-clay-dark text-xs underline">Remover</button>
                )}
              </div>
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white border border-line rounded-xl p-4">
            <h3 className="text-sm font-semibold text-plum mb-3">Dados da Rosa</h3>
            <div className="flex flex-col gap-3">
              <Field label="Telefone"><input className={inputCls} value={f.rosa_telefone || ""} onChange={(e) => set("rosa_telefone", e.target.value)} /></Field>
              <Field label="Morada"><input className={inputCls} value={f.rosa_morada || ""} onChange={(e) => set("rosa_morada", e.target.value)} /></Field>
              <Field label="NIF"><input className={inputCls} value={f.rosa_nif || ""} onChange={(e) => set("rosa_nif", e.target.value)} /></Field>
            </div>
          </div>
          <div className="bg-white border border-line rounded-xl p-4">
            <h3 className="text-sm font-semibold text-rust mb-3">Dados da Rita</h3>
            <div className="flex flex-col gap-3">
              <Field label="Telefone"><input className={inputCls} value={f.rita_telefone || ""} onChange={(e) => set("rita_telefone", e.target.value)} /></Field>
              <Field label="Morada"><input className={inputCls} value={f.rita_morada || ""} onChange={(e) => set("rita_morada", e.target.value)} /></Field>
              <Field label="NIF"><input className={inputCls} value={f.rita_nif || ""} onChange={(e) => set("rita_nif", e.target.value)} /></Field>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">📦 Dados para Encomendas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white border border-line rounded-xl p-4">
          {CAMPOS_ENCOMENDAS.map((campo) => (
            <Field key={campo.key} label={campo.label}>
              <input
                type={campo.tipo}
                className={inputCls}
                value={f[campo.key] ?? ""}
                onChange={(e) => set(campo.key, campo.tipo === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                min={campo.tipo === "number" ? "0" : undefined}
              />
              {campo.ajuda && <p className="text-stone text-[11px] mt-1">{campo.ajuda}</p>}
            </Field>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">💳 Dados de Pagamentos</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-xs mb-2 font-medium">Métodos aceites</p>
          <div className="flex flex-wrap gap-4 mb-4">
            {[
              { key: "pagamento_mbway", label: "MB Way" },
              { key: "pagamento_transferencia", label: "Transferência bancária" },
              { key: "pagamento_numerario", label: "Numerário" },
              { key: "pagamento_outros", label: "Outros" },
            ].map((m) => (
              <label key={m.key} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" checked={!!f[m.key]} onChange={(e) => set(m.key, e.target.checked)} className="w-3.5 h-3.5" />
                {m.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="IBAN — Rosa"><input className={inputCls} value={f.iban_rosa || ""} onChange={(e) => set("iban_rosa", e.target.value)} placeholder="PT50…" /></Field>
            <Field label="IBAN — Rita"><input className={inputCls} value={f.iban_rita || ""} onChange={(e) => set("iban_rita", e.target.value)} placeholder="PT50…" /></Field>
            <Field label="MB Way — Rosa"><input className={inputCls} value={f.mbway_rosa || ""} onChange={(e) => set("mbway_rosa", e.target.value)} placeholder="9xx xxx xxx" /></Field>
            <Field label="MB Way — Rita"><input className={inputCls} value={f.mbway_rita || ""} onChange={(e) => set("mbway_rita", e.target.value)} placeholder="9xx xxx xxx" /></Field>
          </div>
        </div>
      </div>

      {CAMPOS.map((secao) => (
        <div key={secao.grupo} className="mb-6">
          <h2 className="font-display text-base font-semibold text-ink mb-3">{secao.grupo}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white border border-line rounded-xl p-4">
            {secao.campos.map((campo) => (
              <Field key={campo.key} label={campo.label}>
                <input
                  type="number"
                  className={inputCls}
                  value={f[campo.key]}
                  onChange={(e) => set(campo.key, e.target.value === "" ? "" : Number(e.target.value))}
                  min="0"
                />
                {campo.ajuda && <p className="text-stone text-[11px] mt-1">{campo.ajuda}</p>}
              </Field>
            ))}
          </div>
        </div>
      ))}

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">🏷️ Tipos de Artigo</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-sm mb-3">
            Estes são os Tipos disponíveis ao criar ou editar um artigo (secção Artigos & Stock). Cada Tipo pertence a um Grupo (ex: "Vestuário", "Embalagens") e tem um Código que gera o SKU automaticamente. "Permite venda?" a "Não" marca sozinho o pisco "Material interno" 📦 nesse artigo — para material de apoio ao negócio (etiquetas, caixas, sacos de envio, cabides, etc.) que nunca é vendido a clientes, só controlado em stock. "Etiqueta física?" marca o(s) Tipo(s) (normalmente "Etiquetas") de onde sai 1 unidade sempre que se assinala "Peça já etiquetada" noutro artigo. Acrescentem, editem ou eliminem os que fizerem sentido para a loja.
          </p>
          <div className="overflow-auto mb-3">
            <table>
              <thead><tr><th>Grupo</th><th>Peça</th><th>Código</th><th>Permite venda?</th><th>Tem tamanho?</th><th>Etiqueta física?</th><th>Ativo</th><th></th></tr></thead>
              <tbody>
                {tiposOrdenados.length === 0 && (
                  <tr><td colSpan={8} className="text-stone text-sm py-3 text-center">Ainda não há Tipos de artigo definidos.</td></tr>
                )}
                {tiposOrdenados.map((t) => (
                  <tr key={t.id} className={t.ativo === false ? "opacity-50" : ""}>
                    <td>
                      <input list="grupos-existentes" defaultValue={t.grupo} className={`${inputCls} !py-1 text-xs`}
                        onBlur={(e) => handleTipoField(t, "grupo", e.target.value.trim())} />
                    </td>
                    <td>
                      <input defaultValue={t.peca} className={`${inputCls} !py-1 text-xs`}
                        onBlur={(e) => handleTipoField(t, "peca", e.target.value.trim())} />
                    </td>
                    <td>
                      <input defaultValue={t.codigo} className={`${inputCls} !py-1 text-xs font-mono w-20`}
                        onBlur={(e) => handleTipoField(t, "codigo", e.target.value.trim().toUpperCase())} />
                    </td>
                    <td>
                      <button type="button" onClick={() => toggleTipoCampo(t, "permite_venda")} title={t.permite_venda ? "Permite venda — clicar para desligar" : "Não permite venda (material interno) — clicar para ligar"}>
                        {t.permite_venda ? "✅ Sim" : "📦 Não"}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => toggleTipoCampo(t, "tem_tamanho")} title={t.tem_tamanho ? "Tem tamanho — clicar para desligar" : "Sem tamanho — clicar para ligar"}>
                        {t.tem_tamanho ? "✅ Sim" : "⬜ Não"}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => toggleTipoCampo(t, "eh_etiqueta")} title={t.eh_etiqueta ? "Etiqueta física — clicar para desligar" : "Clicar para marcar como etiqueta física"}>
                        {t.eh_etiqueta ? "🏷️ Sim" : "⬜ Não"}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => toggleTipoCampo(t, "ativo")} title={t.ativo === false ? "Ativar" : "Desativar"}>
                        {t.ativo === false ? "⬜" : "✅"}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => handleDeleteTipo(t)} className="text-stone hover:text-clay-dark text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="grupos-existentes">
              {gruposExistentes.map((g) => <option key={g} value={g} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px_auto_auto_auto_auto] gap-2 items-end">
            <Field label="Grupo">
              <input list="grupos-existentes" className={inputCls} value={novoTipo.grupo} onChange={(e) => setNovoTipo({ ...novoTipo, grupo: e.target.value })} placeholder="ex: Embalagens" />
            </Field>
            <Field label="Peça">
              <input className={inputCls} value={novoTipo.peca} onChange={(e) => setNovoTipo({ ...novoTipo, peca: e.target.value })} placeholder="ex: Saco de plástico 10x10cm" />
            </Field>
            <Field label="Código">
              <input className={`${inputCls} font-mono`} value={novoTipo.codigo} onChange={(e) => setNovoTipo({ ...novoTipo, codigo: e.target.value.toUpperCase() })} placeholder="ex: SAC" maxLength={6} />
            </Field>
            <label className="flex items-center gap-1.5 text-xs text-stone pb-2">
              <input type="checkbox" checked={novoTipo.permite_venda} onChange={(e) => setNovoTipo({ ...novoTipo, permite_venda: e.target.checked })} />
              Permite venda?
            </label>
            <label className="flex items-center gap-1.5 text-xs text-stone pb-2">
              <input type="checkbox" checked={novoTipo.tem_tamanho} onChange={(e) => setNovoTipo({ ...novoTipo, tem_tamanho: e.target.checked })} />
              Tem tamanho?
            </label>
            <label className="flex items-center gap-1.5 text-xs text-stone pb-2">
              <input type="checkbox" checked={novoTipo.eh_etiqueta} onChange={(e) => setNovoTipo({ ...novoTipo, eh_etiqueta: e.target.checked })} />
              Etiqueta física?
            </label>
            <Button variant="primary" onClick={handleAddTipo} disabled={addingTipo}>{addingTipo ? "A adicionar…" : "+ Adicionar"}</Button>
          </div>
          <p className="text-stone text-[11px] mt-3">💡 Eliminar um Tipo só o remove das opções para novos artigos — artigos já criados com esse Tipo não são afetados.</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">🎨 Cores e Padrões</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-sm mb-3">
            As listas de Cor e Padrão do formulário de artigo (secção Artigos & Stock) — dois campos independentes desde a última atualização. Um artigo novo nasce sempre com a cor "N/A" e o padrão "Liso". Acrescentem, desliguem ou eliminem os que fizerem sentido para a loja.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">Cores</h3>
              <div className="overflow-auto mb-2 max-h-60 border border-line rounded-lg">
                <table>
                  <thead><tr><th>Cor</th><th>Ativa</th><th></th></tr></thead>
                  <tbody>
                    {coresOrdenadas.length === 0 && (
                      <tr><td colSpan={3} className="text-stone text-sm py-3 text-center">Sem cores definidas.</td></tr>
                    )}
                    {coresOrdenadas.map((c) => (
                      <tr key={c.id} className={c.ativo === false ? "opacity-50" : ""}>
                        <td>{c.valor}{c.valor === "N/A" && <span className="text-stone text-[11px]"> (por defeito)</span>}</td>
                        <td>
                          <button type="button" onClick={() => toggleValorAtivo("article_cores", c)} title={c.ativo === false ? "Ativar" : "Desativar"} disabled={c.valor === "N/A"}>
                            {c.ativo === false ? "⬜" : "✅"}
                          </button>
                        </td>
                        <td>
                          {c.valor !== "N/A" && <button type="button" onClick={() => handleDeleteValor("article_cores", c, "Cor")} className="text-stone hover:text-clay-dark text-xs">✕</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <input className={inputCls} value={novaCor} onChange={(e) => setNovaCor(e.target.value)} placeholder="ex: Verde-alface" onKeyDown={(e) => e.key === "Enter" && handleAddValor("article_cores", novaCor, cores, setNovaCor, setAddingCor)} />
                <Button variant="primary" onClick={() => handleAddValor("article_cores", novaCor, cores, setNovaCor, setAddingCor)} disabled={addingCor}>+ Adicionar</Button>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">Padrões</h3>
              <div className="overflow-auto mb-2 max-h-60 border border-line rounded-lg">
                <table>
                  <thead><tr><th>Padrão</th><th>Ativo</th><th></th></tr></thead>
                  <tbody>
                    {padroesOrdenados.length === 0 && (
                      <tr><td colSpan={3} className="text-stone text-sm py-3 text-center">Sem padrões definidos.</td></tr>
                    )}
                    {padroesOrdenados.map((p) => (
                      <tr key={p.id} className={p.ativo === false ? "opacity-50" : ""}>
                        <td>{p.valor}{p.valor === "Liso" && <span className="text-stone text-[11px]"> (por defeito)</span>}</td>
                        <td>
                          <button type="button" onClick={() => toggleValorAtivo("article_padroes", p)} title={p.ativo === false ? "Ativar" : "Desativar"} disabled={p.valor === "Liso"}>
                            {p.ativo === false ? "⬜" : "✅"}
                          </button>
                        </td>
                        <td>
                          {p.valor !== "Liso" && <button type="button" onClick={() => handleDeleteValor("article_padroes", p, "Padrão")} className="text-stone hover:text-clay-dark text-xs">✕</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <input className={inputCls} value={novoPadrao} onChange={(e) => setNovoPadrao(e.target.value)} placeholder="ex: Aos quadrados" onKeyDown={(e) => e.key === "Enter" && handleAddValor("article_padroes", novoPadrao, padroes, setNovoPadrao, setAddingPadrao)} />
                <Button variant="primary" onClick={() => handleAddValor("article_padroes", novoPadrao, padroes, setNovoPadrao, setAddingPadrao)} disabled={addingPadrao}>+ Adicionar</Button>
              </div>
            </div>
          </div>
          <p className="text-stone text-[11px] mt-3">💡 "N/A" e "Liso" nunca podem ser desativados nem eliminados — são sempre os valores por defeito de um artigo novo.</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">📦 Etiquetas e Embalagens</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-sm mb-3">
            Um Tipo de Embalagem (ex: "Normal", "Premium") é uma receita fixa de material interno — sacos, papel de seda, cartões, autocolantes… — nunca etiquetas, que continuam a dar baixa só pelo pisco "Peça já etiquetada" de cada venda. Ao gerar uma Encomenda (secção Vendas), escolher o Tipo de Embalagem é obrigatório, e dá baixa de uma vez a todos os artigos da receita.
          </p>
          <div className="overflow-auto mb-3">
            <table>
              <thead><tr><th>Nome</th><th>Receita</th><th>Ativo</th><th></th></tr></thead>
              <tbody>
                {embalagensOrdenadas.length === 0 && (
                  <tr><td colSpan={4} className="text-stone text-sm py-3 text-center">Ainda não há Tipos de Embalagem definidos.</td></tr>
                )}
                {embalagensOrdenadas.map((e) => {
                  const itens = itensPorEmbalagem(e.id);
                  return (
                    <tr key={e.id} className={e.ativo === false ? "opacity-50" : ""}>
                      <td className="font-medium">{e.nome}</td>
                      <td className="text-stone text-xs">
                        {itens.length === 0 ? "sem itens" : itens.map((it) => {
                          const a = (articlesComputed || []).find((x) => x.id === it.article_id);
                          return `${a?.artigo || "artigo removido"} ×${it.quantidade}`;
                        }).join(", ")}
                      </td>
                      <td>
                        <button type="button" onClick={() => toggleEmbalagemAtiva(e)} title={e.ativo === false ? "Ativar" : "Desativar"}>
                          {e.ativo === false ? "⬜" : "✅"}
                        </button>
                      </td>
                      <td className="flex gap-2">
                        <button type="button" onClick={() => setEmbalagemModal({ embalagem: { ...e, itens: itensPorEmbalagem(e.id) } })} className="text-purple-600 text-xs">editar</button>
                        <button type="button" onClick={() => handleDeleteEmbalagem(e)} className="text-stone hover:text-clay-dark text-xs">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button variant="primary" onClick={() => setEmbalagemModal({ embalagem: null })}>+ Novo Tipo de Embalagem</Button>
          <p className="text-stone text-[11px] mt-3">💡 Eliminar um Tipo de Embalagem só o remove das opções para novas encomendas — encomendas já criadas com essa Embalagem, e o stock já consumido, não são afetados.</p>
        </div>
      </div>

      {embalagemModal && (
        <EmbalagemModal
          embalagem={embalagemModal.embalagem}
          artigos={artigosParaEmbalagem}
          onClose={() => setEmbalagemModal(null)}
          onSaved={() => { notify(embalagemModal.embalagem ? "Tipo de Embalagem atualizado." : "Tipo de Embalagem criado."); setEmbalagemModal(null); }}
        />
      )}

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">🔄 Transformações</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-sm mb-3">
            Um Tipo de Transformação consome vários materiais internos (inputs) e dá entrada de stock a um único artigo produzido (ex: 20 folhas de papel + 5ml de tinteiro → +100 etiquetas). Guardar aqui uma receita é opcional — em Artigos, o botão "🔄 Registar transformação" também permite fazer uma transformação avulsa, sem guardar nada aqui.
          </p>
          <div className="overflow-auto mb-3">
            <table>
              <thead><tr><th>Nome</th><th>Produz</th><th>Consome</th><th>Ativo</th><th></th></tr></thead>
              <tbody>
                {transformacoesOrdenadas.length === 0 && (
                  <tr><td colSpan={5} className="text-stone text-sm py-3 text-center">Ainda não há Tipos de Transformação definidos.</td></tr>
                )}
                {transformacoesOrdenadas.map((t) => {
                  const itens = itensPorTransformacao(t.id);
                  const outputArtigo = (articlesComputed || []).find((a) => a.id === t.output_article_id);
                  return (
                    <tr key={t.id} className={t.ativo === false ? "opacity-50" : ""}>
                      <td className="font-medium">{t.nome}</td>
                      <td className="text-stone text-xs">+{t.output_quantidade} {outputArtigo?.artigo || "artigo removido"}</td>
                      <td className="text-stone text-xs">
                        {itens.length === 0 ? "sem itens" : itens.map((it) => {
                          const a = (articlesComputed || []).find((x) => x.id === it.article_id);
                          return `${a?.artigo || "artigo removido"} ×${it.quantidade}`;
                        }).join(", ")}
                      </td>
                      <td>
                        <button type="button" onClick={() => toggleTransformacaoAtiva(t)} title={t.ativo === false ? "Ativar" : "Desativar"}>
                          {t.ativo === false ? "⬜" : "✅"}
                        </button>
                      </td>
                      <td className="flex gap-2">
                        <button type="button" onClick={() => setTransformacaoModal({ transformacao: { ...t, itens: itensPorTransformacao(t.id) } })} className="text-purple-600 text-xs">editar</button>
                        <button type="button" onClick={() => handleDeleteTransformacao(t)} className="text-stone hover:text-clay-dark text-xs">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button variant="primary" onClick={() => setTransformacaoModal({ transformacao: null })}>+ Novo Tipo de Transformação</Button>
          <p className="text-stone text-[11px] mt-3">💡 Eliminar um Tipo de Transformação só o remove das opções — transformações já executadas, e o stock já ajustado, não são afetados.</p>
        </div>
      </div>

      {transformacaoModal && (
        <TransformacaoConfigModal
          transformacao={transformacaoModal.transformacao}
          artigos={artigosParaTransformacao}
          onClose={() => setTransformacaoModal(null)}
          onSaved={() => { notify(transformacaoModal.transformacao ? "Tipo de Transformação atualizado." : "Tipo de Transformação criado."); setTransformacaoModal(null); }}
        />
      )}

      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-ink mb-3">📢 Datas de Marketing</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-stone text-sm mb-3">
            Estas são as datas que geram sozinha a tarefa "📢 Preparar conteúdo para..." no Centro de Tarefas (com a antecedência definida acima, em "Conteúdo"). Acrescentem, desliguem ou eliminem as que fizerem sentido para a loja.
          </p>
          <div className="overflow-auto mb-3">
            <table>
              <thead><tr><th>Data</th><th>Nome</th><th>Ativa</th><th></th></tr></thead>
              <tbody>
                {datasOrdenadas.length === 0 && (
                  <tr><td colSpan={4} className="text-stone text-sm py-3 text-center">Ainda não há datas de marketing definidas.</td></tr>
                )}
                {datasOrdenadas.map((d) => (
                  <tr key={d.id} className={d.ativo === false ? "opacity-50" : ""}>
                    <td className="font-mono text-xs text-stone">{String(d.dia).padStart(2, "0")}/{String(d.mes).padStart(2, "0")}</td>
                    <td className="font-medium">{d.nome}</td>
                    <td>
                      <button type="button" onClick={() => toggleDateAtiva(d)} title={d.ativo === false ? "Ativar" : "Desativar"}>
                        {d.ativo === false ? "⬜" : "✅"}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => handleDeleteDate(d)} className="text-stone hover:text-clay-dark text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[80px_80px_1fr_auto] gap-2 items-end">
            <Field label="Dia"><input type="number" min="1" max="31" className={inputCls} value={novaData.dia} onChange={(e) => setNovaData({ ...novaData, dia: e.target.value })} /></Field>
            <Field label="Mês"><input type="number" min="1" max="12" className={inputCls} value={novaData.mes} onChange={(e) => setNovaData({ ...novaData, mes: e.target.value })} /></Field>
            <Field label="Nome"><input className={inputCls} value={novaData.nome} onChange={(e) => setNovaData({ ...novaData, nome: e.target.value })} placeholder="ex: Regresso às Aulas" /></Field>
            <Button variant="primary" onClick={handleAddDate} disabled={addingDate}>{addingDate ? "A adicionar…" : "+ Adicionar"}</Button>
          </div>
          <p className="text-stone text-[11px] mt-3">💡 Dia da Mãe e Black Friday já vêm sempre incluídos automaticamente (mudam de data todos os anos) — não é preciso acrescentá-los aqui.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-4">
        <Button variant="primary" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "A guardar…" : "Guardar definições"}
        </Button>
        <Button variant="ghost" onClick={handleReset}>Repor valores por defeito</Button>
        {dirty && <span className="text-stone text-xs">Alterações por guardar</span>}
      </div>
    </div>
  );
}

function EmbalagemModal({ embalagem, artigos, onClose, onSaved }) {
  const isNew = !embalagem;
  const [nome, setNome] = useState(embalagem?.nome || "");
  const [notas, setNotas] = useState(embalagem?.notas || "");
  const [ativo, setAtivo] = useState(embalagem?.ativo !== false);
  const [itens, setItens] = useState(() => {
    if (!embalagem) return [{ id: uid(), article_id: "", quantidade: 1 }];
    const existentes = (embalagem.itens || []);
    return existentes.length ? existentes : [{ id: uid(), article_id: "", quantidade: 1 }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addItem() {
    setItens((prev) => [...prev, { id: uid(), article_id: "", quantidade: 1 }]);
  }
  function removeItem(id) {
    setItens((prev) => prev.filter((it) => it.id !== id));
  }
  function updateItem(id, patch) {
    setItens((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  async function handleSave() {
    if (!nome.trim()) { setError("Indica um nome para a Embalagem."); return; }
    const itensValidos = itens.filter((it) => it.article_id);
    if (itensValidos.length === 0) { setError("Acrescenta pelo menos um artigo à receita."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("save_embalagem", {
        p_id: embalagem?.id || null,
        p_nome: nome.trim(),
        p_notas: notas || null,
        p_ativo: ativo,
        p_itens: itensValidos.map((it) => ({ id: it.id, article_id: it.article_id, quantidade: Number(it.quantidade || 1) })),
        p_is_test: isNew ? getTestMode() : undefined,
      });
      if (rpcError) throw new Error(rpcError.message.replace(/^.*save_embalagem: /, ""));
      onSaved();
    } catch (err) {
      setError(err.message || "Não foi possível guardar a Embalagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={isNew ? "Novo Tipo de Embalagem" : "Editar Tipo de Embalagem"} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Premium" /></Field>
        <label className="flex items-center gap-1.5 text-xs text-stone pb-2 self-end">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      </div>
      <label className="text-xs font-medium text-stone">Receita</label>
      <div className="space-y-2 mt-1.5 mb-2">
        {itens.map((it) => (
          <div key={it.id} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_auto] gap-2 items-end">
            <Field label="Artigo">
              <select className={inputCls} value={it.article_id} onChange={(e) => updateItem(it.id, { article_id: e.target.value })}>
                <option value="">— escolhe um artigo —</option>
                {artigos.map((a) => <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo} (stock: {a.stockAtual})</option>)}
              </select>
            </Field>
            <Field label="Qtd">
              <input type="number" min="1" step="1" className={inputCls} value={it.quantidade} onChange={(e) => updateItem(it.id, { quantidade: parseFloat(e.target.value) || 1 })} />
            </Field>
            <button type="button" onClick={() => removeItem(it.id)} disabled={itens.length === 1}
              className="text-xs text-clay-dark underline disabled:opacity-30 disabled:no-underline h-[38px]">
              remover
            </button>
          </div>
        ))}
      </div>
      <Button variant="default" onClick={addItem}>+ Adicionar artigo à receita</Button>
      <p className="text-[11px] text-stone mt-2 mb-3">💡 Só aparecem aqui artigos de Material Interno — as Etiquetas ficam de fora de propósito, já que só saem pelo pisco "Peça já etiquetada" de cada venda.</p>
      {error && <p className="text-clay-dark text-xs mb-3">{error}</p>}
      <div className="mb-5">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} label={saving ? "A guardar…" : "Guardar"} disabled={saving} />
    </ModalShell>
  );
}

function TransformacaoConfigModal({ transformacao, artigos, onClose, onSaved }) {
  const isNew = !transformacao;
  const [nome, setNome] = useState(transformacao?.nome || "");
  const [notas, setNotas] = useState(transformacao?.notas || "");
  const [ativo, setAtivo] = useState(transformacao?.ativo !== false);
  const [outputArticleId, setOutputArticleId] = useState(transformacao?.output_article_id || "");
  const [outputQuantidade, setOutputQuantidade] = useState(transformacao?.output_quantidade || 1);
  const [itens, setItens] = useState(() => {
    if (!transformacao) return [{ id: uid(), article_id: "", quantidade: 1 }];
    const existentes = (transformacao.itens || []);
    return existentes.length ? existentes : [{ id: uid(), article_id: "", quantidade: 1 }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addItem() {
    setItens((prev) => [...prev, { id: uid(), article_id: "", quantidade: 1 }]);
  }
  function removeItem(id) {
    setItens((prev) => prev.filter((it) => it.id !== id));
  }
  function updateItem(id, patch) {
    setItens((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  async function handleSave() {
    if (!nome.trim()) { setError("Indica um nome para a Transformação."); return; }
    if (!outputArticleId) { setError("Escolhe o artigo de saída."); return; }
    const itensValidos = itens.filter((it) => it.article_id);
    if (itensValidos.length === 0) { setError("Acrescenta pelo menos um artigo consumido (input)."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("save_transformacao", {
        p_id: transformacao?.id || null,
        p_nome: nome.trim(),
        p_notas: notas || null,
        p_ativo: ativo,
        p_output_article_id: outputArticleId,
        p_output_quantidade: Number(outputQuantidade || 1),
        p_itens: itensValidos.map((it) => ({ id: it.id, article_id: it.article_id, quantidade: Number(it.quantidade || 1) })),
        p_is_test: isNew ? getTestMode() : undefined,
      });
      if (rpcError) throw new Error(rpcError.message.replace(/^.*save_transformacao: /, ""));
      onSaved();
    } catch (err) {
      setError(err.message || "Não foi possível guardar a Transformação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={isNew ? "Novo Tipo de Transformação" : "Editar Tipo de Transformação"} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Etiquetas caseiras" /></Field>
        <label className="flex items-center gap-1.5 text-xs text-stone pb-2 self-end">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      </div>

      <div className="bg-paper border border-line rounded-lg p-3 mb-3">
        <p className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">Artigo produzido (saída)</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3">
          <Field label="Artigo">
            <select className={inputCls} value={outputArticleId} onChange={(e) => setOutputArticleId(e.target.value)}>
              <option value="">— escolher —</option>
              {artigos.map((a) => <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo} (stock: {a.stockAtual})</option>)}
            </select>
          </Field>
          <Field label="Qtd por lote"><input type="number" min="0" step="1" className={inputCls} value={outputQuantidade} onChange={(e) => setOutputQuantidade(parseFloat(e.target.value) || 0)} /></Field>
        </div>
      </div>

      <label className="text-xs font-medium text-stone">Artigos consumidos (inputs)</label>
      <div className="space-y-2 mt-1.5 mb-2">
        {itens.map((it) => (
          <div key={it.id} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_auto] gap-2 items-end">
            <Field label="Artigo">
              <select className={inputCls} value={it.article_id} onChange={(e) => updateItem(it.id, { article_id: e.target.value })}>
                <option value="">— escolhe um artigo —</option>
                {artigos.map((a) => <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo} (stock: {a.stockAtual})</option>)}
              </select>
            </Field>
            <Field label="Qtd por lote">
              <input type="number" min="0" step="0.01" className={inputCls} value={it.quantidade} onChange={(e) => updateItem(it.id, { quantidade: parseFloat(e.target.value) || 0 })} />
            </Field>
            <button type="button" onClick={() => removeItem(it.id)} disabled={itens.length === 1}
              className="text-xs text-clay-dark underline disabled:opacity-30 disabled:no-underline h-[38px]">
              remover
            </button>
          </div>
        ))}
      </div>
      <Button variant="default" onClick={addItem}>+ Adicionar artigo consumido</Button>
      <p className="text-[11px] text-stone mt-2 mb-3">💡 Ao usar este Tipo em "Registar transformação" (Artigos), o nº de lotes multiplica todas estas quantidades — tanto do output como dos inputs.</p>
      {error && <p className="text-clay-dark text-xs mb-3">{error}</p>}
      <div className="mb-5">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} label={saving ? "A guardar…" : "Guardar"} disabled={saving} />
    </ModalShell>
  );
}
