import { useState } from "react";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { OWNERS } from "../lib/constants";
import { todayISO } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, ModalShell, ModalActions, SearchBox, TabHeader, EmptyRow, inputCls } from "../components/ui";

const empty = () => ({
  titulo: "", responsavel: "", prazo: "", notas: "", estado: "Pendente",
});

export default function Tasks({ tasks, onOpenOrigem }) {
  const [q, setQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  const filtered = tasks
    .filter((t) => (t.titulo || "").toLowerCase().includes(q.toLowerCase()))
    .filter((t) => !onlyPending || t.estado === "Pendente")
    .sort((a, b) => {
      // sem prazo vai para o fim; entre as com prazo, a mais próxima primeiro
      if (!a.prazo && !b.prazo) return (a.created_at || "").localeCompare(b.created_at || "");
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    });

  const pendentes = tasks.filter((t) => t.estado === "Pendente").length;
  const hoje = todayISO();

  async function toggleEstado(t) {
    if (t.estado === "Pendente") await updateRow("tasks", t.id, { estado: "Concluída", concluida_at: new Date().toISOString() });
    else await updateRow("tasks", t.id, { estado: "Pendente", concluida_at: null });
  }
  async function setResponsavel(t, responsavel) {
    await updateRow("tasks", t.id, { responsavel: responsavel || null });
  }
  async function setPrazo(t, prazo) {
    await updateRow("tasks", t.id, { prazo: prazo || null });
  }
  async function handleDelete(t) {
    const ok = await confirm({ title: "Eliminar tarefa?", message: `"${t.titulo}" vai para a Lixeira.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("tasks", t.id);
    notify("Tarefa eliminada.");
  }
  async function handleSaveManual(values) {
    const clean = { ...values, prazo: values.prazo || null, tipo: "manual" };
    await insertRow("tasks", clean);
    notify("Tarefa criada.");
    setModal(null);
  }

  return (
    <div>
      <TabHeader
        title="✅ Centro de Tarefas"
        sub={`${pendentes} tarefa(s) pendente(s) — automáticas (geradas pela app) e manuais, tudo num só sítio.`}
        btnLabel="Nova tarefa manual"
        onNew={() => setModal({ isNew: true })}
        hasActiveFilters={onlyPending} onClearFilters={() => setOnlyPending(false)}
      />
      <label className="flex items-center gap-2 mb-3 text-xs text-stone">
        <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="w-3.5 h-3.5" />
        Mostrar só pendentes
      </label>
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por título…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead><tr><th></th><th>Tarefa</th><th>Origem</th><th>Responsável</th><th>Prazo</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow span={6} text="Sem tarefas — tudo em dia! 🎉" />}
            {filtered.map((t) => {
              const atrasada = t.estado === "Pendente" && t.prazo && t.prazo < hoje;
              return (
                <tr key={t.id}>
                  <td>
                    <button type="button" onClick={() => toggleEstado(t)} title={t.estado === "Pendente" ? "Marcar concluída" : "Marcar pendente"} className="text-lg leading-none">
                      {t.estado === "Pendente" ? "⬜" : "✅"}
                    </button>
                  </td>
                  <td className={t.estado === "Concluída" ? "text-stone line-through" : "font-medium"}>
                    {t.titulo}
                    {t.tipo === "manual" && <span className="ml-1.5 text-[10px] text-stone">✍️ manual</span>}
                  </td>
                  <td>
                    {t.origem_tab ? (
                      <button type="button" onClick={() => onOpenOrigem(t.origem_tab, t.origem_id)} className="text-purple-600 underline text-xs">Ver ↗</button>
                    ) : <span className="text-stone">—</span>}
                  </td>
                  <td>
                    <select className={`${inputCls} text-xs py-1`} value={t.responsavel || ""} onChange={(e) => setResponsavel(t, e.target.value)}>
                      <option value="">— não atribuída —</option>
                      {OWNERS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      className={`${inputCls} text-xs py-1 ${atrasada ? "border-clay-dark text-clay-dark" : ""}`}
                      value={t.prazo || ""}
                      onChange={(e) => setPrazo(t, e.target.value)}
                    />
                    {atrasada && <div className="text-[10px] text-clay-dark mt-0.5">⚠ atrasada</div>}
                  </td>
                  <td>
                    <button type="button" onClick={() => handleDelete(t)} title="Eliminar tarefa" className="text-stone hover:text-clay-dark text-xs">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <TaskModal onClose={() => setModal(null)} onSave={handleSaveManual} />
      )}
    </div>
  );
}

function TaskModal({ onClose, onSave }) {
  const [f, setF] = useState(empty());
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <ModalShell title="Nova tarefa manual" onClose={onClose}>
      <div className="mb-3">
        <Field label="Título" span>
          <input className={inputCls} value={f.titulo} onChange={set("titulo")} placeholder="ex: Ir aos correios" />
        </Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Responsável">
          <select className={inputCls} value={f.responsavel} onChange={set("responsavel")}>
            <option value="">— não atribuída —</option>
            {OWNERS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Prazo"><input type="date" className={inputCls} value={f.prazo} onChange={set("prazo")} /></Field>
      </div>
      <div className="mb-5">
        <Field label="Notas" span>
          <textarea rows={3} className={inputCls} value={f.notas} onChange={set("notas")} />
        </Field>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={async () => {
          if (!f.titulo.trim()) { setError("Indica um título para a tarefa."); return; }
          return onSave(f);
        }}
        label="Criar tarefa"
      />
    </ModalShell>
  );
}
