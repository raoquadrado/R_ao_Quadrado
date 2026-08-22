import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { deleteRow, insertRow } from "../lib/useRealtimeTable";
import { uploadDocument, deleteDocument } from "../lib/fileStorage";
import { OWNERS, PURCHASE_STATUS } from "../lib/constants";
import { money, fmtDate, todayISO, uid, sugerirCodigoPorData, displaySku } from "../lib/computations";
import { getTestMode } from "../lib/testMode";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, useColumnFilters, FilterTh } from "../components/ui";

const emptyHeader = (suppliers) => ({
  id: uid(), codigo: "", supplier_id: suppliers[0]?.id || "", desconto: 0,
  estado: "Reservado", data_envio: "", data_chegada: "", codigo_rastreio: "",
  fatura: "", fatura_url: "", quem_comprou: "Rosa", data: todayISO(), notas: "",
});

const emptyItem = (article) => ({
  id: uid(),
  article_id: article?.id || "",
  quantidade: 1,
  valor_unitario: Number(article?.preco_unitario || 0),
  referencia: "",
  notas: "",
});

const statusColor = (estado) => {
  if (estado === "Concluída") return { color: "#254238", bg: "#DCEBE4" };
  if (estado === "Enviado") return { color: "#832F72", bg: "#F7E3F2" };
  return { color: "#A67C1E", bg: "#F5EADD" };
};

export default function Purchases({ purchases, purchaseItems, articles, articlesComputed, suppliers, supplierName, articleName, autoOpenNew, onConsumedAutoOpen, presetArticleId, onConsumedPresetArticle }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();

  const itemsByPurchase = (purchaseId) => purchaseItems.filter((it) => it.purchase_id === purchaseId);

  useEffect(() => {
    if (autoOpenNew) {
      const presetArticle = presetArticleId ? articles.find((a) => a.id === presetArticleId) : null;
      const header = emptyHeader(suppliers);
      // pré-preenche o fornecedor com o da compra mais recente deste artigo, se já tiver histórico
      const itensDoArtigo = presetArticleId ? purchaseItems.filter((it) => it.article_id === presetArticleId) : [];
      const comprasDoArtigo = itensDoArtigo
        .map((it) => purchases.find((p) => p.id === it.purchase_id))
        .filter(Boolean)
        .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      if (comprasDoArtigo[0]?.supplier_id) header.supplier_id = comprasDoArtigo[0].supplier_id;
      setModal({ data: header, items: [emptyItem(presetArticle)], isNew: true });
      onConsumedAutoOpen?.();
      onConsumedPresetArticle?.();
    }
  }, [autoOpenNew]);

  const rows = purchases.filter((p) => {
    const referenciasDaCompra = purchaseItems.filter((it) => it.purchase_id === p.id).map((it) => it.referencia || "").join(" ");
    return (supplierName(p.supplier_id) + (p.fatura || "") + (p.codigo_rastreio || "") + " " + referenciasDaCompra).toLowerCase().includes(q.toLowerCase());
  });
  const total = rows.reduce((s, p) => s + (Number(p.valor_aquisicao || 0) - Number(p.desconto || 0)), 0);

  const filterCols = {
    fornecedor: (p) => supplierName(p.supplier_id),
    estado: (p) => p.estado || "Reservado",
    comprou: (p) => p.quem_comprou || "—",
  };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(purchases, filterCols);
  const filteredRows = applyFilters(rows).sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.created_at || "").localeCompare(a.created_at || ""));

  async function handleDelete(p) {
    const ok = await confirm({ title: "Eliminar compra?", message: `A compra a "${supplierName(p.supplier_id)}" vai para a Lixeira — as quantidades e o custo dos artigos envolvidos são recalculados automaticamente.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("purchases", p.id);
    notify("Compra eliminada.");
  }

  function openEdit(p) {
    const items = itemsByPurchase(p.id);
    setModal({ data: { ...p }, items: items.length ? items.map((it) => ({ ...it })) : [emptyItem()], isNew: false });
  }

  // Duplica a compra inteira (cabeçalho + itens) como rascunho novo, por editar antes de
  // guardar — útil quando se compra ao mesmo fornecedor, ao mesmo preço, mas para peças
  // diferentes (outro tamanho ou cor): só é preciso trocar o artigo de cada item.
  function handleDuplicate(p) {
    const items = itemsByPurchase(p.id);
    const header = { ...p, id: undefined, codigo: "", fatura: "", fatura_url: "", codigo_rastreio: "", data: todayISO(), data_envio: "", data_chegada: "", estado: "Reservado" };
    const novosItems = (items.length ? items : [emptyItem()]).map((it) => ({ ...it, id: undefined, purchase_id: undefined }));
    setModal({ data: header, items: novosItems, isNew: true });
  }

  return (
    <div>
      <TabHeader
        title="Compras"
        sub={`${purchases.length} registo(s) · total ${money(total)}`}
        btnLabel="Registar compra"
        onNew={() => setModal({ data: emptyHeader(suppliers), items: [emptyItem()], isNew: true })}
        disabled={suppliers.length === 0}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
      />
      {suppliers.length === 0 && <p className="text-clay-dark text-xs -mt-2 mb-3">Cria primeiro um fornecedor.</p>}
      {suppliers.length > 0 && articles.length === 0 && <p className="text-clay-dark text-xs -mt-2 mb-3">Cria primeiro pelo menos um artigo no catálogo — as compras registam-se sempre sobre artigos já criados.</p>}
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por fornecedor, fatura, rastreio ou referência do fornecedor…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Data</th><FilterTh label="Fornecedor" {...filterProps("fornecedor")} /><th>Itens</th><th>Total</th>
              <FilterTh label="Estado" {...filterProps("estado")} /><th>Rastreio</th>
              <th>Envio</th><th>Chegada</th><th>Fatura</th><FilterTh label="Comprou" {...filterProps("comprou")} /><th>Notas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={13} text="Sem compras registadas." />}
            {filteredRows.map((p) => {
              const sc = statusColor(p.estado);
              const nItems = itemsByPurchase(p.id).length;
              return (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-stone">{p.codigo || "—"}</td>
                  <td className="font-mono text-xs text-stone">{fmtDate(p.data)}</td>
                  <td className="font-medium">{supplierName(p.supplier_id)}</td>
                  <td className="text-stone text-xs">{nItems} artigo(s)</td>
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
                  <RowActions onEdit={() => openEdit(p)} onDuplicate={() => handleDuplicate(p)} onDelete={() => handleDelete(p)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <PurchaseModal
          data={modal.data}
          items={modal.items}
          isNew={modal.isNew}
          suppliers={suppliers}
          purchases={purchases}
          purchaseItems={purchaseItems}
          articles={articles}
          articlesComputed={articlesComputed}
          articleName={articleName}
          onClose={() => setModal(null)}
          onSave={() => {
            notify(modal.isNew ? "Compra registada." : "Compra atualizada.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function PurchaseModal({ data, items: initialItems, isNew, suppliers, purchases, purchaseItems, articles, articlesComputed, articleName, onClose, onSave }) {
  const [f, setF] = useState({ ...data, codigo: data.codigo || (isNew ? sugerirCodigoPorData("COMPRA", data.data, purchases, "codigo", data.id) : "") });
  const [items, setItems] = useState(initialItems);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setNum = (k) => (e) => setF({ ...f, [k]: parseFloat(e.target.value) || 0 });

  // agrupa por "já comprados a este fornecedor" (via histórico de compras), já que o
  // artigo em si não guarda fornecedor — cada compra é que indica o seu.
  const idsDoFornecedor = new Set(
    purchaseItems
      .filter((it) => purchases.find((p) => p.id === it.purchase_id)?.supplier_id === f.supplier_id)
      .map((it) => it.article_id)
  );
  const articlesDoFornecedor = articles.filter((a) => idsDoFornecedor.has(a.id));
  const articlesOutros = articles.filter((a) => !idsDoFornecedor.has(a.id));

  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function pickArticleForItem(id, articleId) {
    const a = articlesComputed.find((x) => x.id === articleId);
    updateItem(id, { article_id: articleId, valor_unitario: a ? Number(a.preco_unitario || 0) : 0 });
  }

  function addItem() {
    setItems((prev) => [...prev, { id: uid(), article_id: "", quantidade: 1, valor_unitario: 0, referencia: "", notas: "" }]);
  }

  function toggleNovoArtigo(id, ligar) {
    updateItem(id, ligar
      ? { article_id: "", is_novo: true, novo_artigo_descricao: "" }
      : { is_novo: false, novo_artigo_descricao: "" });
  }

  function removeItem(id) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  const totalBruto = items.reduce((s, it) => s + Number(it.quantidade || 0) * Number(it.valor_unitario || 0), 0);
  const totalFinal = totalBruto - Number(f.desconto || 0);

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

  async function handleSave() {
    const codigo = (f.codigo || "").trim();
    if (!codigo) { setError("Indica um código para a compra."); return; }
    const duplicado = purchases.some((p) => p.id !== f.id && (p.codigo || "").trim().toLowerCase() === codigo.toLowerCase());
    if (duplicado) { setError(`Já existe uma compra com o código "${codigo}" — escolhe outro.`); return; }
    if (!f.supplier_id) { setError("Escolhe o fornecedor."); return; }
    const itensValidos = items.filter((it) => it.article_id || (it.is_novo && (it.novo_artigo_descricao || "").trim()));
    if (itensValidos.length === 0) { setError("Adiciona pelo menos um artigo à compra (da lista, ou criado na hora só com descrição)."); return; }
    if (itensValidos.some((it) => Number(it.quantidade) <= 0)) { setError("A quantidade de cada item tem de ser maior que zero."); return; }

    setSaving(true);
    setError("");
    try {
      // Cria primeiro, no catálogo, os artigos "na hora" (só descrição) que ainda não têm
      // ficha — ficam com o estado "A aguardar validação" até a Rosa/Rita completarem o
      // Tipo, a Cor e os restantes dados na Ficha do Artigo.
      const itensComArtigo = [];
      for (const it of itensValidos) {
        if (it.is_novo && !it.article_id) {
          const novoArtigo = await insertRow("articles", {
            sku: null, tipo: "", artigo: it.novo_artigo_descricao.trim(), cor: "", tamanho: "",
            owner: "Rosa", preco_unitario: 0, preco_medio: 0, iva: 0,
            quantidade: 0, valor_venda: 0, foto_url: "",
            publicado: false, etiquetado: false, estado: "A aguardar validação",
            favorito: false, etiqueta: "", notas: "",
          });
          itensComArtigo.push({ ...it, article_id: novoArtigo.id });
        } else {
          itensComArtigo.push(it);
        }
      }

      const { error: rpcError } = await supabase.rpc("save_purchase_with_items", {
        p_id: f.id,
        p_codigo: codigo,
        p_supplier_id: f.supplier_id,
        p_desconto: Number(f.desconto || 0),
        p_estado: f.estado,
        p_data_envio: f.data_envio || null,
        p_data_chegada: f.data_chegada || null,
        p_codigo_rastreio: f.codigo_rastreio || null,
        p_fatura: f.fatura || null,
        p_fatura_url: f.fatura_url || null,
        p_quem_comprou: f.quem_comprou,
        p_data: f.data,
        p_notas: f.notas || null,
        p_items: itensComArtigo.map((it) => ({
          id: it.id, article_id: it.article_id,
          quantidade: Number(it.quantidade || 0), valor_unitario: Number(it.valor_unitario || 0),
          referencia: it.referencia || null, notas: it.notas || null,
        })),
        p_is_test: getTestMode(),
      });
      if (rpcError) throw new Error(rpcError.message.replace(/^.*save_purchase_with_items: /, ""));
      onSave();
    } catch (err) {
      setError(err.message || "Não foi possível guardar a compra.");
    } finally {
      setSaving(false);
    }
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
        <Field label="Quem comprou">
          <select className={inputCls} value={f.quem_comprou} onChange={set("quem_comprou")}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Data da compra"><input type="date" className={inputCls} value={f.data} onChange={set("data")} /></Field>
        <Field label="Estado"><select className={inputCls} value={f.estado} onChange={set("estado")}>{PURCHASE_STATUS.map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Código de rastreio"><input className={inputCls} value={f.codigo_rastreio || ""} onChange={set("codigo_rastreio")} placeholder="ex: RR123456789PT" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Field label="Data de envio"><input type="date" className={inputCls} value={f.data_envio || ""} onChange={set("data_envio")} /></Field>
        <Field label="Data de chegada"><input type="date" className={inputCls} value={f.data_chegada || ""} onChange={set("data_chegada")} /></Field>
      </div>

      {/* ---------- Itens da compra ---------- */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-stone">Artigos desta compra</label>
          <button type="button" onClick={addItem} className="text-xs font-medium text-purple-600 underline">+ Adicionar artigo</button>
        </div>
        <p className="text-[11px] text-stone -mt-1 mb-2">A quantidade e o custo unitário definem-se aqui — o artigo só é atualizado (stock e "valor da última compra") quando esta compra ficar com o Estado "Concluída".</p>
        <div className="space-y-2">
          {items.map((it) => {
            const subtotal = Number(it.quantidade || 0) * Number(it.valor_unitario || 0);
            return (
              <div key={it.id} className="border border-line rounded-lg p-2.5 bg-paper/40">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px_110px_auto] gap-2 items-end">
                  {it.is_novo ? (
                    <Field label="Descrição do artigo novo (sem mais info por agora)">
                      <input className={inputCls} value={it.novo_artigo_descricao || ""} placeholder="ex: casaco de lã bege"
                        onChange={(e) => updateItem(it.id, { novo_artigo_descricao: e.target.value })} autoFocus />
                    </Field>
                  ) : (
                    <Field label="Artigo">
                      <select className={inputCls} value={it.article_id} onChange={(e) => pickArticleForItem(it.id, e.target.value)}>
                        <option value="">— escolhe um artigo —</option>
                        {articlesDoFornecedor.length > 0 && (
                          <optgroup label="Já comprados a este fornecedor">
                            {articlesDoFornecedor.map((a) => (
                              <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo}{a.cor ? ` · ${a.cor}` : ""}{a.padrao && a.padrao !== "Liso" ? ` (${a.padrao})` : ""}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label={articlesDoFornecedor.length > 0 ? "Outros artigos" : "Artigos"}>
                          {articlesOutros.map((a) => (
                            <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo}{a.cor ? ` · ${a.cor}` : ""}{a.padrao && a.padrao !== "Liso" ? ` (${a.padrao})` : ""}</option>
                          ))}
                        </optgroup>
                      </select>
                    </Field>
                  )}
                  <Field label="Qtd">
                    <input type="number" min="1" step="1" className={inputCls} value={it.quantidade}
                      onChange={(e) => updateItem(it.id, { quantidade: parseFloat(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Custo unit. (€)">
                    <input type="number" min="0" step="0.01" className={inputCls} value={it.valor_unitario}
                      onChange={(e) => updateItem(it.id, { valor_unitario: parseFloat(e.target.value) || 0 })} />
                  </Field>
                  <button type="button" onClick={() => removeItem(it.id)} disabled={items.length === 1}
                    className="text-xs text-clay-dark underline disabled:opacity-30 disabled:no-underline h-[38px]">
                    remover
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 items-end">
                  <Field label="Referência do fornecedor">
                    <input className={inputCls} value={it.referencia || ""} placeholder="ex: código do fornecedor para este artigo"
                      onChange={(e) => updateItem(it.id, { referencia: e.target.value })} />
                  </Field>
                  <button type="button" onClick={() => toggleNovoArtigo(it.id, !it.is_novo)}
                    className="text-xs text-purple-600 underline h-[38px] text-left sm:text-right">
                    {it.is_novo ? "← Escolher da lista de artigos" : "+ Criar artigo novo (só descrição)"}
                  </button>
                </div>
                {it.is_novo && (
                  <p className="text-[11px] text-stone mt-1.5">Este artigo fica com o estado "A aguardar validação" — depois vais aos Artigos completar o Tipo, a Cor e o resto da informação.</p>
                )}
                <p className="text-[11px] text-stone text-right mt-1">Subtotal: <span className="font-mono">{money(subtotal)}</span></p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Field label="Desconto na compra (€)"><input type="number" step="0.01" min="0" className={inputCls} value={f.desconto} onChange={setNum("desconto")} /></Field>
        <div className="flex flex-col justify-end">
          <p className="text-xs text-stone">Total da compra</p>
          <p className="font-mono text-lg font-semibold text-sage-dark">{money(totalFinal)}</p>
        </div>
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
      <ModalActions onClose={onClose} onSave={handleSave} label={saving ? "A guardar…" : "Guardar compra"} disabled={saving} />
    </ModalShell>
  );
}
