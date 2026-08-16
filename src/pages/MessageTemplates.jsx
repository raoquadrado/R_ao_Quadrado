import { useState, useEffect } from "react";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { MESSAGE_TEMPLATE_VARS, preencherTemplate, uid } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls } from "../components/ui";

const empty = (templates) => ({
  id: uid(), nome: "", corpo: "", ativo: true, ordem: (templates?.length || 0) + 1,
});

// dados de exemplo, só para a pré-visualização do texto no formulário
const DADOS_EXEMPLO = {
  cliente: "Marta Oliveira", artigo: "Vestido Floral M", quantidade: "1", valor: "24,90 €",
  codigo: "VENDA-20260815", codigo_envio: "CTT1234567PT", metodo_envio: "CTT", direto: "Direto de sábado",
  data: "15/08/2026", a_o: "o",
};

export default function MessageTemplates({ templates, autoOpenNew, onConsumedAutoOpen, autoOpenEditId, onConsumedAutoOpenEdit }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) { setModal({ data: empty(templates), isNew: true }); onConsumedAutoOpen?.(); }
  }, [autoOpenNew]);

  useEffect(() => {
    if (autoOpenEditId) {
      const t = templates.find((x) => x.id === autoOpenEditId);
      if (t) setModal({ data: { ...t }, isNew: false });
      onConsumedAutoOpenEdit?.();
    }
  }, [autoOpenEditId, templates]);

  const rows = [...templates]
    .filter((t) => (t.nome + t.corpo).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  async function handleDelete(t) {
    const ok = await confirm({ title: "Eliminar modelo?", message: `"${t.nome}" vai para a Lixeira.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("message_templates", t.id);
    notify("Modelo eliminado.");
  }

  async function toggleAtivo(t) {
    await updateRow("message_templates", t.id, { ativo: !t.ativo });
  }

  async function moveTemplate(t, direction) {
    const idx = rows.findIndex((x) => x.id === t.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const other = rows[swapIdx];
    await Promise.all([
      updateRow("message_templates", t.id, { ordem: swapIdx }),
      updateRow("message_templates", other.id, { ordem: idx }),
    ]);
  }

  return (
    <div>
      <TabHeader
        title="💬 Comunicação"
        sub="Modelos de mensagem por situação, prontos a preencher e enviar ao cliente."
        btnLabel="Novo modelo"
        onNew={() => setModal({ data: empty(templates), isNew: true })}
      />
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por nome ou texto…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Ordem</th><th>Situação</th><th>Mensagem</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow span={5} text="Ainda não há modelos de mensagem." />}
            {rows.map((t, i) => (
              <tr key={t.id}>
                <td>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveTemplate(t, -1)} disabled={i === 0} title="Mover para cima" className="text-stone disabled:opacity-30 disabled:cursor-default">▲</button>
                    <button type="button" onClick={() => moveTemplate(t, 1)} disabled={i === rows.length - 1} title="Mover para baixo" className="text-stone disabled:opacity-30 disabled:cursor-default">▼</button>
                  </div>
                </td>
                <td className="font-medium">{t.nome}</td>
                <td className="text-stone max-w-[420px] whitespace-normal">{t.corpo}</td>
                <td>
                  <button type="button" onClick={() => toggleAtivo(t)} title={t.ativo ? "Ativo — clicar para desativar" : "Inativo — clicar para ativar"}>
                    {t.ativo ? <Badge text="Ativo" color="#254238" bg="#DCEBE4" /> : <Badge text="Inativo" color="#8A8677" bg="#F1EDE3" />}
                  </button>
                </td>
                <RowActions onEdit={() => setModal({ data: { ...t }, isNew: false })} onDelete={() => handleDelete(t)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <MessageTemplateModal
          data={modal.data}
          isNew={modal.isNew}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            if (modal.isNew) await insertRow("message_templates", values);
            else await updateRow("message_templates", modal.data.id, values);
            notify(modal.isNew ? "Modelo criado." : "Modelo atualizado.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function MessageTemplateModal({ data, isNew, onClose, onSave }) {
  const [f, setF] = useState(data);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const preview = preencherTemplate(f.corpo, DADOS_EXEMPLO);

  return (
    <ModalShell title={isNew ? "Novo modelo de mensagem" : "Editar modelo"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Situação (nome do modelo)"><input className={inputCls} value={f.nome} onChange={set("nome")} placeholder="ex: Pagamento confirmado" /></Field>
        <Field label="Estado">
          <div className="flex items-center gap-2 h-[38px]">
            <input type="checkbox" id="ativo" checked={!!f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} className="w-4 h-4" />
            <label htmlFor="ativo" className="text-sm text-ink">Ativo (aparece na lista para enviar)</label>
          </div>
        </Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="mb-2">
        <Field label="Mensagem" span>
          <textarea rows={5} className={inputCls} value={f.corpo} onChange={set("corpo")} placeholder="Olá {{cliente}}! ..." />
        </Field>
      </div>
      <div className="mb-4 bg-paper rounded-md p-3">
        <p className="text-xs text-stone mb-1.5 font-medium">Variáveis disponíveis (usa duas chavetas, ex: {"{{cliente}}"}):</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {MESSAGE_TEMPLATE_VARS.map((v) => (
            <button
              key={v.chave}
              type="button"
              title={v.desc}
              onClick={() => setF({ ...f, corpo: `${f.corpo}{{${v.chave}}}` })}
              className="text-[11px] font-mono bg-white border border-line rounded px-2 py-1 text-ink"
            >
              {"{{" + v.chave + "}}"}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone mb-1 font-medium">Pré-visualização (com dados de exemplo):</p>
        <p className="text-sm whitespace-pre-wrap">{preview || <span className="text-stone italic">Escreve a mensagem acima…</span>}</p>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={async () => { if (!f.nome.trim()) { setError("Indica o nome da situação."); return; } return onSave(f); }}
        label="Guardar modelo"
      />
    </ModalShell>
  );
}
