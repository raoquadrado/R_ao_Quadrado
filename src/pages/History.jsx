import { useState, useMemo } from "react";
import { useAuditLog } from "../lib/useRealtimeTable";
import { Badge } from "../components/ui";

const TABLE_LABELS = {
  suppliers: "Fornecedores", articles: "Artigos", purchases: "Compras", clients: "Clientes", sales: "Vendas", content_items: "Conteúdo",
};

const TABLE_ICONS = {
  suppliers: "🚚", articles: "📦", purchases: "🛒", clients: "👥", sales: "🧾", content_items: "📱",
};

const ACTION_LABELS = {
  insert: { text: "criado", color: "#254238", bg: "#DCEBE4" },
  update: { text: "editado", color: "#A67C1E", bg: "#F5EADD" },
  delete: { text: "eliminado", color: "#7A2A24", bg: "#F5D9D6" },
};

function describe(entry) {
  // um "update" que só mudou deleted_at é, na prática, eliminar/restaurar
  if (entry.action === "update" && entry.old_data && entry.new_data) {
    const wasDeleted = !!entry.old_data.deleted_at;
    const isDeleted = !!entry.new_data.deleted_at;
    if (!wasDeleted && isDeleted) return { text: "eliminado", color: "#7A2A24", bg: "#F5D9D6" };
    if (wasDeleted && !isDeleted) return { text: "restaurado", color: "#254238", bg: "#DCEBE4" };
  }
  return ACTION_LABELS[entry.action] || { text: entry.action, color: "#8A8677", bg: "#F1EDE3" };
}

function labelOf(entry) {
  const d = entry.new_data || entry.old_data || {};
  if (entry.table_name === "content_items") return `${d.estado || "conteúdo"}${d.rede ? " · " + d.rede : ""}`;
  return d.nome || d.artigo || d.fatura || d.sku || entry.record_id?.slice(0, 8) || "—";
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

function groupByDay(rows) {
  const groups = [];
  let currentKey = null;
  rows.forEach((r) => {
    const key = (r.changed_at || "").slice(0, 10);
    if (key !== currentKey) {
      groups.push({ key, label: dayLabel(r.changed_at), entries: [] });
      currentKey = key;
    }
    groups[groups.length - 1].entries.push(r);
  });
  return groups;
}

export default function History() {
  const { rows, loading } = useAuditLog(300);
  const [tableFilter, setTableFilter] = useState("");
  const [open, setOpen] = useState(null);

  const filtered = tableFilter ? rows.filter((r) => r.table_name === tableFilter) : rows;
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1">Histórico</h1>
      <p className="text-stone text-sm mb-5">Quem criou, editou ou eliminou cada registo — registado automaticamente.</p>

      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setTableFilter("")}
          className={`text-sm font-medium px-3 py-1.5 rounded-md border ${tableFilter === "" ? "bg-ink text-paper border-ink" : "bg-white text-ink border-line"}`}
        >
          Tudo
        </button>
        {Object.entries(TABLE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTableFilter(key)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md border ${tableFilter === key ? "bg-ink text-paper border-ink" : "bg-white text-ink border-line"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!loading && groups.length === 0 && (
        <div className="bg-white border border-line rounded-xl text-stone text-center py-10">Sem alterações registadas.</div>
      )}

      <div className="space-y-7">
        {groups.map((g) => (
          <div key={g.key}>
            <h2 className="font-display text-sm font-semibold text-ink mb-3.5 sticky top-0 bg-paper/95 backdrop-blur-sm py-1 z-10">{g.label}</h2>
            <div className="relative pl-6 border-l-2 border-line space-y-3">
              {g.entries.map((entry) => {
                const action = describe(entry);
                const isOpen = open === entry.id;
                return (
                  <div key={entry.id} className="relative">
                    <span
                      className="absolute -left-[29px] top-4 w-3 h-3 rounded-full border-2 border-paper"
                      style={{ background: action.color }}
                    />
                    <div className="bg-white border border-line rounded-xl px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] text-stone whitespace-nowrap">
                            {new Date(entry.changed_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Badge text={action.text} color={action.color} bg={action.bg} />
                          <span className="text-xs text-stone">{TABLE_ICONS[entry.table_name] || "•"} {TABLE_LABELS[entry.table_name] || entry.table_name}</span>
                        </div>
                        <span className="text-xs text-stone truncate max-w-[45%]">{entry.changed_by_email || "—"}</span>
                      </div>
                      <div className="font-medium text-sm text-ink">{labelOf(entry)}</div>
                      <button onClick={() => setOpen(isOpen ? null : entry.id)} className="text-xs text-purple-600 font-medium underline mt-1.5">
                        {isOpen ? "esconder detalhes" : "ver detalhes"}
                      </button>
                      {isOpen && (
                        <pre className="text-[11px] whitespace-pre-wrap p-2.5 mt-2 bg-line/20 rounded-md font-mono">
                          {JSON.stringify({ antes: entry.old_data, depois: entry.new_data }, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
