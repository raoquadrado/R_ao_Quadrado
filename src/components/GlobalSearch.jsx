import { useEffect, useMemo, useRef, useState } from "react";
import { displaySku } from "../lib/computations";

export default function GlobalSearch({ suppliers, clients, articlesComputed, onClose, onOpenRecord }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const clientHits = clients
      .filter((c) => !term || `${c.nome} ${c.email || ""} ${c.telefone || ""}`.toLowerCase().includes(term))
      .slice(0, 6)
      .map((c) => ({ kind: "clients", id: c.id, icon: "👥", title: c.nome, sub: c.email || c.telefone || "Cliente" }));
    const supplierHits = suppliers
      .filter((s) => !term || `${s.nome} ${s.localidade || ""}`.toLowerCase().includes(term))
      .slice(0, 6)
      .map((s) => ({ kind: "suppliers", id: s.id, icon: "🚚", title: s.nome, sub: s.localidade || "Fornecedor" }));
    const articleHits = articlesComputed
      .filter((a) => !term || `${a.sku} ${a.artigo} ${a.cor || ""}`.toLowerCase().includes(term))
      .slice(0, 6)
      .map((a) => ({ kind: "articles", id: a.id, icon: "📦", title: a.artigo, sub: displaySku(a) || "Artigo" }));
    if (!term) return [...clientHits, ...supplierHits, ...articleHits].slice(0, 8);
    return [...clientHits, ...supplierHits, ...articleHits];
  }, [q, clients, suppliers, articlesComputed]);

  return (
    <div onClick={onClose} className="fixed inset-0 bg-ink/45 flex items-start justify-center z-[120] p-4 pt-[12vh]">
      <div onClick={(e) => e.stopPropagation()} className="bg-paper rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar clientes, fornecedores ou artigos…"
          className="w-full px-4 py-3.5 text-sm bg-white border-b border-line focus:outline-none"
        />
        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 && <div className="text-stone text-sm text-center py-8">Sem resultados.</div>}
          {results.map((r) => (
            <button
              key={`${r.kind}-${r.id}`}
              onClick={() => onOpenRecord(r.kind, r.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-beige-100"
            >
              <span className="text-base">{r.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink truncate">{r.title}</div>
                <div className="text-xs text-stone truncate">{r.sub}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="text-[11px] text-stone px-4 py-2 border-t border-line bg-white">
          Atalho: <kbd className="font-mono">Ctrl/⌘ + K</kbd> para abrir · <kbd className="font-mono">Esc</kbd> para fechar
        </div>
      </div>
    </div>
  );
}

export function ShortcutsHelp({ onClose }) {
  const shortcuts = [
    ["Ctrl / ⌘ + K", "Pesquisa global"],
    ["N", "Novo registo no separador atual"],
    ["Esc", "Fechar janela aberta"],
    ["?", "Mostrar esta ajuda"],
  ];
  return (
    <div onClick={onClose} className="fixed inset-0 bg-ink/45 flex items-center justify-center z-[120] p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-paper rounded-xl p-5 w-full max-w-sm shadow-2xl">
        <h2 className="font-display text-base font-semibold mb-3">Atalhos de teclado</h2>
        <div className="space-y-2 mb-4">
          {shortcuts.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-stone">{label}</span>
              <kbd className="font-mono text-xs bg-white border border-line rounded px-2 py-1">{key}</kbd>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="text-sm font-medium px-3.5 py-2 rounded-md bg-rust text-white w-full">Fechar</button>
      </div>
    </div>
  );
}
