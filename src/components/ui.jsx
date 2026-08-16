import { useEffect, useState, useRef, useMemo } from "react";
import { TAG_OPTIONS, tagColor } from "../lib/constants";
import { useToast } from "../lib/overlays";

export const inputCls =
  "w-full border border-line rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";

export function Field({ label, span, children }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-stone ${span ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

export function Button({ children, onClick, variant = "default", disabled, className = "", type = "button" }) {
  const variants = {
    default: "bg-white border border-line text-ink",
    primary: "bg-rust text-white",
    ghost: "bg-transparent text-stone",
    danger: "bg-transparent text-clay-dark border border-clay/40",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-md disabled:opacity-50 hover:opacity-90 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ text, color, bg }) {
  return (
    <span
      className="text-[10.5px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
      style={{ color, background: bg }}
    >
      {text}
    </span>
  );
}

export function ModalShell({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} className="fixed inset-0 bg-ink/45 flex items-center justify-center z-50 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-paper rounded-xl p-6 w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[88vh] overflow-y-auto shadow-2xl`}
      >
        <h2 className="font-display text-lg font-semibold mb-0.5">{title}</h2>
        {subtitle ? <p className="text-xs text-stone mb-4">{subtitle}</p> : <div className="mb-2.5" />}
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ onClose, onSave, label, disabled, left }) {
  const notify = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return; // evita duplo-clique / duplo-envio acidental
    setSaving(true);
    try {
      await onSave();
    } catch (err) {
      notify(err?.message || "Não foi possível guardar — verifica a ligação e tenta outra vez.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex items-center gap-2 ${left ? "justify-between" : "justify-end"}`}>
      {left ? <div>{left}</div> : null}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" onClick={handleSave} disabled={disabled || saving}>{saving ? "A guardar…" : label}</Button>
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputCls} mb-4`}
    />
  );
}

export function TabHeader({ title, sub, btnLabel, onNew, disabled, hasActiveFilters, onClearFilters }) {
  return (
    <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
      <div>
        <h1 className="font-display text-2xl font-semibold mb-0.5">{title}</h1>
        <p className="text-stone text-sm">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        {hasActiveFilters && (
          <button onClick={onClearFilters} className="text-xs font-medium text-purple-600 underline">
            Limpar filtros
          </button>
        )}
        <Button variant="primary" onClick={onNew} disabled={disabled}>+ {btnLabel}</Button>
      </div>
    </div>
  );
}

export function RowActions({ onEdit, onDuplicate, onNewSize, onDelete }) {
  return (
    <td className="sticky-actions">
      <div className="flex gap-1.5 justify-end">
        {onNewSize && (
          <button onClick={onNewSize} className="text-xs font-medium bg-white border border-line rounded px-2.5 py-1 text-ink" title="Novo tamanho">📏 Novo tamanho</button>
        )}
        {onDuplicate && (
          <button onClick={onDuplicate} className="text-xs font-medium bg-white border border-line rounded px-2.5 py-1 text-ink" title="Duplicar">⎘ Duplicar</button>
        )}
        <button onClick={onEdit} className="text-xs font-medium bg-white border border-line rounded px-2.5 py-1 text-ink">Editar</button>
        <button onClick={onDelete} className="text-xs font-medium bg-white border border-clay/40 rounded px-2.5 py-1 text-clay-dark">Eliminar</button>
      </div>
    </td>
  );
}

export function FavoriteStar({ active, onClick, size = "text-base" }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={active ? "Remover dos favoritos" : "Marcar como favorito"}
      className={`${size} leading-none ${active ? "text-gold-500" : "text-line hover:text-gold-400"}`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

export function TagBadge({ value }) {
  const t = tagColor(value);
  if (!t) return null;
  return <Badge text={t.label} color={t.color} bg={t.bg} />;
}

export function TagSelect({ value, onChange, disabled }) {
  return (
    <select className={disabled ? `${inputCls} bg-line/40 text-stone` : inputCls} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">— sem etiqueta —</option>
      {TAG_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );
}

export function EmptyRow({ span, text }) {
  return (
    <tr>
      <td colSpan={span} className="text-stone text-center py-6">{text}</td>
    </tr>
  );
}

export function Card({ label, value, color }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="font-mono text-xl font-medium" style={{ color }}>{value}</div>
      <div className="text-xs text-stone mt-1">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------- Filtros de coluna (estilo Excel) ----
// `columns` é um objeto { chaveDaColuna: (row) => valorAMostrar }.
export function useColumnFilters(rows, columns, initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters); // chave -> Set de valores selecionados, ou null/undefined = todos

  const optionsByCol = useMemo(() => {
    const out = {};
    for (const key of Object.keys(columns)) {
      const getValue = columns[key];
      const set = new Set();
      rows.forEach((r) => set.add(getValue(r) ?? "—"));
      out[key] = [...set].sort((a, b) => a.localeCompare(b, "pt")).map((v) => ({ value: v, label: v }));
    }
    return out;
  }, [rows, columns]);

  function filterProps(key) {
    return {
      options: optionsByCol[key] || [],
      selected: filters[key] ?? null,
      onChange: (next) => setFilters((f) => ({ ...f, [key]: next })),
    };
  }

  function applyFilters(rowsToFilter) {
    const activeKeys = Object.keys(filters).filter((k) => filters[k] !== null && filters[k] !== undefined);
    if (activeKeys.length === 0) return rowsToFilter;
    return rowsToFilter.filter((r) =>
      activeKeys.every((k) => filters[k].has(columns[k](r) ?? "—"))
    );
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== null && v !== undefined);
  function clearAllFilters() { setFilters({}); }

  return { filterProps, applyFilters, hasActiveFilters, clearAllFilters };
}

export function FilterTh({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const active = selected !== null && selected !== undefined;
  const isChecked = (v) => (active ? selected.has(v) : true);
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  function toggle(v) {
    const base = active ? new Set(selected) : new Set(options.map((o) => o.value));
    if (base.has(v)) base.delete(v);
    else base.add(v);
    onChange(base.size === options.length ? null : base);
  }

  return (
    <th className="relative">
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className={`text-[9px] leading-none px-1 py-0.5 rounded ${active ? "bg-rust text-white" : "text-stone hover:bg-line/60"}`}
          title="Filtrar"
        >
          ▾
        </button>
      </div>
      {open && (
        <div
          ref={ref}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-30 top-full left-0 mt-1 w-52 bg-white border border-line rounded-lg shadow-2xl p-2 normal-case font-normal text-ink"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar…"
            className="w-full border border-line rounded px-2 py-1 text-xs mb-1.5"
          />
          <div className="flex justify-between text-[11px] text-purple-600 font-medium mb-1.5 px-0.5">
            <button type="button" onClick={() => onChange(null)}>Selecionar tudo</button>
            <button type="button" onClick={() => onChange(new Set())}>Limpar</button>
          </div>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
            {shown.length === 0 && <span className="text-[11px] text-stone px-0.5">Sem valores.</span>}
            {shown.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-xs font-normal cursor-pointer px-0.5">
                <input type="checkbox" checked={isChecked(o.value)} onChange={() => toggle(o.value)} className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </th>
  );
}
