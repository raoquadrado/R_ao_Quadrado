import { useState, useEffect } from "react";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { uploadDocument, deleteDocument } from "../lib/fileStorage";
import { OWNERS, PURCHASE_STATUS } from "../lib/constants";
import { money, fmtDate, todayISO, uid, sugerirCodigoPorData } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, useColumnFilters, FilterTh } from "../components/ui";

const empty = (suppliers) => ({
  id: uid(), codigo: "", supplier_id: suppliers[0]?.id || "", valor_aquisicao: 0, desconto: 0,
  estado: "Reservado", data_envio: "", data_chegada: "", codigo_rastreio: "",
  fatura: "", fatura_url: "", quem_comprou: "Rosa", data: todayISO(), notas: "",
});

const statusColor = (estado) => {
  if (estado === "Concluída") return { color: "#254238", bg: "#DCEBE4" };
  if (estado === "Enviado") return { color: "#832F72", bg: "#F7E3F2" };
  return { color: "#A67C1E", bg: "#F5EADD" };
};

export default function Purchases({ purchases, suppliers, supplierName, autoOpenNew, onConsumedAutoOpen }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (autoOpenNew) { setModal({ data: empty(suppliers), isNew: true }); onConsumedAutoOpen?.(); }
  }, [autoOpenNew]);

  const rows = purchases.filter((p) => (supplierName(p.supplier_id) + (p.fatura || "") + (p.codigo_rastreio || "")).toLowerCase().includes(q.toLowerCase()));
  const total = rows.reduce((s, p) => s + (Number(p.valor_aquisicao || 0) - Number(p.desconto || 0)), 0);

  const filterCols = {
    fornecedor: (p) => supplierName(p.supplier_id),
    estado: (p) => p.estado || "Reservado",
    comprou: (p) => p.quem_comprou || "—",
  };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(purchases, filterCols);
  const filteredRows = applyFilters(rows);

  async function handleDelete(p) {
    const ok = await confirm({ title: "Eliminar compra?", message: `A compra a "${supplierName(p.supplier_id)}" vai para a Lixeira.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("purchases", p.id);
    notify("Compra eliminada.");
  }

  return (
    <div>
      <TabHeader
        title="Compras"
        sub={`${purchases.length} registo(s) · total ${money(total)}`}
        btnLabel="Registar compra"
        onNew={() => setModal({ data: empty(suppliers), isNew: true })}
        disabled={suppliers.length === 0}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
      />
      {suppliers.length === 0 && <p className="text-clay-dark text-xs -mt-2 mb-3">Cria primeiro um fornecedor.</p>}
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por fornecedor, fatura ou código de rastreio…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Data</th><FilterTh label="Fornecedor" {...filterProps("fornecedor")} /><th>Total</th>
              <FilterTh label="Estado" {...filterProps("estado")} /><th>Rastreio</th>
              <th>Envio</th><th>Chegada</th><th>Fatura</th><FilterTh label="Comprou" {...filterProps("comprou")} /><th>Notas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={12} text="Sem compras registadas." />}
            {filteredRows.map((p) => {
              const sc = statusColor(p.estado);
              return (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-stone">{p.codigo || "—"}</td>
                  <td className="font-mono text-xs text-stone">{fmtDate(p.data)}</td>
                  <td className="font-medium">{supplierName(p.supplier_id)}</td>
                  <td className="font-mono font-medium text-sage-dark">{money(Number(p.valor_aquisicao || 0) - Number(p.desconto || 0))}</td>
                  <td><Badge text={p.estado || "Reservado"} color={sc.color} bg={sc.bg} /></td>
                  <td className="font-mono text-xs text-stone">{p.codigo_rastreio || "—"}</td>
                  <td className="font-mono text-[11px] text-stone">{p.data_envio ? fmtDate(p.data_envio) : "—"}</td>
                  <td className="font-mono text-[11px] text-stone">{p.data_chegada ? fmtDate(p.data_chegada) : "—"}</td>
                  <td className="text-stone text-xs">
                    {p.fatura || "—"}
                    {p.fatura_url && <span className="ml-1.5" title="Tem fatura anexada">📎</span>}
                  </td>
                  <td><Badge text={p.quem_comprou} color={p.quem_comprou === "Rosa" ? "#832F72" : "#A67C1E"} bg={p.quem_comprou === "Rosa" ? "#F7E3F2" : "#F5EADD"} /></td>
                  <td className="text-stone max-w-[160px]" title={p.notas}>{p.notas || "—"}</td>
                  <RowActions onEdit={() => setModal({ data: { ...p }, isNew: false })} onDelete={() => handleDelete(p)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <PurchaseModal
          data={modal.data}
          isNew={modal.isNew}
          suppliers={suppliers}
          purchases={purchases}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            if (modal.isNew) await insertRow("purchases", values);
            else await updateRow("purchases", modal.data.id, values);
            notify(modal.isNew ? "Compra registada." : "Compra atualizada.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function PurchaseModal({ data, isNew, suppliers, purchases, onClose, onSave }) {
  const [f, setF] = useState({ ...data, codigo: data.codigo || (isNew ? sugerirCodigoPorData("COMPRA", data.data, purchases, "codigo", data.id) : "") });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setNum = (k) => (e) => setF({ ...f, [k]: parseFloat(e.target.value) || 0 });

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadDocument(file, `purchases/${f.id}/fatura`);
      setF((prev) => ({ ...prev, fatura_url: url }));
    } catch (err) {
      setError("Não foi possível enviar o ficheiro: " + (err.message || "erro desconhecido"));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    const url = f.fatura_url;
    setF((prev) => ({ ...prev, fatura_url: "" }));
    await deleteDocument(url);
  }

  return (
    <ModalShell title={isNew ? "Registar compra" : "Editar compra"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Código (único, tipo SKU)">
          <div className="flex gap-1.5">
            <input className={`${inputCls} font-mono`} value={f.codigo} onChange={set("codigo")} placeholder="ex: COMPRA-20260815" />
            <Button type="button" onClick={() => setF({ ...f, codigo: sugerirCodigoPorData("COMPRA", f.data, purchases, "codigo", f.id) })}>🔄</Button>
          </div>
        </Field>
        <Field label="Fornecedor">
          <select className={inputCls} value={f.supplier_id} onChange={set("supplier_id")}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Nº fatura"><input className={inputCls} value={f.fatura} onChange={set("fatura")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Valor total de aquisição (€)"><input type="number" step="0.01" min="0" className={inputCls} value={f.valor_aquisicao} onChange={setNum("valor_aquisicao")} /></Field>
        <Field label="Desconto (€)"><input type="number" step="0.01" min="0" className={inputCls} value={f.desconto} onChange={setNum("desconto")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Quem comprou">
          <select className={inputCls} value={f.quem_comprou} onChange={set("quem_comprou")}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="Data da compra"><input type="date" className={inputCls} value={f.data} onChange={set("data")} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Estado"><select className={inputCls} value={f.estado} onChange={set("estado")}>{PURCHASE_STATUS.map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Data de envio"><input type="date" className={inputCls} value={f.data_envio || ""} onChange={set("data_envio")} /></Field>
        <Field label="Data de chegada"><input type="date" className={inputCls} value={f.data_chegada || ""} onChange={set("data_chegada")} /></Field>
      </div>
      <div className="mb-3">
        <Field label="Código de rastreio"><input className={inputCls} value={f.codigo_rastreio || ""} onChange={set("codigo_rastreio")} placeholder="ex: RR123456789PT" /></Field>
      </div>
      <div className="mb-3">
        <Field label="Anexar fatura de compra" span>
          <input type="file" accept="application/pdf,image/*" onChange={handleUpload} disabled={uploading} className={`${inputCls} py-1.5`} />
        </Field>
        {uploading && <p className="text-xs text-stone mt-1">A enviar…</p>}
        {!uploading && f.fatura_url && (
          <div className="flex items-center gap-3 text-xs mt-1.5">
            <a href={f.fatura_url} target="_blank" rel="noreferrer" className="text-purple-600 font-medium underline">Ver fatura anexada</a>
            <button type="button" onClick={handleRemove} className="text-clay-dark underline">remover</button>
          </div>
        )}
        {!uploading && !f.fatura_url && <p className="text-xs text-stone mt-1">Sem fatura anexada.</p>}
      </div>
      {error && <p className="text-clay-dark text-xs mb-3">{error}</p>}
      <div className="mb-5">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={f.notas} onChange={set("notas")} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={async () => {
        const codigo = (f.codigo || "").trim();
        if (!codigo) { setError("Indica um código para a compra."); return; }
        const duplicado = purchases.some((p) => p.id !== f.id && (p.codigo || "").trim().toLowerCase() === codigo.toLowerCase());
        if (duplicado) { setError(`Já existe uma compra com o código "${codigo}" — escolhe outro.`); return; }
        return onSave({ ...f, codigo });
      }} label="Guardar compra" />
    </ModalShell>
  );
}
