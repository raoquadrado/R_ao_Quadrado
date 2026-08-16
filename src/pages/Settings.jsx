import { useState, useEffect } from "react";
import { updateRow, insertRow, deleteRow } from "../lib/useRealtimeTable";
import { DEFAULT_SETTINGS } from "../lib/constants";
import { gerarCopiaSeguranca, descarregarJSON, restaurarCopiaSeguranca } from "../lib/backup";
import { uploadLogo } from "../lib/photoStorage";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, inputCls } from "../components/ui";

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

export default function Settings({ settings, marketingDates }) {
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
