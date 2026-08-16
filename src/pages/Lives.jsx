import { useState, useEffect } from "react";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { CONTENT_NETWORKS, CONTENT_NETWORK_COLORS, LIVE_ESTADO_COLORS } from "../lib/constants";
import { money, fmtDate, todayISO, uid, displaySku, sugerirCodigoPorData } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, useColumnFilters, FilterTh } from "../components/ui";

const empty = (presetDate) => ({
  id: uid(), codigo: "", nome: "", data: presetDate || todayISO(), hora_inicio: "", hora_fim: "",
  redes_sociais: [], itens: [], estado: "Preparação", posicao_atual: 0,
});

export default function Lives({ lives, liveRegistos, articlesComputed, autoOpenNew, onConsumedAutoOpen, autoOpenEditId, onConsumedAutoOpenEdit, presetDate, onConsumedPresetDate, onOpenLive, onOpenAllWaitlist }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) {
      setModal({ data: empty(presetDate), isNew: true });
      onConsumedAutoOpen?.();
      if (presetDate) onConsumedPresetDate?.();
    }
  }, [autoOpenNew]);

  useEffect(() => {
    if (autoOpenEditId) {
      const l = lives.find((x) => x.id === autoOpenEditId);
      if (l) setModal({ data: { ...l }, isNew: false });
      onConsumedAutoOpenEdit?.();
    }
  }, [autoOpenEditId, lives]);

  const rows = lives.filter((l) => (l.nome + (l.codigo || "")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const filterCols = { estado: (l) => l.estado || "Preparação" };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(lives, filterCols);
  const filteredRows = applyFilters(rows);

  async function handleDelete(l) {
    const ok = await confirm({ title: "Eliminar direto?", message: `"${l.nome}" e os respetivos registos vão para a Lixeira.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("lives", l.id);
    notify("Direto eliminado.");
  }

  const totalEsperaPendente = liveRegistos.filter((r) => r.estado === "Lista de espera" && (r.estado_lista_espera || "Pendente") === "Pendente").length;

  return (
    <div>
      <TabHeader
        title="🎥 Diretos"
        sub="Preparar, correr e validar as vendas feitas em direto."
        btnLabel="Novo direto"
        onNew={() => setModal({ data: empty(), isNew: true })}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
      />
      {totalEsperaPendente > 0 && (
        <button
          type="button"
          onClick={onOpenAllWaitlist}
          className="mb-3 flex items-center gap-1.5 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-md px-3 py-2 hover:bg-purple-100"
        >
          📋 Ver toda a lista de espera ({totalEsperaPendente} pendente{totalEsperaPendente > 1 ? "s" : ""}, de todos os diretos)
        </button>
      )}
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por nome ou código…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Nome</th><th>Data</th><th>Hora</th><th>Redes</th><FilterTh label="Estado" {...filterProps("estado")} /><th>Registos</th><th>Lista de espera</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={9} text="Ainda não há diretos criados." />}
            {filteredRows.map((l) => {
              const ec = LIVE_ESTADO_COLORS[l.estado] || LIVE_ESTADO_COLORS["Preparação"];
              const nRegistos = liveRegistos.filter((r) => r.live_id === l.id).length;
              const nEspera = liveRegistos.filter((r) => r.live_id === l.id && r.estado === "Lista de espera" && (r.estado_lista_espera || "Pendente") === "Pendente").length;
              return (
                <tr key={l.id} className="cursor-pointer" onClick={() => onOpenLive(l.id)}>
                  <td className="font-mono text-xs text-stone">{l.codigo || "—"}</td>
                  <td className="font-medium">{l.nome || "(sem nome)"}</td>
                  <td className="font-mono text-xs text-stone">{fmtDate(l.data)}</td>
                  <td className="font-mono text-xs text-stone">{l.hora_inicio || "—"}{l.hora_fim ? ` – ${l.hora_fim}` : ""}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {(l.redes_sociais || []).map((r) => {
                        const nc = CONTENT_NETWORK_COLORS[r] || { color: "#8A8677", bg: "#F1EDE3" };
                        return <Badge key={r} text={r} color={nc.color} bg={nc.bg} />;
                      })}
                      {(!l.redes_sociais || l.redes_sociais.length === 0) && "—"}
                    </div>
                  </td>
                  <td><Badge text={l.estado} color={ec.color} bg={ec.bg} /></td>
                  <td className="font-mono text-stone">{nRegistos}</td>
                  <td className="font-mono">
                    {nEspera > 0 ? <span className="text-purple-600 font-medium">{nEspera}</span> : <span className="text-stone">—</span>}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <RowActions onEdit={() => setModal({ data: { ...l }, isNew: false })} onDelete={() => handleDelete(l)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <LiveModal
          data={modal.data}
          isNew={modal.isNew}
          articlesComputed={articlesComputed}
          lives={lives}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            if (modal.isNew) await insertRow("lives", values);
            else await updateRow("lives", modal.data.id, values);
            notify(modal.isNew ? "Direto criado." : "Direto atualizado.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function LiveModal({ data, isNew, articlesComputed, lives, onClose, onSave }) {
  const [f, setF] = useState({ ...data, itens: data.itens || [], redes_sociais: data.redes_sociais || [], codigo: data.codigo || (isNew ? sugerirCodigoPorData("LIVE", data.data, lives, "codigo", data.id) : "") });
  const [builderIds, setBuilderIds] = useState([]);
  const [builderNome, setBuilderNome] = useState("");
  const [builderBusca, setBuilderBusca] = useState("");
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const disponiveis = articlesComputed.filter((a) => a.stockAtual > 0);
  const filtrados = builderBusca.trim()
    ? disponiveis.filter((a) => (a.sku || "").toLowerCase().includes(builderBusca.trim().toLowerCase()) || a.artigo.toLowerCase().includes(builderBusca.trim().toLowerCase()))
    : disponiveis;

  function toggleRede(r) {
    setF((p) => ({ ...p, redes_sociais: p.redes_sociais.includes(r) ? p.redes_sociais.filter((x) => x !== r) : [...p.redes_sociais, r] }));
  }
  function toggleBuilder(id) {
    setBuilderIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  function selecionarTodosFiltrados() {
    setBuilderIds((p) => [...new Set([...p, ...filtrados.map((a) => a.id)])]);
    if (!builderNome.trim() && filtrados.length) setBuilderNome(filtrados[0].artigo);
  }
  function addItem(modo) {
    if (builderIds.length === 0) return;
    if (modo === "conjunto" && builderIds.length > 1) {
      setF((p) => ({ ...p, itens: [...p.itens, { id: uid(), tipo: "conjunto", article_ids: builderIds, nome: builderNome || "Conjunto", preco_direto: 0 }] }));
    } else {
      const novos = builderIds.map((aid) => ({ id: uid(), tipo: "artigo", article_ids: [aid], nome: "", preco_direto: 0 }));
      setF((p) => ({ ...p, itens: [...p.itens, ...novos] }));
    }
    setBuilderIds([]); setBuilderNome("");
  }
  function removeItem(id) { setF((p) => ({ ...p, itens: p.itens.filter((i) => i.id !== id) })); }
  function moveItem(id, dir) {
    setF((p) => {
      const idx = p.itens.findIndex((i) => i.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= p.itens.length) return p;
      const next = [...p.itens];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...p, itens: next };
    });
  }
  function setItemPreco(id, valor) {
    setF((p) => ({ ...p, itens: p.itens.map((i) => i.id === id ? { ...i, preco_direto: Number(valor) || 0 } : i) }));
  }

  return (
    <ModalShell title={isNew ? "Preparar direto" : "Editar direto"} subtitle="Nome, horário, redes sociais e os artigos/conjuntos a mostrar, por ordem." onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Código do direto (único, tipo SKU)">
          <div className="flex gap-1.5">
            <input className={`${inputCls} font-mono`} value={f.codigo} onChange={set("codigo")} placeholder="ex: LIVE-20260815" />
            <Button type="button" onClick={() => setF({ ...f, codigo: sugerirCodigoPorData("LIVE", f.data, lives, "codigo", f.id) })}>🔄</Button>
          </div>
        </Field>
        <Field label="Nome do direto"><input className={inputCls} value={f.nome} onChange={set("nome")} placeholder="ex: Direto de sábado — roupa de inverno" /></Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Data"><input type="date" className={inputCls} value={f.data} onChange={set("data")} /></Field>
        <Field label="Hora início"><input type="time" className={inputCls} value={f.hora_inicio} onChange={set("hora_inicio")} /></Field>
        <Field label="Hora fim"><input type="time" className={inputCls} value={f.hora_fim} onChange={set("hora_fim")} /></Field>
      </div>
      <Field label="Redes sociais (podes selecionar mais do que uma)">
        <div className="flex gap-2 mt-0.5 mb-3">
          {CONTENT_NETWORKS.map((r) => {
            const active = f.redes_sociais.includes(r);
            const nc = CONTENT_NETWORK_COLORS[r];
            return (
              <button key={r} type="button" onClick={() => toggleRede(r)}
                className="px-3 py-1.5 rounded-md text-xs font-medium"
                style={{ border: active ? `1px solid ${nc.color}` : "1px solid #E3DED2", background: active ? nc.bg : "#fff", color: active ? nc.color : "#8A8677" }}>
                {r}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="mt-4 pt-3.5 border-t border-line">
        <div className="text-xs font-semibold mb-2">Artigos e conjuntos a mostrar</div>
        {f.itens.length === 0 && <div className="text-stone text-xs mb-2.5">Ainda não adicionaste nenhum artigo ou conjunto.</div>}
        {f.itens.map((item, idx) => (
          <div key={item.id} className="bg-white border border-line rounded-md mb-1.5 p-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-stone w-4">{idx + 1}º</span>
              <span className="flex-1 text-sm">
                {item.tipo === "conjunto"
                  ? `📦 ${item.nome} (${item.article_ids.length} peças)`
                  : (() => {
                      const a = articlesComputed.find((x) => x.id === item.article_ids[0]);
                      return a ? `👕 ${displaySku(a)} — ${a.artigo}` : "👕 —";
                    })()}
              </span>
              <input type="number" step="0.01" min="0" className={`${inputCls} w-24 py-1`} value={item.preco_direto} onChange={(e) => setItemPreco(item.id, e.target.value)} />
              <button type="button" onClick={() => moveItem(item.id, -1)} disabled={idx === 0} className="disabled:opacity-30">▲</button>
              <button type="button" onClick={() => moveItem(item.id, 1)} disabled={idx === f.itens.length - 1} className="disabled:opacity-30">▼</button>
              <button type="button" onClick={() => removeItem(item.id)} className="text-clay-dark">✕</button>
            </div>
            {item.tipo === "conjunto" && (
              <div className="ml-6 mt-1 flex flex-wrap gap-1">
                {item.article_ids.map((aid) => {
                  const a = articlesComputed.find((x) => x.id === aid);
                  return a ? <span key={aid} className="text-[11px] text-stone bg-paper rounded px-1.5 py-0.5">{displaySku(a)} — {a.artigo}</span> : null;
                })}
              </div>
            )}
          </div>
        ))}

        <div className="bg-paper border border-dashed border-line rounded-md p-2.5 mt-2">
          <div className="flex gap-1.5 mb-2">
            <input className={`${inputCls} flex-1`} placeholder="🔎 Pesquisar por SKU base (ex: CAS-001) ou nome…" value={builderBusca} onChange={(e) => setBuilderBusca(e.target.value)} />
            {builderBusca.trim() && (
              <Button onClick={selecionarTodosFiltrados} disabled={filtrados.length === 0}>Selecionar todos os {filtrados.length}</Button>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto border border-line rounded-md bg-white mb-2">
            {filtrados.length === 0 && <div className="p-2.5 text-xs text-stone">Sem artigos com stock para esta pesquisa.</div>}
            {filtrados.map((a) => (
              <label key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs border-b border-line cursor-pointer last:border-0">
                <input type="checkbox" checked={builderIds.includes(a.id)} onChange={() => toggleBuilder(a.id)} />
                {displaySku(a)} — {a.artigo}
                <span className="text-stone ml-auto font-mono whitespace-nowrap">stock: {a.stockAtual} · preço atual: {money(a.valor_venda)}</span>
              </label>
            ))}
          </div>
          {builderIds.length > 1 && (
            <input className={`${inputCls} mb-2`} placeholder="Nome do conjunto (ex: Lote de verão)" value={builderNome} onChange={(e) => setBuilderNome(e.target.value)} />
          )}
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" onClick={() => addItem("separado")} disabled={builderIds.length === 0}>+ Adicionar em separado</Button>
            {builderIds.length > 1 && <Button onClick={() => addItem("conjunto")}>📦 Agrupar como conjunto</Button>}
          </div>
          <p className="text-stone text-[11px] mt-1.5">"Adicionar em separado" cria um item por peça; "Agrupar como conjunto" cria um único item — no direto podes vender só uma peça de dentro. O preço de direto define-se depois, junto de cada item.</p>
        </div>
      </div>

      <div className="mt-4">
        <ModalActions
          onClose={onClose}
          onSave={async () => {
            if (!f.nome.trim()) { setError("Indica o nome do direto."); return; }
            const codigo = (f.codigo || "").trim();
            if (!codigo) { setError("Indica um código para o direto."); return; }
            const duplicado = lives.some((l) => l.id !== f.id && (l.codigo || "").trim().toLowerCase() === codigo.toLowerCase());
            if (duplicado) { setError(`Já existe um direto com o código "${codigo}" — escolhe outro.`); return; }
            return onSave({ ...f, codigo });
          }}
          label={isNew ? "Criar direto" : "Guardar"}
          disabled={!f.nome}
        />
      </div>
    </ModalShell>
  );
}
