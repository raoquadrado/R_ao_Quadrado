import { useState } from "react";
import { useTrashedTable, restoreRow, hardDeleteRow } from "../lib/useRealtimeTable";
import { deleteArticlePhoto } from "../lib/photoStorage";
import { deleteDocument } from "../lib/fileStorage";
import { fmtDate } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Button } from "../components/ui";

const TABLES = [
  { key: "suppliers", label: "Fornecedores", nameField: "nome" },
  { key: "articles", label: "Artigos", nameField: "artigo" },
  { key: "purchases", label: "Compras", nameField: "fatura" },
  { key: "clients", label: "Clientes", nameField: "nome" },
  { key: "sales", label: "Vendas", nameField: "id" },
  { key: "content_items", label: "Conteúdo", nameField: "id" },
];

export default function Trash() {
  const [tableKey, setTableKey] = useState("suppliers");
  const current = TABLES.find((t) => t.key === tableKey);
  const { rows } = useTrashedTable(tableKey);
  const notify = useToast();
  const confirm = useConfirm();

  async function handleRestore(r) {
    await restoreRow(tableKey, r.id);
    notify("Registo restaurado.");
  }

  async function handleHardDelete(r) {
    const ok = await confirm({
      title: "Eliminar em definitivo?",
      message: "Esta ação não pode ser desfeita — o registo (e anexos) desaparecem para sempre.",
      confirmLabel: "Eliminar em definitivo",
    });
    if (!ok) return;
    if (tableKey === "articles" && r.foto_url) await deleteArticlePhoto(r.foto_url);
    if (tableKey === "purchases" && r.fatura_url) await deleteDocument(r.fatura_url);
    if (tableKey === "sales") {
      if (r.fatura_url) await deleteDocument(r.fatura_url);
      if (r.comprovativo_url) await deleteDocument(r.comprovativo_url);
    }
    await hardDeleteRow(tableKey, r.id);
    notify("Eliminado em definitivo.");
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1">Lixeira</h1>
      <p className="text-stone text-sm mb-5">Nada se apaga em definitivo por engano — restaura ou elimina de vez a partir daqui.</p>

      <div className="flex gap-2 flex-wrap mb-4">
        {TABLES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTableKey(t.key)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md border ${tableKey === t.key ? "bg-ink text-paper border-ink" : "bg-white text-ink border-line"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead><tr><th>Registo</th><th>Eliminado em</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} className="text-stone text-center py-6">Nada na lixeira de {current.label.toLowerCase()}.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r[current.nameField] || r.id}</td>
                <td className="font-mono text-xs text-stone">{fmtDate(r.deleted_at?.slice(0, 10))}</td>
                <td>
                  <div className="flex gap-1.5 justify-end">
                    <Button onClick={() => handleRestore(r)}>Restaurar</Button>
                    <Button variant="danger" onClick={() => handleHardDelete(r)}>Eliminar definitivamente</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
