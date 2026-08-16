import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./components/Login";
import Layout from "./components/Layout";
import GlobalSearch, { ShortcutsHelp } from "./components/GlobalSearch";
import { ToastProvider, ConfirmProvider, useToast } from "./lib/overlays";
import { useRealtimeTable, updateRow, insertRow } from "./lib/useRealtimeTable";
import { computeArticles, computeClients } from "./lib/computations";
import { gerarTarefasAutomaticas } from "./lib/taskRules";
import { ownerFromEmail, DEFAULT_SETTINGS } from "./lib/constants";
import { exportExcel } from "./lib/exportExcel";
import { initTestMode } from "./lib/testMode";

initTestMode(); // carrega a preferência de Modo de Teste guardada, antes de qualquer pedido à base de dados

import Dashboard from "./pages/Dashboard";
import Suppliers from "./pages/Suppliers";
import Articles from "./pages/Articles";
import Purchases from "./pages/Purchases";
import Clients from "./pages/Clients";
import Sales from "./pages/Sales";
import Content from "./pages/Content";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import PriceSuggestions from "./pages/PriceSuggestions";
import Settings from "./pages/Settings";
import Lives from "./pages/Lives";
import LiveDetail from "./pages/LiveDetail";
import WaitlistAll from "./pages/WaitlistAll";
import MessageTemplates from "./pages/MessageTemplates";
import Exchanges from "./pages/Exchanges";
import History from "./pages/History";
import Trash from "./pages/Trash";
import ArticleDetail from "./pages/ArticleDetail";
import ClientDetail from "./pages/ClientDetail";

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppInner />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppInner() {
  const notify = useToast();
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState("dashboard");
  const [quickNew, setQuickNew] = useState(null); // tab que deve abrir "+ Novo" automaticamente
  const [quickEdit, setQuickEdit] = useState(null); // { tab, id } — vindo da pesquisa global
  const [contentFilterArticleId, setContentFilterArticleId] = useState(null); // vindo de "Ver conteúdo" num artigo
  const [calendarInitialDate, setCalendarInitialDate] = useState(null); // mês a abrir no Calendário, vindo da data do Painel
  const [presetLiveDate, setPresetLiveDate] = useState(null); // data pré-preenchida ao criar um direto a partir do Calendário
  const [articleDetailId, setArticleDetailId] = useState(null); // ficha completa do artigo aberta
  const [clientDetailId, setClientDetailId] = useState(null); // ficha completa do cliente aberta
  const [liveDetailId, setLiveDetailId] = useState(null); // direto aberto (detalhe)
  const [showAllWaitlist, setShowAllWaitlist] = useState(false); // lista de espera agregada de todos os diretos
  const [quickDuplicate, setQuickDuplicate] = useState(null); // id do artigo a duplicar, vindo da ficha completa
  const [quickNewSize, setQuickNewSize] = useState(null); // id do artigo a partir do qual criar um novo tamanho, vindo da ficha completa
  const [saleReturnLiveId, setSaleReturnLiveId] = useState(null); // id do direto de onde se veio, para poder voltar a partir das Vendas
  const [presetSaleArticleId, setPresetSaleArticleId] = useState(null); // pré-preencher venda a partir da ficha
  const [presetSaleClientId, setPresetSaleClientId] = useState(null); // pré-preencher venda a partir da ficha do cliente
  const [presetExchangeSaleId, setPresetExchangeSaleId] = useState(null); // pré-preencher troca a partir de uma venda
  const [presetContentArticleId, setPresetContentArticleId] = useState(null); // pré-preencher conteúdo a partir da ficha
  const [showSearch, setShowSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navStack, setNavStack] = useState([]); // histórico de "onde estava antes" — para o botão "← Voltar"

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---------- atalhos de teclado ----------
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      if (typing) return;
      if (e.key === "n" || e.key === "N") {
        if (["suppliers", "articles", "purchases", "clients", "sales", "content", "lives", "communication", "exchanges"].includes(tab)) {
          e.preventDefault();
          setQuickNew(tab);
        }
      }
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tab]);

  const { rows: suppliers } = useRealtimeTable("suppliers");
  const { rows: articles } = useRealtimeTable("articles");
  const { rows: purchases } = useRealtimeTable("purchases");
  const { rows: clients } = useRealtimeTable("clients");
  const { rows: sales } = useRealtimeTable("sales");
  const { rows: contentItems } = useRealtimeTable("content_items");
  const { rows: lives } = useRealtimeTable("lives");
  const { rows: liveRegistos } = useRealtimeTable("live_registos");
  const { rows: messageTemplates } = useRealtimeTable("message_templates");
  const { rows: exchanges } = useRealtimeTable("exchanges");
  const { rows: tasks } = useRealtimeTable("tasks");
  const { rows: marketingDates } = useRealtimeTable("marketing_dates");
  const { rows: settingsRows } = useRealtimeTable("settings", "updated_at");
  const settings = { ...DEFAULT_SETTINGS, ...(settingsRows[0] || {}) };

  const articlesComputed = computeArticles(articles, sales, exchanges);
  const clientNameEarly = (id) => clients.find((c) => c.id === id)?.nome || "—";
  const articleNameEarly = (id) => articles.find((a) => a.id === id)?.artigo || "—";

  // Mantém o Centro de Tarefas sincronizado com as regras automáticas: cria a tarefa quando
  // a condição passa a verificar-se, e conclui-a sozinha quando deixa de se verificar — sem
  // nunca duplicar (a "chave" de cada regra+registo é única). Tarefas manuais nunca são tocadas.
  useEffect(() => {
    const tarefasAtivas = gerarTarefasAutomaticas({ sales, articles, contentItems, liveRegistos, clients, articleName: articleNameEarly, clientName: clientNameEarly, settings, marketingDates });
    const chavesAtivas = new Set(tarefasAtivas.map((t) => t.chave));
    const tarefasAutoExistentes = tasks.filter((t) => t.tipo === "auto");
    const chavesExistentes = new Set(tarefasAutoExistentes.map((t) => t.chave));

    tarefasAtivas.forEach((t) => {
      if (!chavesExistentes.has(t.chave)) {
        insertRow("tasks", { chave: t.chave, tipo: "auto", titulo: t.titulo, origem_tab: t.origem_tab, origem_id: t.origem_id, estado: "Pendente", prazo: t.prazo || null }).catch(() => {
          // ignora — se falhar por chave duplicada (corrida entre a Rosa e a Rita a abrir ao mesmo tempo), o tempo real traz o registo do outro lado
        });
      }
    });
    tarefasAutoExistentes.forEach((t) => {
      if (t.estado === "Pendente" && !chavesAtivas.has(t.chave)) {
        updateRow("tasks", t.id, { estado: "Concluída", concluida_at: new Date().toISOString() });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, articles, contentItems, liveRegistos, clients, tasks, settingsRows, marketingDates]);

  // Mantém "estado" sincronizado com o stock atual, só nos dois estados automáticos —
  // "Sem Reposição" e "Pausado" são escolhas manuais e nunca são tocados por aqui.
  useEffect(() => {
    articlesComputed.forEach((a) => {
      const estadoAtual = a.estado || "Em stock"; // artigos antigos sem "estado" gravado contam como "Em stock"
      if (estadoAtual === "Em stock" && a.stockAtual <= 0) {
        updateRow("articles", a.id, { estado: "Esgotado — vai repor" });
      } else if (estadoAtual === "Esgotado — vai repor" && a.stockAtual > 0) {
        updateRow("articles", a.id, { estado: "Em stock" });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, sales, exchanges]);

  if (session === undefined) return null; // a verificar sessão
  if (!session) return <Login />;

  const clientsComputed = computeClients(clients, sales);
  const loggedInOwner = ownerFromEmail(session.user.email);

  const supplierName = (id) => suppliers.find((s) => s.id === id)?.nome || "—";
  const articleName = (id) => articles.find((a) => a.id === id)?.artigo || "—";
  const clientName = (id) => clients.find((c) => c.id === id)?.nome || "—";

  function handleExport() {
    try {
      exportExcel({ articles, suppliers, articlesComputed, purchases, clientsComputed, clients, sales, contentItems, supplierName, articleName, clientName });
      notify("Excel exportado.");
    } catch (err) {
      notify(err.message || "Não foi possível exportar o Excel.", "error");
    }
  }

  function goToWithNew(targetTab) {
    setNavStack((p) => [...p, snapshotView()]);
    setTab(targetTab);
    setQuickNew(targetTab);
  }

  // Estado relevante para "onde é que eu estava" — usado pelo botão "← Voltar".
  function snapshotView() {
    return {
      tab, articleDetailId, clientDetailId, liveDetailId, showAllWaitlist,
      quickEdit, contentFilterArticleId, calendarInitialDate,
    };
  }
  function restoreView(v) {
    setTab(v.tab);
    setArticleDetailId(v.articleDetailId ?? null);
    setClientDetailId(v.clientDetailId ?? null);
    setLiveDetailId(v.liveDetailId ?? null);
    setShowAllWaitlist(!!v.showAllWaitlist);
    setQuickEdit(v.quickEdit ?? null);
    setContentFilterArticleId(v.contentFilterArticleId ?? null);
    setCalendarInitialDate(v.calendarInitialDate ?? null);
  }
  // Chamar no início de qualquer atalho que salte para outro sítio da app (um alerta do
  // Painel, um link de tarefa, etc.) — guarda "onde estava" para se poder voltar depois.
  function pushNav() {
    setNavStack((p) => [...p, snapshotView()]);
  }
  function goBack() {
    setNavStack((p) => {
      if (p.length === 0) return p;
      restoreView(p[p.length - 1]);
      return p.slice(0, -1);
    });
  }

  function handleTabChange(newTab) {
    setNavStack([]); // navegação manual pela barra lateral — recomeça, já não faz sentido "voltar"
    if (newTab === "articles") setArticleDetailId(null); // clicar em "Artigos" na barra volta sempre à lista
    if (newTab === "clients") setClientDetailId(null); // clicar em "Clientes" na barra volta sempre à lista
    if (newTab === "lives") { setLiveDetailId(null); setShowAllWaitlist(false); } // clicar em "Diretos" na barra volta sempre à lista
    setSaleReturnLiveId(null); // navegação manual pela barra — já não faz sentido "voltar ao direto"
    setTab(newTab);
  }

  // Como handleTabChange, mas para atalhos contextuais (alertas do Painel, etc.) — mantém o
  // histórico para se poder voltar, em vez de o limpar.
  function jumpToTab(newTab) {
    pushNav();
    if (newTab === "articles") setArticleDetailId(null);
    if (newTab === "clients") setClientDetailId(null);
    if (newTab === "lives") { setLiveDetailId(null); setShowAllWaitlist(false); }
    setTab(newTab);
  }

  function openRecord(recordTab, id) {
    if (recordTab === "articles") { openArticleDetail(id); return; }
    if (recordTab === "clients") { openClientDetail(id); return; }
    pushNav();
    setTab(recordTab);
    setQuickEdit({ tab: recordTab, id });
    setShowSearch(false);
  }

  function viewContentForArticle(articleId) {
    pushNav();
    setTab("content");
    setContentFilterArticleId(articleId);
  }

  function openArticleDetail(articleId) {
    pushNav();
    setTab("articles");
    setArticleDetailId(articleId);
    setShowSearch(false);
  }

  function openCalendar(date) {
    pushNav();
    setCalendarInitialDate(date || null);
    setTab("calendar");
  }

  function openLiveFromCalendar(liveId) {
    pushNav();
    setLiveDetailId(liveId);
    setShowAllWaitlist(false);
    setTab("lives");
  }

  function newLiveFromCalendar(date) {
    pushNav();
    setPresetLiveDate(date);
    setQuickNew("lives");
    setLiveDetailId(null);
    setShowAllWaitlist(false);
    setTab("lives");
  }

  function openTaskOrigem(origemTab, origemId) {
    pushNav();
    if (origemTab === "sales") { setTab("sales"); setQuickEdit({ tab: "sales", id: origemId }); return; }
    if (origemTab === "articles") { setTab("articles"); setArticleDetailId(origemId); setShowSearch(false); return; }
    if (origemTab === "clients") { setTab("clients"); setClientDetailId(origemId); setShowSearch(false); return; }
    if (origemTab === "content") { setTab("content"); return; }
    if (origemTab === "lives-waitlist") { setLiveDetailId(null); setTab("lives"); setShowAllWaitlist(true); return; }
    setTab(origemTab);
  }

  function openClientDetail(clientId) {
    pushNav();
    setTab("clients");
    setClientDetailId(clientId);
    setShowSearch(false);
  }

  function registerSaleForClient(clientId) {
    pushNav();
    setClientDetailId(null);
    setTab("sales");
    setQuickNew("sales");
    setPresetSaleClientId(clientId);
  }

  function registerSaleForArticle(articleId) {
    pushNav();
    setArticleDetailId(null);
    setTab("sales");
    setQuickNew("sales");
    setPresetSaleArticleId(articleId);
  }

  function newContentForArticle(articleId) {
    pushNav();
    setArticleDetailId(null);
    setTab("content");
    setQuickNew("content");
    setPresetContentArticleId(articleId);
  }

  return (
    <Layout tab={tab} setTab={handleTabChange} userEmail={session.user.email} onExport={handleExport} onSearch={() => setShowSearch(true)}>
      {navStack.length > 0 && (
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-stone hover:text-ink mb-3 -mt-1"
          title="Voltar a onde estava"
        >
          ← Voltar
        </button>
      )}
      {tab === "dashboard" && (
        <Dashboard
          articles={articles} articlesComputed={articlesComputed} purchases={purchases} sales={sales}
          suppliers={suppliers} clients={clients} clientsComputed={clientsComputed} lives={lives} liveRegistos={liveRegistos} exchanges={exchanges} contentItems={contentItems}
          articleName={articleName} clientName={clientName} supplierName={supplierName}
          userEmail={session.user.email}
          onQuickAction={goToWithNew}
          onNavigate={jumpToTab}
          onOpenCalendar={openCalendar}
          tasksPendentes={tasks.filter((t) => t.estado === "Pendente").length}
          settings={settings}
        />
      )}
      {tab === "suppliers" && (
        <Suppliers
          suppliers={suppliers}
          autoOpenNew={quickNew === "suppliers"} onConsumedAutoOpen={() => setQuickNew(null)}
          autoOpenEditId={quickEdit?.tab === "suppliers" ? quickEdit.id : null} onConsumedAutoOpenEdit={() => setQuickEdit(null)}
        />
      )}
      {tab === "articles" && articleDetailId && (
        <ArticleDetail
          articleId={articleDetailId}
          articlesComputed={articlesComputed} suppliers={suppliers} purchases={purchases} sales={sales} contentItems={contentItems}
          supplierName={supplierName} clientName={clientName}
          onBack={() => setArticleDetailId(null)}
          onEdit={(a) => { setArticleDetailId(null); setQuickEdit({ tab: "articles", id: a.id }); }}
          onDuplicate={(a) => { setArticleDetailId(null); setQuickDuplicate(a.id); }}
          onNewSize={(a) => { setArticleDetailId(null); setQuickNewSize(a.id); }}
          onRegisterSale={registerSaleForArticle}
          onNewContent={newContentForArticle}
          onViewAllContent={(id) => { setArticleDetailId(null); viewContentForArticle(id); }}
          onOpenClient={(id) => { setArticleDetailId(null); openClientDetail(id); }}
          onOpenSale={(saleId) => { pushNav(); setArticleDetailId(null); setTab("sales"); setQuickEdit({ tab: "sales", id: saleId }); }}
        />
      )}
      {tab === "articles" && !articleDetailId && (
        <Articles
          articlesComputed={articlesComputed} articles={articles} suppliers={suppliers} purchases={purchases} supplierName={supplierName}
          contentItems={contentItems} onViewContent={viewContentForArticle} onOpenDetail={openArticleDetail}
          autoOpenNew={quickNew === "articles"} onConsumedAutoOpen={() => setQuickNew(null)}
          autoOpenEditId={quickEdit?.tab === "articles" ? quickEdit.id : null} onConsumedAutoOpenEdit={() => setQuickEdit(null)}
          autoDuplicateId={quickDuplicate} onConsumedAutoDuplicate={() => setQuickDuplicate(null)}
          autoNewSizeId={quickNewSize} onConsumedAutoNewSize={() => setQuickNewSize(null)}
          settings={settings}
        />
      )}
      {tab === "purchases" && (
        <Purchases purchases={purchases} suppliers={suppliers} supplierName={supplierName} autoOpenNew={quickNew === "purchases"} onConsumedAutoOpen={() => setQuickNew(null)} />
      )}
      {tab === "clients" && clientDetailId && (
        <ClientDetail
          clientId={clientDetailId}
          clientsComputed={clientsComputed} sales={sales} articlesComputed={articlesComputed} liveRegistos={liveRegistos} lives={lives} articleName={articleName}
          messageTemplates={messageTemplates}
          onBack={() => setClientDetailId(null)}
          onEdit={(c) => { setClientDetailId(null); setQuickEdit({ tab: "clients", id: c.id }); }}
          onRegisterSale={registerSaleForClient}
          settings={settings}
        />
      )}
      {tab === "clients" && !clientDetailId && (
        <Clients
          clientsComputed={clientsComputed} onOpenDetail={openClientDetail}
          autoOpenNew={quickNew === "clients"} onConsumedAutoOpen={() => setQuickNew(null)}
          autoOpenEditId={quickEdit?.tab === "clients" ? quickEdit.id : null} onConsumedAutoOpenEdit={() => setQuickEdit(null)}
          settings={settings}
        />
      )}
      {tab === "sales" && (
        <Sales
          sales={sales} articles={articles} clients={clients} clientsComputed={clientsComputed} articleName={articleName} clientName={clientName} articlesComputed={articlesComputed}
          messageTemplates={messageTemplates}
          autoOpenNew={quickNew === "sales"} onConsumedAutoOpen={() => setQuickNew(null)}
          presetArticleId={presetSaleArticleId} onConsumedPresetArticle={() => setPresetSaleArticleId(null)}
          presetClientId={presetSaleClientId} onConsumedPresetClient={() => setPresetSaleClientId(null)}
          autoOpenEditId={quickEdit?.tab === "sales" ? quickEdit.id : null} onConsumedAutoOpenEdit={() => setQuickEdit(null)}
          onRequestExchange={(saleId) => { setTab("exchanges"); setPresetExchangeSaleId(saleId); }}
          returnToLiveId={saleReturnLiveId}
          liveName={saleReturnLiveId ? (lives.find((l) => l.id === saleReturnLiveId)?.nome || null) : null}
          onReturnToLive={() => { setTab("lives"); setLiveDetailId(saleReturnLiveId); setSaleReturnLiveId(null); }}
          loggedInOwner={loggedInOwner}
          onOpenArticle={openArticleDetail}
          liveRegistos={liveRegistos}
          settings={settings}
        />
      )}
      {tab === "exchanges" && (
        <Exchanges
          exchanges={exchanges} sales={sales} articlesComputed={articlesComputed} clientName={clientName} articleName={articleName}
          presetSaleId={presetExchangeSaleId} onConsumedPresetSale={() => setPresetExchangeSaleId(null)}
          autoOpenNew={quickNew === "exchanges"} onConsumedAutoOpen={() => setQuickNew(null)}
          autoOpenEditId={quickEdit?.tab === "exchanges" ? quickEdit.id : null} onConsumedAutoOpenEdit={() => setQuickEdit(null)}
          settings={settings}
        />
      )}
      {tab === "content" && (
        <Content
          contentItems={contentItems} articles={articles} articleName={articleName}
          autoOpenNew={quickNew === "content"} onConsumedAutoOpen={() => setQuickNew(null)}
          autoFilterArticleId={contentFilterArticleId} onConsumedAutoFilter={() => setContentFilterArticleId(null)}
          presetArticleId={presetContentArticleId} onConsumedPresetArticle={() => setPresetContentArticleId(null)}
          onOpenArticle={(id) => openArticleDetail(id)}
        />
      )}
      {tab === "calendar" && (
        <Calendar
          contentItems={contentItems} articles={articles} articleName={articleName}
          lives={lives}
          onOpenLive={openLiveFromCalendar}
          onNewLive={newLiveFromCalendar}
          tasks={tasks}
          onOpenTasks={() => setTab("tasks")}
          initialDate={calendarInitialDate} onConsumedInitialDate={() => setCalendarInitialDate(null)}
        />
      )}
      {tab === "tasks" && (
        <Tasks tasks={tasks} onOpenOrigem={openTaskOrigem} />
      )}
      {tab === "price-suggestions" && (
        <PriceSuggestions articlesComputed={articlesComputed} sales={sales} settings={settings} onOpenArticle={openArticleDetail} />
      )}
      {tab === "settings" && (
        <Settings settings={settings} marketingDates={marketingDates} />
      )}
      {tab === "history" && <History />}
      {tab === "trash" && <Trash />}
      {tab === "communication" && (
        <MessageTemplates
          templates={messageTemplates}
          autoOpenNew={quickNew === "communication"} onConsumedAutoOpen={() => setQuickNew(null)}
          autoOpenEditId={quickEdit?.tab === "communication" ? quickEdit.id : null} onConsumedAutoOpenEdit={() => setQuickEdit(null)}
        />
      )}
      {tab === "lives" && !liveDetailId && !showAllWaitlist && (
        <Lives
          lives={lives} liveRegistos={liveRegistos} articlesComputed={articlesComputed}
          autoOpenNew={quickNew === "lives"} onConsumedAutoOpen={() => setQuickNew(null)}
          autoOpenEditId={quickEdit?.tab === "lives" ? quickEdit.id : null} onConsumedAutoOpenEdit={() => setQuickEdit(null)}
          presetDate={presetLiveDate} onConsumedPresetDate={() => setPresetLiveDate(null)}
          onOpenLive={(id) => setLiveDetailId(id)}
          onOpenAllWaitlist={() => setShowAllWaitlist(true)}
        />
      )}
      {tab === "lives" && showAllWaitlist && (
        <WaitlistAll
          lives={lives} liveRegistos={liveRegistos} clients={clients} articlesComputed={articlesComputed} articleName={articleName}
          messageTemplates={messageTemplates} loggedInOwner={loggedInOwner}
          onBack={() => setShowAllWaitlist(false)}
          onOpenLive={(id) => { pushNav(); setShowAllWaitlist(false); setLiveDetailId(id); }}
          onOpenSale={(saleId) => { pushNav(); setSaleReturnLiveId(null); setShowAllWaitlist(false); setTab("sales"); setQuickEdit({ tab: "sales", id: saleId }); }}
          settings={settings}
        />
      )}
      {tab === "lives" && liveDetailId && (
        <LiveDetail
          live={lives.find((l) => l.id === liveDetailId)}
          registos={liveRegistos.filter((r) => r.live_id === liveDetailId)}
          clients={clients} clientsComputed={clientsComputed} articlesComputed={articlesComputed} articleName={articleName}
          messageTemplates={messageTemplates}
          onBack={() => setLiveDetailId(null)}
          onEdit={(l) => { setLiveDetailId(null); setQuickEdit({ tab: "lives", id: l.id }); }}
          onOpenSale={(saleId) => { setSaleReturnLiveId(liveDetailId); setLiveDetailId(null); setTab("sales"); setQuickEdit({ tab: "sales", id: saleId }); }}
          loggedInOwner={loggedInOwner}
          settings={settings}
        />
      )}

      {showSearch && (
        <GlobalSearch
          suppliers={suppliers}
          clients={clients}
          articlesComputed={articlesComputed}
          onClose={() => setShowSearch(false)}
          onOpenRecord={openRecord}
        />
      )}
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </Layout>
  );
}
