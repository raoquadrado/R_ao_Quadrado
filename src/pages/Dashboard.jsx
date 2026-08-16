import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { computeFullDashboard } from "../lib/dashboardStats";
import { money, fmtDate, displaySku, todayISO } from "../lib/computations";
import { CLIENT_STATUS_COLORS, MOTIVATIONAL_QUOTES, ownerFromEmail } from "../lib/constants";
import { feriadoDoDia, diasEspeciaisDoDia } from "../lib/specialDays";
import { Badge } from "../components/ui";
import Logo from "../components/Logo";

const PURPLE = "#A83F91";
const PURPLE_DARK = "#832F72";
const GOLD = "#C9972B";
const GOLD_DARK = "#A67C1E";
const donutColors = [PURPLE, GOLD, "#C9A8F0", "#E8CE8A", "#4A2A85"];

const PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mês" },
  { key: "year", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

export default function Dashboard(props) {
  const { articles, articlesComputed, purchases, sales, suppliers, clients, clientsComputed, lives, liveRegistos, exchanges, contentItems, articleName, clientName, supplierName, userEmail, onQuickAction, onNavigate, onOpenCalendar, tasksPendentes, settings } = props;

  const [periodKey, setPeriodKey] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [owner, setOwner] = useState("Todos");

  const { kpis, charts, lists, alerts, pulse, saude, financas, resumoHoje } = computeFullDashboard({
    articles, articlesComputed, purchases, sales, suppliers, clients, clientsComputed, lives, liveRegistos, exchanges, contentItems,
    periodKey, customStart, customEnd, owner, settings,
  });

  return (
    <div className="bg-beige-50 -m-4 md:-m-8 p-4 md:p-8 min-h-full">
      <HeroGreeting userEmail={userEmail} resumoHoje={resumoHoje} alerts={alerts} onNavigate={onNavigate} onOpenCalendar={onOpenCalendar} tasksPendentes={tasksPendentes} />

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-ink mb-0.5">Painel geral</h1>
          <p className="text-stone text-sm">Visão completa do negócio, em tempo real.</p>
        </div>
        <FilterBar periodKey={periodKey} setPeriodKey={setPeriodKey} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd} owner={owner} setOwner={setOwner} />
      </div>

      <QuickActions onQuickAction={onQuickAction} />

      <PulseStrip pulse={pulse} />

      {/* ---------- 💰 Financeiro ---------- */}
      <CollapsibleSection icon="💰" title="Financeiro" subtitle="Recebido, por receber, lucro, valor investido e tendências">
        <KpiRow items={[...kpis.row1, ...financas, saude.find((s) => s.key === "ticket"), saude.find((s) => s.key === "margemMedia")]} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2 mb-5">
          <ChartCard title="Compras por mês">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.comprasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9E9EF" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v) => money(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="Compras" fill={PURPLE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Vendas por mês">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={charts.vendasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9E9EF" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v) => money(v)} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Vendas" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3, fill: GOLD }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Lucro por mês">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={charts.lucroPorMes}>
                <defs>
                  <linearGradient id="lucroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PURPLE} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={PURPLE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9E9EF" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v) => money(v)} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="Lucro" stroke={PURPLE_DARK} strokeWidth={2.5} fill="url(#lucroGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Lucro por owner">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.lucroPorOwner}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9E9EF" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8677" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v) => money(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="Lucro" radius={[6, 6, 0, 0]}>
                  {charts.lucroPorOwner.map((_, i) => <Cell key={i} fill={i === 0 ? PURPLE : GOLD} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 gap-5">
          <QuickList title="Últimos movimentos">
            {lists.ultimosMovimentos.length === 0 ? <Empty /> : lists.ultimosMovimentos.map((m) => (
              <ListRow
                key={m.id + m.kind}
                onClick={() => onNavigate(m.kind === "venda" ? "sales" : "purchases")}
                line1={m.kind === "venda" ? clientName(m.client_id) : supplierName(m.supplier_id)}
                line2={fmtDate(m.data)}
                right={money(m.kind === "venda" ? m.valor_venda : Number(m.valor_aquisicao || 0) - Number(m.desconto || 0))}
                badge={{ text: m.kind, color: m.kind === "venda" ? GOLD_DARK : PURPLE_DARK, bg: m.kind === "venda" ? "#F5EADD" : "#F7E3F2" }}
              />
            ))}
          </QuickList>
        </div>
      </CollapsibleSection>

      {/* ---------- 📦 Stock & Artigos ---------- */}
      <CollapsibleSection icon="📦" title="Stock & Artigos" subtitle="Quantidades, tempo até vender, fotos e publicação">
        <KpiRow items={[...kpis.row2, ...saude.filter((s) => s.key !== "ticket" && s.key !== "margemMedia")]} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2 mb-5">
          <ChartCard title="Estado do stock">
            <DonutChart data={charts.estadoStock} unit=" un." />
          </ChartCard>
          <ChartCard title="Artigos por categoria">
            <DonutChart data={charts.artigosPorCategoria} unit=" artigo(s)" />
          </ChartCard>
          <ChartCard title="Artigos por owner">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts.artigosPorOwner} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label={{ fontSize: 12 }}>
                  {charts.artigosPorOwner.map((_, i) => <Cell key={i} fill={i === 0 ? PURPLE : GOLD} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v} artigo(s)`} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <QuickList title="Artigos reservados" onSeeAll={() => onNavigate("sales")}>
            {lists.artigosReservados.length === 0 ? <Empty /> : lists.artigosReservados.map((s) => (
              <ListRow
                key={s.id}
                onClick={() => onNavigate("sales")}
                line1={`${s.article?.sku ? s.article.sku + " · " : ""}${articleName(s.article_id)}`}
                line2={clientName(s.client_id)}
                right={s.data_limite_reserva ? fmtDate(s.data_limite_reserva) : "sem prazo"}
              />
            ))}
          </QuickList>

          <QuickList title="Top 10 artigos mais vendidos" onSeeAll={() => onNavigate("articles")}>
            {lists.maisVendidosArtigos.length === 0 ? <Empty /> : lists.maisVendidosArtigos.map((a) => (
              <ListRow
                key={a.id}
                onClick={() => onNavigate("articles")}
                line1={`${displaySku(a) ? displaySku(a) + " · " : ""}${a.artigo}`}
                line2={`${a.soldQty} vendida${a.soldQty > 1 ? "s" : ""}`}
                right={money(a.soldQty * a.valor_venda)}
              />
            ))}
          </QuickList>

          <QuickList title="Top 10 artigos com maior margem" onSeeAll={() => onNavigate("articles")}>
            {lists.maiorMargemArtigos.length === 0 ? <Empty /> : lists.maiorMargemArtigos.map((a) => (
              <ListRow
                key={a.id}
                onClick={() => onNavigate("articles")}
                line1={`${displaySku(a) ? displaySku(a) + " · " : ""}${a.artigo}`}
                line2={`${money(a.valor_venda)} venda · ${money(a.preco_unitario)} custo`}
                right={`${a.margemPct.toFixed(0)}%`}
              />
            ))}
          </QuickList>

          <QuickList title="Artigos que nunca venderam" onSeeAll={() => onNavigate("articles")}>
            {lists.artigosNuncaVendidos.length === 0 ? <Empty /> : lists.artigosNuncaVendidos.map((a) => (
              <ListRow
                key={a.id}
                onClick={() => onNavigate("articles")}
                line1={`${displaySku(a) ? displaySku(a) + " · " : ""}${a.artigo}`}
                line2={`em stock desde ${fmtDate(a.created_at)}`}
                right={`${a.stockAtual} em stock`}
              />
            ))}
          </QuickList>
        </div>
      </CollapsibleSection>

      {/* ---------- 👥 Clientes ---------- */}
      <CollapsibleSection icon="👥" title="Clientes" subtitle="Últimos clientes, reservas por pagar e melhores/piores">
        <KpiRow items={kpis.row3.filter((k) => k.key === "clientes")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <QuickList title="Últimos clientes" onSeeAll={() => onNavigate("clients")}>
            {lists.ultimosClientes.length === 0 ? <Empty /> : lists.ultimosClientes.map((c) => (
              <ListRow key={c.id} onClick={() => onNavigate("clients")} line1={c.nome} line2={`Última compra: ${fmtDate(c.dataUltimaCompra)}`} right={money(c.totalGasto)} />
            ))}
          </QuickList>

          <QuickList title="Reservas por concluir" onSeeAll={() => onNavigate("clients")}>
            {lists.clientesReservaPendente.length === 0 ? <Empty /> : lists.clientesReservaPendente.map((c) => (
              <ListRow
                key={c.id}
                onClick={() => onNavigate("clients")}
                line1={c.nome}
                line2={`${c.nPendentes} reserva(s) · última em ${fmtDate(c.ultimaReserva)}`}
                right={money(c.valorPendente)}
              />
            ))}
          </QuickList>

          <QuickList title="Top 10 melhores clientes" onSeeAll={() => onNavigate("clients")}>
            {lists.melhoresClientes.length === 0 ? <Empty /> : lists.melhoresClientes.map((c) => {
              const sc = CLIENT_STATUS_COLORS[c.estadoCliente];
              return (
                <ListRow
                  key={c.id}
                  onClick={() => onNavigate("clients")}
                  line1={c.nome}
                  line2={`${c.nCompras} compra(s) · ${money(c.totalGasto)}`}
                  right={`${c.pontos} pts`}
                  badge={sc ? { text: c.estadoCliente, color: sc.color, bg: sc.bg } : undefined}
                />
              );
            })}
          </QuickList>

          <QuickList title="Top 10 piores clientes" onSeeAll={() => onNavigate("clients")}>
            {lists.pioresClientes.length === 0 ? <Empty /> : lists.pioresClientes.map((c) => (
              <ListRow
                key={c.id}
                onClick={() => onNavigate("clients")}
                line1={c.nome}
                line2={`${c.nNaoPagas} peça(s) não paga(s)`}
                right={`${c.pontos} pts`}
                badge={{ text: "Bloqueado", color: CLIENT_STATUS_COLORS.Bloqueado.color, bg: CLIENT_STATUS_COLORS.Bloqueado.bg }}
              />
            ))}
          </QuickList>
        </div>
      </CollapsibleSection>

      {/* ---------- 🚚 Compras & Fornecedores ---------- */}
      <CollapsibleSection icon="🚚" title="Compras & Fornecedores" subtitle="Nº de fornecedores, compras do período e últimas compras">
        <KpiRow items={kpis.row3.filter((k) => k.key === "forn" || k.key === "comprasMes")} />
        <div className="grid grid-cols-1 gap-5">
          <QuickList title="Últimas compras" onSeeAll={() => onNavigate("purchases")}>
            {lists.ultimasCompras.length === 0 ? <Empty /> : lists.ultimasCompras.map((p) => (
              <ListRow
                key={p.id}
                onClick={() => onNavigate("purchases")}
                line1={supplierName(p.supplier_id)}
                line2={fmtDate(p.data)}
                right={money(Number(p.valor_aquisicao || 0) - Number(p.desconto || 0))}
                badge={p.fatura ? undefined : { text: "sem fatura", color: GOLD_DARK, bg: "#F5EADD" }}
              />
            ))}
          </QuickList>
        </div>
      </CollapsibleSection>

      {/* ---------- 🧾 Vendas ---------- */}
      <CollapsibleSection icon="🧾" title="Vendas" subtitle="Vendas do período, últimas vendas e pagamentos">
        <KpiRow items={kpis.row3.filter((k) => k.key === "vendasMes")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <QuickList title="Últimas vendas" onSeeAll={() => onNavigate("sales")}>
            {lists.ultimasVendas.length === 0 ? <Empty /> : lists.ultimasVendas.map((s) => (
              <ListRow
                key={s.id}
                onClick={() => onNavigate("sales")}
                line1={clientName(s.client_id)}
                line2={fmtDate(s.data)}
                right={money(s.valor_venda)}
                badge={{ text: s.estado, color: s.estado === "Pago" ? "#254238" : GOLD_DARK, bg: s.estado === "Pago" ? "#DCEBE4" : "#F5EADD" }}
              />
            ))}
          </QuickList>

          <QuickList title="Últimos pagamentos" onSeeAll={() => onNavigate("sales")}>
            {lists.ultimosPagamentos.length === 0 ? <Empty /> : lists.ultimosPagamentos.map((s) => (
              <ListRow
                key={s.id}
                onClick={() => onNavigate("sales")}
                line1={clientName(s.client_id)}
                line2={`Pago em ${fmtDate(s.data_pagamento)}`}
                right={money(s.valor_venda)}
              />
            ))}
          </QuickList>
        </div>
      </CollapsibleSection>

      {/* ---------- 🎥 Diretos, Conteúdo & Trocas ---------- */}
      <CollapsibleSection icon="🎥" title="Diretos, Conteúdo & Trocas" subtitle="Diretos do período, publicações concluídas, trocas em aberto e stock em risco">
        <KpiRow items={kpis.row4} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <QuickList title="Próximos diretos" onSeeAll={() => onNavigate("lives")}>
            {lists.proximosDiretos.length === 0 ? <Empty /> : lists.proximosDiretos.map((l) => (
              <ListRow
                key={l.id}
                onClick={() => onNavigate("lives")}
                line1={l.nome || l.codigo || "Direto"}
                line2={`${fmtDate(l.data)}${l.hora_inicio ? " · " + l.hora_inicio : ""}`}
                right={l.estado}
              />
            ))}
          </QuickList>

          <QuickList title="Trocas em aberto" onSeeAll={() => onNavigate("exchanges")}>
            {lists.trocasAbertasLista.length === 0 ? <Empty /> : lists.trocasAbertasLista.map((e) => (
              <ListRow
                key={e.id}
                onClick={() => onNavigate("exchanges")}
                line1={clientName(sales.find((s) => s.id === e.sale_id)?.client_id)}
                line2={e.estado}
                right={e.limite ? fmtDate(e.limite) : "sem prazo"}
              />
            ))}
          </QuickList>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function PulseStrip({ pulse }) {
  const groups = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Esta semana" },
    { key: "mes", label: "Este mês" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      {groups.map((g) => (
        <div key={g.key} className="bg-white rounded-2xl shadow-soft p-4">
          <h3 className="font-display text-sm font-semibold text-ink mb-2.5">{g.label}</h3>
          <div className="flex justify-between text-xs">
            <PulseStat label="Compras" value={pulse[g.key].compras} color={GOLD_DARK} />
            <PulseStat label="Vendas" value={pulse[g.key].vendas} color={PURPLE_DARK} />
            <PulseStat label="Lucro" value={pulse[g.key].lucro} color={pulse[g.key].lucro >= 0 ? "#254238" : "#7A2A24"} />
          </div>
        </div>
      ))}
    </div>
  );
}

function greetingNow() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: "Bom dia", icon: "☀️" };
  if (h >= 12 && h < 20) return { text: "Boa tarde", icon: "🌤️" };
  return { text: "Boa noite", icon: "🌙" };
}

function HeroGreeting({ userEmail, resumoHoje, alerts, onNavigate, onOpenCalendar, tasksPendentes }) {
  const { text: greetText, icon: greetIcon } = greetingNow();
  const name = ownerFromEmail(userEmail) || (userEmail || "").split("@")[0];
  const [now, setNow] = useState(new Date());
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const dataFormatada = now.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const horaFormatada = now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const feriadoHoje = feriadoDoDia(now);
  const especiaisHoje = diasEspeciaisDoDia(now);

  // "Pendente" — precisa de ação da Rosa/Rita hoje
  const pendente = [
    tasksPendentes > 0 && { icon: "✅", text: `${tasksPendentes} tarefa${tasksPendentes > 1 ? "s" : ""} pendente${tasksPendentes > 1 ? "s" : ""} no Centro de Tarefas`, tab: "tasks" },
    resumoHoje.porPreparar > 0 && { icon: "📦", text: `${resumoHoje.porPreparar} encomenda${resumoHoje.porPreparar > 1 ? "s" : ""} por preparar`, tab: "sales" },
    resumoHoje.reservas > 0 && { icon: "⏳", text: `${resumoHoje.reservas} reserva${resumoHoje.reservas > 1 ? "s" : ""} por concluir`, tab: "sales" },
    resumoHoje.porPublicar > 0 && { icon: "📢", text: `${resumoHoje.porPublicar} artigo${resumoHoje.porPublicar > 1 ? "s" : ""} por publicar`, tab: "articles" },
  ].filter(Boolean);

  // "Concluído" — já preparado/feito, só falta o passo seguinte (ex: enviar)
  const concluido = [
    resumoHoje.prontasEnviar > 0 && { icon: "🚚", text: `${resumoHoje.prontasEnviar} pronta${resumoHoje.prontasEnviar > 1 ? "s" : ""} para enviar`, tab: "sales" },
    resumoHoje.enviadasHoje > 0 && { icon: "📬", text: `${resumoHoje.enviadasHoje} encomenda${resumoHoje.enviadasHoje > 1 ? "s" : ""} enviada${resumoHoje.enviadasHoje > 1 ? "s" : ""} hoje`, tab: "sales" },
  ].filter(Boolean);

  // "Alertas" — avisos automáticos (stock, faturas, clientes bloqueados, etc.) — já inclui "stock baixo"
  const alertasItems = alerts.map((a) => ({ icon: a.icon, text: a.text, tab: a.tab }));

  // "Informações" — neutro, não pede ação nenhuma
  const informacoes = [
    resumoHoje.vendasHoje > 0 && { icon: "🧾", text: `${resumoHoje.vendasHoje} venda${resumoHoje.vendasHoje > 1 ? "s" : ""} efetuada${resumoHoje.vendasHoje > 1 ? "s" : ""} hoje`, tab: "sales" },
    resumoHoje.novosClientes > 0 && { icon: "🙋", text: `${resumoHoje.novosClientes} cliente${resumoHoje.novosClientes > 1 ? "s" : ""} novo${resumoHoje.novosClientes > 1 ? "s" : ""}`, tab: "clients" },
    resumoHoje.aniversarios > 0 && { icon: "🎂", text: `${resumoHoje.aniversarios} cliente${resumoHoje.aniversarios > 1 ? "s" : ""} faz${resumoHoje.aniversarios > 1 ? "em" : ""} anos hoje`, tab: "clients" },
    resumoHoje.aniversariosSemana > resumoHoje.aniversarios && { icon: "🎈", text: `${resumoHoje.aniversariosSemana - resumoHoje.aniversarios} aniversário(s) nos próximos 7 dias`, tab: "clients" },
    resumoHoje.proximoDireto && { icon: "🎥", text: `Próximo direto: ${resumoHoje.proximoDireto.nome || "sem nome"} — ${resumoHoje.proximoDireto.data === new Date().toISOString().slice(0, 10) ? "hoje" : fmtDate(resumoHoje.proximoDireto.data)}${resumoHoje.proximoDireto.hora_inicio ? ` às ${resumoHoje.proximoDireto.hora_inicio}` : ""}`, tab: "lives" },
  ].filter(Boolean);

  const semNada = pendente.length === 0 && concluido.length === 0 && alertasItems.length === 0 && informacoes.length === 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-500 to-gold-500 text-white p-6 md:p-7 mb-6 shadow-soft">
      <div className="relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Logo size="sm" light />
          <div className="text-right text-white/85 text-xs leading-tight">
            <button
              type="button"
              onClick={() => onOpenCalendar?.(todayISO())}
              title="Ver no calendário"
              className="capitalize underline decoration-white/40 hover:decoration-white cursor-pointer bg-transparent border-none p-0 text-inherit"
            >
              📅 {dataFormatada}
            </button>
            <div className="font-mono text-sm font-medium">{horaFormatada}</div>
            {feriadoHoje && (
              <div className="text-[11px] mt-0.5 font-medium" style={{ color: feriadoHoje.tipo === "nacional" ? "#FBE3A3" : "#A9DDF5" }}>
                {feriadoHoje.tipo === "nacional" ? "🎉" : "🏛️"} {feriadoHoje.nome}
              </div>
            )}
            {especiaisHoje.length > 0 && <div className="text-[11px] text-white/70 mt-0.5">✨ {especiaisHoje.join(" · ")}</div>}
          </div>
        </div>
        <h1 className="font-display text-2xl md:text-[28px] font-semibold mt-4 mb-1">
          {greetText}{name ? `, ${name}` : ""}! {greetIcon}
        </h1>
        <p className="text-white/75 text-xs italic mb-3">"{quote}"</p>
        {semNada ? (
          <p className="text-white/80 text-sm">Tudo em dia por aqui. 🎉</p>
        ) : (
          <>
            <p className="text-white/80 text-sm mb-3">Hoje tens:</p>
            <div className="flex flex-col gap-3">
              <HeroGroup label="Pendente" items={pendente} onNavigate={onNavigate} />
              <HeroGroup label="Concluído" items={concluido} onNavigate={onNavigate} />
              <HeroGroup label="Alertas" items={alertasItems} onNavigate={onNavigate} />
              <HeroGroup label="Informações" items={informacoes} onNavigate={onNavigate} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HeroGroup({ label, items, onNavigate }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-white/60 text-[10.5px] font-semibold uppercase tracking-wide mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          onNavigate && it.tab ? (
            <button
              key={i}
              onClick={() => onNavigate(it.tab)}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors backdrop-blur-sm rounded-full px-3.5 py-1.5 text-sm font-medium"
            >
              <span>{it.icon}</span>{it.text}
            </button>
          ) : (
            <span key={i} className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-sm font-medium">
              <span>{it.icon}</span>{it.text}
            </span>
          )
        ))}
      </div>
    </div>
  );
}

function CollapsibleSection({ icon, title, subtitle, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-soft mb-5 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <span>
            <span className="font-display text-base font-semibold text-ink block">{title}</span>
            {subtitle && <span className="text-xs text-stone">{subtitle}</span>}
          </span>
        </span>
        <span className={`text-stone text-sm transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

function PulseStat({ label, value, color }) {
  return (
    <div>
      <div className="font-mono text-base font-medium" style={{ color }}>{money(value)}</div>
      <div className="text-stone text-[11px] mt-0.5">{label}</div>
    </div>
  );
}

const tooltipStyle = { fontSize: 12, borderRadius: 10, border: "1px solid #E9E9EF", boxShadow: "0 4px 16px rgba(103,67,174,0.12)" };

function DonutChart({ data, unit }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-stone text-sm py-16 text-center">Sem dados ainda.</div>;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={donutColors[i % donutColors.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => `${v}${unit}`} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 transition-shadow hover:shadow-md">
      <h2 className="font-display text-[15px] font-semibold text-ink mb-3">{title}</h2>
      {children}
    </div>
  );
}

function KpiRow({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {items.map((k) => <KpiCard key={k.key} {...k} />)}
    </div>
  );
}

function KpiCard({ icon, label, value, kind, suffix, delta }) {
  const display = kind === "money" ? money(value) : `${Math.round(value)}${suffix || ""}`;
  const up = delta > 0.05;
  const down = delta < -0.05;
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-base mb-3">{icon}</div>
      <div className="font-display text-xl font-semibold text-ink">{display}</div>
      <div className="text-xs text-stone mt-1">{label}</div>
      {typeof delta === "number" && (
        <div className={`text-xs font-medium mt-2 inline-flex items-center gap-1 ${up ? "text-emerald-600" : down ? "text-clay-dark" : "text-stone"}`}>
          {up ? "↑" : down ? "↓" : "→"} {Math.abs(delta).toFixed(0)}% vs. período anterior
        </div>
      )}
    </div>
  );
}

function FilterBar({ periodKey, setPeriodKey, customStart, setCustomStart, customEnd, setCustomEnd, owner, setOwner }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex bg-white rounded-full shadow-soft p-1 gap-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriodKey(p.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${periodKey === p.key ? "bg-purple-500 text-white" : "text-stone hover:bg-beige-100"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {periodKey === "custom" && (
        <div className="flex items-center gap-1.5 bg-white rounded-full shadow-soft px-3 py-1.5">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="text-xs border-none focus:outline-none" />
          <span className="text-stone text-xs">a</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="text-xs border-none focus:outline-none" />
        </div>
      )}
      <div className="flex bg-white rounded-full shadow-soft p-1 gap-0.5">
        {["Todos", "Rosa", "Rita"].map((o) => (
          <button
            key={o}
            onClick={() => setOwner(o)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${owner === o ? "bg-gold-500 text-white" : "text-stone hover:bg-beige-100"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickActions({ onQuickAction }) {
  const actions = [
    { tab: "purchases", label: "Nova Compra", icon: "🛒" },
    { tab: "sales", label: "Nova Venda", icon: "🧾" },
    { tab: "clients", label: "Novo Cliente", icon: "👤" },
    { tab: "suppliers", label: "Novo Fornecedor", icon: "🚚" },
    { tab: "articles", label: "Novo Artigo", icon: "📦" },
  ];
  return (
    <div className="flex gap-3 flex-wrap mb-6">
      {actions.map((a) => (
        <button
          key={a.tab}
          onClick={() => onQuickAction(a.tab)}
          className="flex items-center gap-2 bg-white rounded-2xl shadow-soft px-4 py-3 text-sm font-medium text-ink hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        >
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-gold-500 text-white flex items-center justify-center text-xs">+</span>
          <span>{a.icon} {a.label}</span>
        </button>
      ))}
    </div>
  );
}

function QuickList({ title, children, onSeeAll }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
        {onSeeAll && <button onClick={onSeeAll} className="text-xs font-medium text-purple-600">Ver</button>}
      </div>
      <div className="flex flex-col divide-y divide-beige-100">{children}</div>
    </div>
  );
}

function ListRow({ line1, line2, right, badge, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between py-2.5 text-left hover:bg-beige-50 -mx-1 px-1 rounded-lg transition-colors">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink truncate">{line1}</div>
        <div className="text-[11px] text-stone truncate">{line2}</div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
        <span className="font-mono text-xs text-ink">{right}</span>
        {badge && <Badge text={badge.text} color={badge.color} bg={badge.bg} />}
      </div>
    </button>
  );
}

function Empty() {
  return <div className="text-stone text-sm py-4">Sem registos ainda.</div>;
}
