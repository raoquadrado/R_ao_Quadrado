import { useState, useEffect } from "react";
import { saveContentItem } from "../lib/contentHelpers";
import { CONTENT_STATUS_COLORS, CONTENT_TIPO_COLORS, LIVE_ESTADO_COLORS } from "../lib/constants";
import { displaySku, todayISO } from "../lib/computations";
import { feriadoDoDia, diasEspeciaisDoDia } from "../lib/specialDays";
import { useToast } from "../lib/overlays";
import { Button, ModalShell, Badge } from "../components/ui";
import { empty as emptyContent, ContentModal } from "./Content";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LONGO = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function pad(n) { return String(n).padStart(2, "0"); }
function isoOf(ano, mes, dia) { return `${ano}-${pad(mes + 1)}-${pad(dia)}`; }

// Gera as células do mês (6 semanas fixas, para a grelha não "saltar" de altura entre meses),
// incluindo os dias do mês anterior/seguinte para preencher a primeira/última semana.
function gerarCelulas(ano, mes) {
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 = domingo
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const diasMesAnterior = new Date(ano, mes, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const dia = diasMesAnterior - primeiroDiaSemana + 1 + i;
    celulas.push({ dia, foraDoMes: true, iso: isoOf(mes === 0 ? ano - 1 : ano, mes === 0 ? 11 : mes - 1, dia) });
  }
  for (let dia = 1; dia <= diasNoMes; dia++) {
    celulas.push({ dia, foraDoMes: false, iso: isoOf(ano, mes, dia) });
  }
  while (celulas.length % 7 !== 0 || celulas.length < 42) {
    const ultimaIso = celulas[celulas.length - 1].iso;
    const d = new Date(`${ultimaIso}T00:00:00`);
    d.setDate(d.getDate() + 1);
    celulas.push({ dia: d.getDate(), foraDoMes: true, iso: d.toISOString().slice(0, 10) });
    if (celulas.length >= 42) break;
  }
  return celulas;
}

export default function Calendar({ contentItems, articles, articleName, lives, onOpenLive, onNewLive, tasks, onOpenTasks, initialDate, onConsumedInitialDate }) {
  const hoje = new Date();
  const inicial = initialDate ? new Date(`${initialDate}T00:00:00`) : hoje;
  const [ano, setAno] = useState(inicial.getFullYear());
  const [mes, setMes] = useState(inicial.getMonth()); // 0-11
  const [modal, setModal] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const notify = useToast();

  useEffect(() => {
    if (initialDate) {
      const d = new Date(`${initialDate}T00:00:00`);
      setAno(d.getFullYear());
      setMes(d.getMonth());
      onConsumedInitialDate?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate]);

  function mudarMes(delta) {
    let novoMes = mes + delta, novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno -= 1; }
    if (novoMes > 11) { novoMes = 0; novoAno += 1; }
    setMes(novoMes); setAno(novoAno);
  }
  function irParaHoje() { setAno(hoje.getFullYear()); setMes(hoje.getMonth()); }

  const celulas = gerarCelulas(ano, mes);
  const itensPorDia = {};
  contentItems.forEach((c) => {
    if (!c.data_publicacao) return;
    (itensPorDia[c.data_publicacao] ||= []).push(c);
  });
  const livesPorDia = {};
  (lives || []).forEach((l) => {
    if (!l.data) return;
    (livesPorDia[l.data] ||= []).push(l);
  });
  const tarefasPorDia = {};
  (tasks || []).forEach((t) => {
    if (!t.prazo || t.estado === "Concluída") return;
    (tarefasPorDia[t.prazo] ||= []).push(t);
  });

  function abrirNovo(iso, isGeneral) {
    setModal({ data: { ...emptyContent(articles, null, isGeneral), data_publicacao: iso }, isNew: true });
  }
  function abrirEditar(c) {
    setModal({ data: { ...c, isGeneral: !c.article_id }, isNew: false });
  }
  async function handleSave(values) {
    await saveContentItem(values, modal.isNew, modal.data.id);
    notify(modal.isNew ? "Publicação agendada." : "Publicação atualizada.");
    setModal(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-0.5">📅 Calendário</h1>
          <p className="text-stone text-sm">Publicações agendadas, feriados e dias especiais — ligado ao Centro de Conteúdo nos dois sentidos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => mudarMes(-1)}>← Mês anterior</Button>
          <Button variant="default" onClick={irParaHoje}>Hoje</Button>
          <Button variant="ghost" onClick={() => mudarMes(1)}>Mês seguinte →</Button>
        </div>
      </div>
      <h2 className="font-display text-lg font-semibold text-ink mb-3 capitalize">{MESES[mes]} {ano}</h2>

      <div className="grid grid-cols-7 gap-px bg-line rounded-xl overflow-hidden border border-line">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="bg-paper text-center text-[11px] font-semibold text-stone uppercase tracking-wide py-2">{d}</div>
        ))}
        {celulas.map((cel, i) => {
          const itens = itensPorDia[cel.iso] || [];
          const feriado = feriadoDoDia(cel.iso);
          const especiais = diasEspeciaisDoDia(cel.iso);
          const isHoje = cel.iso === todayISO();
          return (
            <div key={i} className={`bg-white min-h-[110px] p-1.5 flex flex-col gap-1 ${cel.foraDoMes ? "opacity-40" : ""}`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDiaSelecionado(cel.iso)}
                  title="Ver detalhe do dia"
                  className={`text-xs font-mono cursor-pointer ${isHoje ? "bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold" : "text-stone hover:text-purple-600 hover:underline"}`}
                >
                  {cel.dia}
                </button>
                <div className="flex gap-1">
                  <button type="button" onClick={() => onNewLive?.(cel.iso)} title="Novo direto" className="text-[10px] text-stone hover:text-purple-600">🎥+</button>
                  <button type="button" onClick={() => abrirNovo(cel.iso, false)} title="Nova publicação de artigo" className="text-[10px] text-stone hover:text-purple-600">📱+</button>
                  <button type="button" onClick={() => abrirNovo(cel.iso, true)} title="Novo conteúdo geral" className="text-[10px] text-stone hover:text-purple-600">🗂️+</button>
                </div>
              </div>
              {feriado && (
                <div className="text-[9.5px] font-medium truncate" style={{ color: feriado.tipo === "nacional" ? "#A67C1E" : "#2B7A9E" }} title={feriado.nome}>
                  {feriado.tipo === "nacional" ? "🎉" : "🏛️"} {feriado.nome}
                </div>
              )}
              {especiais.length > 0 && (
                <div className="text-[9.5px] text-stone truncate" title={especiais.join(" · ")}>✨ {especiais[0]}{especiais.length > 1 ? ` +${especiais.length - 1}` : ""}</div>
              )}
              {(livesPorDia[cel.iso] || []).map((l) => {
                const lc = LIVE_ESTADO_COLORS[l.estado] || LIVE_ESTADO_COLORS["Preparação"];
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onOpenLive?.(l.id)}
                    title={`${l.nome}${l.hora_inicio ? ` · ${l.hora_inicio}` : ""}`}
                    className="text-[10px] font-medium rounded px-1.5 py-0.5 text-left truncate"
                    style={{ color: lc.color, background: lc.bg }}
                  >
                    🎥 {l.hora_inicio ? `${l.hora_inicio} · ` : ""}{l.nome || "Direto"}
                  </button>
                );
              })}
              {itens.map((c) => {
                const sc = CONTENT_STATUS_COLORS[c.estado] || CONTENT_STATUS_COLORS["Por fotografar"];
                const tc = c.tipo ? CONTENT_TIPO_COLORS[c.tipo] : null;
                const nome = c.article_id
                  ? (() => { const a = articles.find((x) => x.id === c.article_id); return a && displaySku(a) ? `${displaySku(a)} — ${a.artigo}` : articleName(c.article_id); })()
                  : (c.titulo || "(sem título)");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => abrirEditar(c)}
                    title={nome}
                    className="text-[10px] font-medium rounded px-1.5 py-0.5 text-left truncate"
                    style={{ color: sc.color, background: sc.bg, borderLeft: tc ? `3px solid ${tc.color}` : undefined }}
                  >
                    {c.article_id ? "📱" : "🗂️"} {nome}
                  </button>
                );
              })}
              {(tarefasPorDia[cel.iso] || []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTasks?.()}
                  title={t.titulo}
                  className="text-[10px] font-medium rounded px-1.5 py-0.5 text-left truncate"
                  style={{ color: "#7A2A24", background: "#F5D9D6" }}
                >
                  ✅ {t.titulo}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 flex-wrap text-[11px] text-stone">
        <span>🎉 Feriado nacional</span>
        <span>🏛️ Feriado municipal</span>
        <span>✨ Dia especial</span>
        <span>🎥 Direto</span>
        <span>📱 Publicação de artigo</span>
        <span>🗂️ Conteúdo geral</span>
        <span>✅ Tarefa com prazo</span>
      </div>

      {modal && (
        <ContentModal
          data={modal.data}
          isNew={modal.isNew}
          articles={articles}
          contentItems={contentItems}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {diaSelecionado && (
        <DayDetailModal
          iso={diaSelecionado}
          lives={livesPorDia[diaSelecionado] || []}
          itens={itensPorDia[diaSelecionado] || []}
          tarefas={tarefasPorDia[diaSelecionado] || []}
          articles={articles}
          articleName={articleName}
          onClose={() => setDiaSelecionado(null)}
          onOpenLive={onOpenLive}
          onNewLive={onNewLive}
          onEditContent={abrirEditar}
          onNewContent={abrirNovo}
          onOpenTasks={onOpenTasks}
        />
      )}
    </div>
  );
}

function DayDetailModal({ iso, lives, itens, tarefas, articles, articleName, onClose, onOpenLive, onNewLive, onEditContent, onNewContent, onOpenTasks }) {
  const d = new Date(`${iso}T00:00:00`);
  const feriado = feriadoDoDia(iso);
  const especiais = diasEspeciaisDoDia(iso);
  const isHoje = iso === todayISO();

  return (
    <ModalShell
      title={`${DIAS_SEMANA_LONGO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}${isHoje ? " · Hoje" : ""}`}
      onClose={onClose}
      wide
    >
      {(feriado || especiais.length > 0) && (
        <div className="mb-4 flex flex-col gap-1">
          {feriado && (
            <div className="text-sm font-medium" style={{ color: feriado.tipo === "nacional" ? "#A67C1E" : "#2B7A9E" }}>
              {feriado.tipo === "nacional" ? "🎉" : "🏛️"} {feriado.nome}
            </div>
          )}
          {especiais.length > 0 && <div className="text-sm text-stone">✨ {especiais.join(" · ")}</div>}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <Button onClick={() => { onNewLive?.(iso); onClose(); }}>🎥+ Novo direto</Button>
        <Button onClick={() => { onNewContent?.(iso, false); onClose(); }}>📱+ Nova publicação</Button>
        <Button onClick={() => { onNewContent?.(iso, true); onClose(); }}>🗂️+ Conteúdo geral</Button>
      </div>

      <div className="mb-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">🎥 Diretos ({lives.length})</h3>
        {lives.length === 0 ? (
          <p className="text-stone text-sm">Nenhum direto agendado para este dia.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lives.map((l) => {
              const lc = LIVE_ESTADO_COLORS[l.estado] || LIVE_ESTADO_COLORS["Preparação"];
              return (
                <button key={l.id} type="button" onClick={() => { onOpenLive?.(l.id); onClose(); }} className="text-left rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: lc.bg }}>
                  <span className="font-medium" style={{ color: lc.color }}>{l.nome || "Direto"}{l.hora_inicio ? ` · ${l.hora_inicio}` : ""}</span>
                  <Badge text={l.estado} color={lc.color} bg="transparent" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">📱 Publicações ({itens.length})</h3>
        {itens.length === 0 ? (
          <p className="text-stone text-sm">Nenhuma publicação agendada para este dia.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {itens.map((c) => {
              const sc = CONTENT_STATUS_COLORS[c.estado] || CONTENT_STATUS_COLORS["Por fotografar"];
              const nome = c.article_id
                ? (() => { const a = articles.find((x) => x.id === c.article_id); return a && displaySku(a) ? `${displaySku(a)} — ${a.artigo}` : articleName(c.article_id); })()
                : (c.titulo || "(sem título)");
              return (
                <button key={c.id} type="button" onClick={() => { onEditContent?.(c); onClose(); }} className="text-left rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: sc.bg }}>
                  <span className="font-medium" style={{ color: sc.color }}>{c.article_id ? "📱" : "🗂️"} {nome}</span>
                  <Badge text={c.estado} color={sc.color} bg="transparent" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">✅ Tarefas com prazo ({tarefas.length})</h3>
        {tarefas.length === 0 ? (
          <p className="text-stone text-sm">Nenhuma tarefa com prazo neste dia.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tarefas.map((t) => (
              <button key={t.id} type="button" onClick={() => { onOpenTasks?.(); onClose(); }} className="text-left rounded-lg px-3 py-2" style={{ background: "#F5D9D6" }}>
                <span className="font-medium" style={{ color: "#7A2A24" }}>✅ {t.titulo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
