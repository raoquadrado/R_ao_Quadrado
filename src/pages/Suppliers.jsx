import { useState, useEffect } from "react";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { SUPPLIER_STATUS, tagColor } from "../lib/constants";
import { sugerirCodigoSequencial } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, FavoriteStar, TagBadge, TagSelect, useColumnFilters, FilterTh } from "../components/ui";

const empty = { codigo: "", nome: "", nif: "", localidade: "", redes_sociais: "", site: "", contacto: "", email: "", status: "Ativo", avaliacao: 0, notas: "", favorito: false, etiqueta: "" };

export default function Suppliers({ suppliers, autoOpenNew, onConsumedAutoOpen, autoOpenEditId, onConsumedAutoOpenEdit }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // { data, isNew }
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) { setModal({ data: { ...empty }, isNew: true }); onConsumedAutoOpen?.(); }
  }, [autoOpenNew]);

  useEffect(() => {
    if (autoOpenEditId) {
      const s = suppliers.find((x) => x.id === autoOpenEditId);
      if (s) setModal({ data: { ...s }, isNew: false });
      onConsumedAutoOpenEdit?.();
    }
  }, [autoOpenEditId, suppliers]);

  const rows = suppliers
    .filter((s) => (s.nome + s.nif + s.email + (s.localidade || "")).toLowerCase().includes(q.toLowerCase()));

  const filterCols = {
    etiqueta: (s) => (s.etiqueta ? (tagColor(s.etiqueta)?.label || s.etiqueta) : "Sem etiqueta"),
    localidade: (s) => s.localidade || "—",
    status: (s) => s.status || "—",
  };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(suppliers, filterCols);
  const filteredRows = applyFilters(rows).sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0));

  async function handleDelete(s) {
    const ok = await confirm({ title: "Eliminar fornecedor?", message: `"${s.nome}" vai para a Lixeira — podes restaurar mais tarde.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("suppliers", s.id);
    notify("Fornecedor eliminado.");
  }

  async function toggleFavorite(s) {
    await updateRow("suppliers", s.id, { favorito: !s.favorito });
  }

  return (
    <div>
      <TabHeader
        title="Fornecedores" sub={`${suppliers.length} fornecedor(es)`} btnLabel="Novo fornecedor"
        onNew={() => setModal({ data: { ...empty }, isNew: true })}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
      />
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por nome, NIF, email ou localidade…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th></th><th>Código</th><th>Nome</th><FilterTh label="Etiqueta" {...filterProps("etiqueta")} /><th>NIF</th>
              <FilterTh label="Localidade" {...filterProps("localidade")} /><th>Redes sociais</th><th>Site</th><th>Contacto</th><th>Email</th>
              <FilterTh label="Estado" {...filterProps("status")} /><th>Avaliação</th><th>Notas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={14} text="Sem fornecedores." />}
            {filteredRows.map((s) => (
              <tr key={s.id}>
                <td><FavoriteStar active={!!s.favorito} onClick={() => toggleFavorite(s)} /></td>
                <td className="font-mono text-xs text-stone">{s.codigo || "—"}</td>
                <td className="font-medium">{s.nome}</td>
                <td>{s.etiqueta ? <TagBadge value={s.etiqueta} /> : <span className="text-stone">—</span>}</td>
                <td className="font-mono text-xs">{s.nif || "—"}</td>
                <td className="text-stone">{s.localidade || "—"}</td>
                <td className="text-stone">{s.redes_sociais || "—"}</td>
                <td className="text-stone">{s.site || "—"}</td>
                <td>{s.contacto || "—"}</td>
                <td className="text-stone">{s.email || "—"}</td>
                <td>
                  <Badge
                    text={s.status}
                    color={s.status === "Ativo" ? "#254238" : s.status === "Inativo" ? "#7A2A24" : "#A67C1E"}
                    bg={s.status === "Ativo" ? "#DCEBE4" : s.status === "Inativo" ? "#F5D9D6" : "#F5EADD"}
                  />
                </td>
                <td className={(s.avaliacao || 0) === 0 ? "text-stone italic" : "text-rust-dark tracking-wide"}>
                  {(s.avaliacao || 0) === 0 ? "Não avaliado" : "★".repeat(s.avaliacao) + "☆".repeat(5 - s.avaliacao)}
                </td>
                <td className="text-stone max-w-[200px]" title={s.notas}>{s.notas || "—"}</td>
                <RowActions onEdit={() => setModal({ data: { ...s }, isNew: false })} onDelete={() => handleDelete(s)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <SupplierModal
          data={modal.data}
          isNew={modal.isNew}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            if (modal.isNew) await insertRow("suppliers", values);
            else await updateRow("suppliers", modal.data.id, values);
            notify(modal.isNew ? "Fornecedor adicionado." : "Fornecedor atualizado.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function SupplierModal({ data, isNew, suppliers, onClose, onSave }) {
  const [f, setF] = useState({ ...data, codigo: data.codigo || (isNew ? sugerirCodigoSequencial("FORN", suppliers, "codigo", data.id) : "") });
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <ModalShell title={isNew ? "Novo fornecedor" : "Editar fornecedor"} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Código (único, tipo SKU)">
          <div className="flex gap-1.5">
            <input className={`${inputCls} font-mono`} value={f.codigo} onChange={set("codigo")} placeholder="ex: FORN-001" />
            <Button type="button" onClick={() => setF({ ...f, codigo: sugerirCodigoSequencial("FORN", suppliers, "codigo", f.id) })}>🔄</Button>
          </div>
        </Field>
        <Field label="Nome"><input className={inputCls} value={f.nome} onChange={set("nome")} /></Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="NIF"><input className={inputCls} value={f.nif} onChange={set("nif")} /></Field>
        <Field label="Localidade"><input className={inputCls} value={f.localidade} onChange={set("localidade")} placeholder="Braga" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Redes sociais"><input className={inputCls} value={f.redes_sociais} onChange={set("redes_sociais")} placeholder="@utilizador" /></Field>
        <Field label="Site"><input className={inputCls} value={f.site} onChange={set("site")} placeholder="www.exemplo.pt" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Contacto"><input className={inputCls} value={f.contacto} onChange={set("contacto")} /></Field>
        <Field label="Email"><input className={inputCls} value={f.email} onChange={set("email")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Estado">
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {SUPPLIER_STATUS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Avaliação / satisfação">
          <select className={inputCls} value={f.avaliacao} onChange={(e) => setF({ ...f, avaliacao: parseInt(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n === 0 ? "Ainda não avaliado" : `${"★".repeat(n)}${"☆".repeat(5 - n)} (${n}/5)`}</option>
            ))}
          </select>
        </Field>
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
        <Field label="Notas"><textarea rows={3} className={inputCls} value={f.notas} onChange={set("notas")} /></Field>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={async () => {
          if (!f.nome.trim()) { setError("Indica o nome do fornecedor."); return; }
          const codigo = (f.codigo || "").trim();
          if (!codigo) { setError("Indica um código para o fornecedor."); return; }
          const duplicado = suppliers.some((s) => s.id !== f.id && (s.codigo || "").trim().toLowerCase() === codigo.toLowerCase());
          if (duplicado) { setError(`Já existe um fornecedor com o código "${codigo}" — escolhe outro.`); return; }
          return onSave({ ...f, codigo });
        }}
        label="Guardar fornecedor"
      />
    </ModalShell>
  );
}
