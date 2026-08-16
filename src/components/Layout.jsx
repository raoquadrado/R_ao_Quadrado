import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Logo from "./Logo";
import AboutModal from "./AboutModal";
import { APP_VERSION } from "../lib/constants";
import { getTestMode, setTestMode, subscribeTestMode } from "../lib/testMode";

const NAV = [
  { id: "dashboard", label: "Painel", icon: "📊", group: "Visão Geral" },
  { id: "calendar", label: "Calendário", icon: "📅", group: "Visão Geral" },
  { id: "tasks", label: "Centro de Tarefas", icon: "✅", group: "Visão Geral" },
  { id: "price-suggestions", label: "Sugestões de Preço", icon: "💰", group: "Visão Geral" },

  { id: "suppliers", label: "Fornecedores", icon: "🚚", group: "Catálogo" },
  { id: "purchases", label: "Compras", icon: "🛒", group: "Catálogo" },
  { id: "articles", label: "Artigos", icon: "📦", group: "Catálogo" },

  { id: "clients", label: "Clientes", icon: "👥", group: "Vendas" },
  { id: "sales", label: "Vendas", icon: "🧾", group: "Vendas" },
  { id: "exchanges", label: "Trocas", icon: "🔁", group: "Vendas" },

  { id: "content", label: "Centro de Conteúdo", icon: "📱", group: "Conteúdo & Redes" },
  { id: "lives", label: "Diretos", icon: "🎥", group: "Conteúdo & Redes" },
  { id: "communication", label: "Comunicação", icon: "💬", group: "Conteúdo & Redes" },

  { id: "history", label: "Histórico", icon: "🕘", group: "Sistema" },
  { id: "trash", label: "Lixeira", icon: "🗑", group: "Sistema" },
  { id: "settings", label: "Definições", icon: "⚙️", group: "Sistema" },
];

export default function Layout({ tab, setTab, userEmail, onExport, onSearch, children }) {
  const [showAbout, setShowAbout] = useState(false);
  const [testMode, setTestModeLocal] = useState(getTestMode());
  useEffect(() => subscribeTestMode(setTestModeLocal), []);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col md:flex-row">
      {/* Sidebar — desktop */}
      <aside className={`hidden md:flex md:flex-col w-52 px-3.5 py-6 flex-shrink-0 ${testMode ? "bg-[#4A3208]" : "bg-ink"}`}>
        <div className="mb-5 pl-2">
          <Logo size="sm" light showTagline />
        </div>
        <button
          onClick={onSearch}
          className="flex items-center justify-between gap-2 text-left rounded-md px-2.5 py-2 text-sm font-medium mb-3 bg-white/10 text-[#C9CBD6] hover:bg-white/15"
        >
          <span className="flex items-center gap-2">🔎 Pesquisar</span>
          <kbd className="text-[10px] font-mono opacity-70">⌘K</kbd>
        </button>
        <button
          onClick={() => setTestMode(!testMode)}
          className={`flex items-center justify-between gap-2 text-left rounded-md px-2.5 py-2 text-sm font-medium mb-3 ${
            testMode ? "bg-[#F0C230] text-[#4A3208]" : "bg-white/10 text-[#C9CBD6] hover:bg-white/15"
          }`}
          title="Trabalhar sobre dados de teste, sem afetar os dados reais"
        >
          <span className="flex items-center gap-2">🧪 Modo de Teste</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${testMode ? "bg-[#4A3208] text-[#F0C230]" : "bg-white/10"}`}>
            {testMode ? "ON" : "OFF"}
          </span>
        </button>
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {NAV.map((t, i) => (
            <div key={t.id}>
              {t.group !== NAV[i - 1]?.group && (
                <div className={`text-[10px] font-semibold uppercase tracking-wide text-[#8B8FA3] px-2.5 ${i === 0 ? "mb-1.5" : "mt-4 mb-1.5"}`}>
                  {t.group}
                </div>
              )}
              <button
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 text-left rounded-md px-2.5 py-2 text-sm font-medium mb-0.5 ${
                  tab === t.id ? "bg-rust/20 text-[#F0C89A]" : "text-[#C9CBD6]"
                }`}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <button onClick={onExport} className="bg-rust text-white text-sm font-medium rounded-md py-2 justify-center flex items-center gap-1.5">
            ⭳ Exportar Excel
          </button>
          <a href="/manual-utilizador.pdf" target="_blank" rel="noreferrer" className="bg-white/10 text-[#C9CBD6] hover:bg-white/15 text-sm font-medium rounded-md py-2 justify-center flex items-center gap-1.5">
            📖 Manual de Utilizador
          </a>
          <div className="text-[11px] text-[#8B8FA3] truncate mt-2">{userEmail}</div>
          <div className="flex items-center justify-between">
            <button onClick={() => supabase.auth.signOut()} className="text-[11px] text-[#C9CBD6] text-left underline">
              Terminar sessão
            </button>
            <button onClick={() => setShowAbout(true)} className="text-[11px] text-[#8B8FA3] hover:text-[#C9CBD6] underline">
              Sobre · v{APP_VERSION}
            </button>
          </div>
        </div>
      </aside>

      {/* Topbar — mobile */}
      <header className={`md:hidden flex items-center justify-between px-4 py-3 ${testMode ? "bg-[#4A3208]" : "bg-ink"}`}>
        <Logo size="sm" light />
        <div className="flex items-center gap-3">
          <button onClick={() => setTestMode(!testMode)} className={`text-xs font-medium px-2 py-1 rounded ${testMode ? "bg-[#F0C230] text-[#4A3208]" : "text-[#F0C89A]"}`} title="Modo de Teste">
            🧪 {testMode ? "ON" : "OFF"}
          </button>
          <button onClick={onSearch} className="text-[#F0C89A] text-base">🔎</button>
          <a href="/manual-utilizador.pdf" target="_blank" rel="noreferrer" className="text-[#F0C89A] text-base" title="Manual de Utilizador">📖</a>
          <button onClick={() => setShowAbout(true)} className="text-[#F0C89A] text-base" title="Sobre">ℹ️</button>
          <button onClick={onExport} className="text-[#F0C89A] text-xs font-medium">Exportar</button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 px-4 py-5 md:px-8 md:py-7 pb-24 md:pb-7 overflow-x-auto">
        {testMode && (
          <div className="bg-[#F0C230] text-[#4A3208] text-xs sm:text-sm font-semibold text-center rounded-lg px-3 py-2 mb-4 flex items-center justify-center gap-2">
            🧪 MODO DE TESTE ATIVO — o que fizeres aqui não afeta os dados reais.
          </div>
        )}
        {children}
      </main>

      {/* Nav — mobile (fixa em baixo) */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 flex overflow-x-auto py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 ${testMode ? "bg-[#4A3208]" : "bg-ink"}`}>
        {NAV.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center text-[10px] gap-0.5 px-3 py-1 rounded-md flex-shrink-0 min-w-[64px] ${
              tab === t.id ? "text-[#F0C89A]" : "text-[#C9CBD6]"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
