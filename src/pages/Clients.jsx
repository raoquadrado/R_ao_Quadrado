import { useState, useEffect } from "react";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { SOCIAL_PLATFORM_OPTIONS, CLIENT_STATUS_COLORS, tagColor } from "../lib/constants";
import { money, fmtDate, todayISO } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, FavoriteStar, TagBadge, TagSelect, useColumnFilters, FilterTh } from "../components/ui";

const emptyClient = (pontosBoasVindas) => ({
  nome: "", plataforma: "Instagram", rede_social: "", nif: "", morada_faturacao: "", morada_entrega: "",
  email: "", telefone: "", aniversario: "", avaliacao: 0,
  codigo_desconto: "", data_inicio_desconto: "", data_fim_desconto: "", desconto_utilizado: false,
  notas: "", favorito: false, etiqueta: "", pontos_bonus: pontosBoasVindas ?? 50,
});

function discountStatus(c) {
  if (!c.codigo_desconto) return null;
  if (c.desconto_utilizado) return { text: "Utilizado", color: "#254238", bg: "#DCEBE4" };
  if (c.data_fim_desconto && c.data_fim_desconto < todayISO()) return { text: "Expirado", color: "#7A2A24", bg: "#F5D9D6" };
  return { text: "Ativo", color: "#832F72", bg: "#F7E3F2" };
}

export default function Clients({ clientsComputed, onOpenDetail, autoOpenNew, onConsumedAutoOpen, autoOpenEditId, onConsumedAutoOpenEdit, settings }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) { setModal({ data: emptyClient(settings?.pontos_boas_vindas), isNew: true }); onConsumedAutoOpen?.(); }
  }, [autoOpenNew]);

  useEffect(() => {
    if (autoOpenEditId) {
      const c = clientsComputed.find((x) => x.id === autoOpenEditId);
      if (c) setModal({ data: { ...c }, isNew: false });
      onConsumedAutoOpenEdit?.();
    }
  }, [autoOpenEditId, clientsComputed]);

  const rows = clientsComputed
    .filter((c) =>
      (c.nome + (c.email || "") + (c.telefone || "") + (c.plataforma || "") + (c.rede_social || "") + (c.codigo_desconto || "")).toLowerCase().includes(q.toLowerCase())
    );

  const filterCols = {
    etiqueta: (c) => (c.etiqueta ? (tagColor(c.etiqueta)?.label || c.etiqueta) : "Sem etiqueta"),
    estado: (c) => c.estadoCliente || "Sem compras",
    plataforma: (c) => c.plataforma || "—",
    faixaPontos: (c) => c.faixaPontos,
  };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(clientsComputed, filterCols);
  const filteredRows = applyFilters(rows).sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0));

  async function handleDelete(c) {
    const ok = await confirm({ title: "Eliminar cliente?", message: `"${c.nome}" vai para a Lixeira — podes restaurar mais tarde.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("clients", c.id);
    notify("Cliente eliminado.");
  }

  async function toggleFavorite(c) {
    await updateRow("clients", c.id, { favorito: !c.favorito });
  }

  return (
    <div>
      <TabHeader
        title="Clientes" sub={`${clientsComputed.length} cliente(s)`} btnLabel="Novo cliente"
        onNew={() => setModal({ data: emptyClient(settings?.pontos_boas_vindas), isNew: true })}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
      />
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por nome, email, telefone, rede social ou código de desconto…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th></th><th>Nome</th><FilterTh label="Etiqueta" {...filterProps("etiqueta")} /><FilterTh label="Estado" {...filterProps("estado")} />
              <FilterTh label="Pontos" {...filterProps("faixaPontos")} /><FilterTh label="Rede social" {...filterProps("plataforma")} /><th>Telefone</th><th>Email</th><th>Aniversário</th><th>Satisfação Cliente</th>
              <th>Última compra concluída</th><th>Reservas por pagar</th><th>Total gasto</th><th>Total (últ. ano)</th><th>Desconto</th><th>Notas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={17} text="Sem clientes." />}
            {filteredRows.map((c) => {
              const ds = discountStatus(c);
              const sc = c.estadoCliente ? CLIENT_STATUS_COLORS[c.estadoCliente] : null;
              return (
                <tr key={c.id}>
                  <td><FavoriteStar active={!!c.favorito} onClick={() => toggleFavorite(c)} /></td>
                  <td className="font-medium">
                    <button type="button" onClick={() => onOpenDetail?.(c.id)} className="font-medium text-ink underline decoration-line hover:decoration-rust text-left">
                      {c.nome}
                    </button>
                  </td>
                  <td>{c.etiqueta ? <TagBadge value={c.etiqueta} /> : <span className="text-stone">—</span>}</td>
                  <td>{sc ? <Badge text={c.estadoCliente} color={sc.color} bg={sc.bg} /> : <span className="text-stone">—</span>}</td>
                  <td className={`font-mono text-xs font-medium ${c.pontos < 0 ? "text-clay-dark" : "text-ink"}`}>{c.pontos}</td>
                  <td className="text-stone">{c.plataforma ? `${c.plataforma}${c.rede_social ? " · " + c.rede_social : ""}` : (c.rede_social || "—")}</td>
                  <td>{c.telefone || "—"}</td>
                  <td className="text-stone">{c.email || "—"}</td>
                  <td className="font-mono text-xs text-stone">{c.aniversario ? fmtDate(c.aniversario) : "—"}</td>
                  <td className={(c.avaliacao || 0) === 0 ? "text-stone italic" : "text-rust-dark tracking-wide"}>
                    {(c.avaliacao || 0) === 0 ? "Não avaliado" : "★".repeat(c.avaliacao) + "☆".repeat(5 - c.avaliacao)}
                  </td>
                  <td className="font-mono text-xs text-stone">{c.dataUltimaCompra ? fmtDate(c.dataUltimaCompra) : "—"}</td>
                  <td className={`font-mono text-xs ${c.nReservasPendentes > 0 ? "text-clay-dark font-medium" : "text-stone"}`}>{c.nReservasPendentes || 0}</td>
                  <td className="font-mono text-xs font-medium">{money(c.totalGasto)}</td>
                  <td className="font-mono text-xs">{money(c.totalGastoAno)}</td>
                  <td>
                    {ds ? (
                      <div className="flex items-center gap-1.5">
                        <Badge text={ds.text} color={ds.color} bg={ds.bg} />
                        <span className="font-mono text-[11px] text-stone">{c.codigo_desconto}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="text-stone max-w-[160px]" title={c.notas}>{c.notas || "—"}</td>
                  <RowActions onEdit={() => setModal({ data: { ...c }, isNew: false })} onDelete={() => handleDelete(c)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ClientModal
          data={modal.data}
          isNew={modal.isNew}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            const {
              dataUltimaCompra, dataPrimeiraCompra, totalGasto, totalGastoAno, nCompras,
              nReservasPendentes, nNaoPagas, totalNaoPago, pontos, pontosBonus, compraRecente, estadoCliente, faixaPontos,
              ...clean
            } = values;
            if (modal.isNew) await insertRow("clients", clean);
            else await updateRow("clients", modal.data.id, clean);
            notify(modal.isNew ? "Cliente adicionado." : "Cliente atualizado.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function ClientModal({ data, isNew, onClose, onSave }) {
  const [f, setF] = useState(data);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const stats = !isNew
    ? `Estado: ${data.estadoCliente || "sem compras"} · Pontos: ${data.pontos ?? 0} (bónus: ${data.pontos_bonus ?? 0}) · Total gasto: ${money(data.totalGasto || 0)} · Último ano: ${money(data.totalGastoAno || 0)} · Última compra concluída: ${data.dataUltimaCompra ? fmtDate(data.dataUltimaCompra) : "—"}`
    : "Começa com 50 pontos de bónus de boas-vindas — podes ajustar abaixo, se quiseres.";

  return (
    <ModalShell title={isNew ? "Novo cliente" : "Editar cliente"} subtitle={stats} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Nome"><input className={inputCls} value={f.nome} onChange={set("nome")} /></Field>
        <Field label="Plataforma (rede social)">
          <select className={inputCls} value={f.plataforma} onChange={set("plataforma")}>{SOCIAL_PLATFORM_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="mb-3">
        <Field label="Utilizador / rede social" span><input className={inputCls} value={f.rede_social} onChange={set("rede_social")} placeholder="@utilizador" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="NIF"><input className={inputCls} value={f.nif} onChange={set("nif")} /></Field>
        <Field label="Telefone"><input className={inputCls} value={f.telefone} onChange={set("telefone")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Morada de faturação"><input className={inputCls} value={f.morada_faturacao} onChange={set("morada_faturacao")} /></Field>
        <Field label="Morada de entrega"><input className={inputCls} value={f.morada_entrega} onChange={set("morada_entrega")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Email"><input className={inputCls} value={f.email} onChange={set("email")} /></Field>
        <Field label="Aniversário"><input type="date" className={inputCls} value={f.aniversario || ""} onChange={set("aniversario")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Etiqueta"><TagSelect value={f.etiqueta} onChange={(v) => setF({ ...f, etiqueta: v })} /></Field>
        <Field label="Favorito">
          <div className="flex items-center gap-2 h-[38px]">
            <FavoriteStar active={!!f.favorito} onClick={() => setF({ ...f, favorito: !f.favorito })} size="text-xl" />
            <span className="text-sm text-ink">{f.favorito ? "Nos favoritos" : "Marcar como favorito"}</span>
          </div>
        </Field>
      </div>
      <div className="mb-5">
        <Field label="Satisfação do cliente" span>
          <select className={inputCls} value={f.avaliacao} onChange={(e) => setF({ ...f, avaliacao: parseInt(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n === 0 ? "Ainda não avaliado" : `${"★".repeat(n)}${"☆".repeat(5 - n)} (${n}/5)`}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mb-5">
        <Field label="Pontos de bónus" span>
          <input type="number" step="1" className={inputCls} value={f.pontos_bonus ?? 0} onChange={(e) => setF({ ...f, pontos_bonus: parseInt(e.target.value) || 0 })} />
        </Field>
      </div>

      <h3 className="font-display text-sm font-semibold text-ink mb-3">Desconto</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Código de desconto"><input className={inputCls} value={f.codigo_desconto || ""} onChange={set("codigo_desconto")} placeholder="ex: BEMVINDA10" /></Field>
        <Field label="Desconto utilizado">
          <div className="flex items-center gap-2 h-[38px]">
            <input type="checkbox" id="descontoUtilizado" checked={!!f.desconto_utilizado} onChange={(e) => setF({ ...f, desconto_utilizado: e.target.checked })} className="w-4 h-4" />
            <label htmlFor="descontoUtilizado" className="text-sm text-ink">Já foi utilizado</label>
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <Field label="Data início do desconto"><input type="date" className={inputCls} value={f.data_inicio_desconto || ""} onChange={set("data_inicio_desconto")} /></Field>
        <Field label="Data fim do desconto"><input type="date" className={inputCls} value={f.data_fim_desconto || ""} onChange={set("data_fim_desconto")} /></Field>
      </div>

      <div className="mb-5">
        <Field label="Notas"><textarea rows={3} className={inputCls} value={f.notas} onChange={set("notas")} /></Field>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={async () => { if (!f.nome.trim()) { setError("Indica o nome do cliente."); return; } return onSave(f); }}
        label="Guardar cliente"
      />
    </ModalShell>
  );
}
