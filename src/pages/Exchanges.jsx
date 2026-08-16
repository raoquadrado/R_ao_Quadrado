import { useState, useEffect } from "react";
import { insertRow, updateRow, deleteRow } from "../lib/useRealtimeTable";
import { EXCHANGE_ESTADOS, EXCHANGE_ESTADO_COLORS, EXCHANGE_MOTIVOS, DEFAULT_SETTINGS } from "../lib/constants";
import { money, fmtDate, todayISO, uid, displaySku, sugerirCodigoPorData, dataLimiteTroca } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, Badge, ModalShell, ModalActions, SearchBox, TabHeader, RowActions, EmptyRow, inputCls, useColumnFilters, FilterTh } from "../components/ui";

const empty = (presetSaleId) => ({
  id: uid(), codigo: "", sale_id: presetSaleId || "", original_article_id: "", motivo: EXCHANGE_MOTIVOS[0],
  motivo_notas: "", novo_article_id: "", quantidade: 1, diferenca: 0, estado: "Pedido registado",
  stock_ajustado: false, data_pedido: todayISO(), data_rececao: "", notas: "",
});

export default function Exchanges({ exchanges, sales, articlesComputed, clientName, articleName, presetSaleId, onConsumedPresetSale, autoOpenNew, onConsumedAutoOpen, autoOpenEditId, onConsumedAutoOpenEdit, settings }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const notify = useToast();
  const confirm = useConfirm();
  const janelaTroca = settings?.troca_janela_dias ?? DEFAULT_SETTINGS.troca_janela_dias;

  useEffect(() => {
    if (autoOpenNew || presetSaleId) {
      setModal({ data: empty(presetSaleId), isNew: true });
      onConsumedAutoOpen?.();
      if (presetSaleId) onConsumedPresetSale?.();
    }
  }, [autoOpenNew, presetSaleId]);

  useEffect(() => {
    if (autoOpenEditId) {
      const e = exchanges.find((x) => x.id === autoOpenEditId);
      if (e) setModal({ data: { ...e }, isNew: false });
      onConsumedAutoOpenEdit?.();
    }
  }, [autoOpenEditId, exchanges]);

  function saleFor(e) { return sales.find((s) => s.id === e.sale_id); }
  function limiteFor(e) { return dataLimiteTroca(saleFor(e), janelaTroca); }

  const rows = exchanges.filter((e) => {
    const s = saleFor(e);
    return ((e.codigo || "") + (s ? clientName(s.client_id) : "") + articleName(e.original_article_id)).toLowerCase().includes(q.toLowerCase());
  });

  const filterCols = { estado: (e) => e.estado || "Pedido registado" };
  const { filterProps, applyFilters, hasActiveFilters, clearAllFilters } = useColumnFilters(exchanges, filterCols);
  const filteredRows = applyFilters(rows).sort((a, b) => (b.data_pedido || "").localeCompare(a.data_pedido || ""));

  async function handleDelete(e) {
    const ok = await confirm({ title: "Eliminar troca?", message: `"${e.codigo}" vai para a Lixeira.`, confirmLabel: "Eliminar" });
    if (!ok) return;
    await deleteRow("exchanges", e.id);
    notify("Troca eliminada.");
  }

  return (
    <div>
      <TabHeader
        title="🔁 Trocas"
        sub={`${exchanges.length} pedido(s) de troca — a data limite conta-se sempre a partir da data da venda (${EXCHANGE_WINDOW_DAYS} dias, prazo legal).`}
        btnLabel="Novo pedido de troca"
        onNew={() => setModal({ data: empty(), isNew: true })}
        disabled={sales.length === 0}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters}
      />
      {sales.length === 0 && <p className="text-clay-dark text-xs -mt-2 mb-3">Ainda não há vendas registadas para associar a uma troca.</p>}
      <SearchBox value={q} onChange={setQ} placeholder="Procurar por código, cliente ou artigo…" />
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Data pedido</th><th>Data limite</th><th>Cliente</th><th>Artigo devolvido</th><th>Novo artigo</th>
              <th>Diferença</th><FilterTh label="Estado" {...filterProps("estado")} /><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow span={9} text="Ainda não há pedidos de troca." />}
            {filteredRows.map((e) => {
              const s = saleFor(e);
              const limite = limiteFor(e);
              const expirada = limite && limite < todayISO() && !["Concluída", "Cancelada"].includes(e.estado);
              const ec = EXCHANGE_ESTADO_COLORS[e.estado] || EXCHANGE_ESTADO_COLORS["Pedido registado"];
              return (
                <tr key={e.id}>
                  <td className="font-mono text-xs text-stone">{e.codigo || "—"}</td>
                  <td className="font-mono text-xs text-stone">{fmtDate(e.data_pedido)}</td>
                  <td className={`font-mono text-xs ${expirada ? "text-clay-dark font-semibold" : "text-stone"}`}>
                    {limite ? fmtDate(limite) : "—"}{expirada && " ⚠"}
                  </td>
                  <td>{s ? clientName(s.client_id) : "—"}</td>
                  <td className="font-medium">{articleName(e.original_article_id)}</td>
                  <td>{articleName(e.novo_article_id)}</td>
                  <td className={`font-mono text-xs font-medium ${e.diferenca > 0 ? "text-clay-dark" : e.diferenca < 0 ? "text-sage-dark" : "text-stone"}`}>
                    {e.diferenca === 0 ? "sem diferença" : e.diferenca > 0 ? `cliente paga ${money(e.diferenca)}` : `devolver ${money(Math.abs(e.diferenca))}`}
                  </td>
                  <td><Badge text={e.estado} color={ec.color} bg={ec.bg} /></td>
                  <RowActions onEdit={() => setModal({ data: { ...e }, isNew: false })} onDelete={() => handleDelete(e)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ExchangeModal
          data={modal.data}
          isNew={modal.isNew}
          exchanges={exchanges}
          sales={sales}
          articlesComputed={articlesComputed}
          clientName={clientName}
          articleName={articleName}
          janelaTroca={janelaTroca}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            if (modal.isNew) await insertRow("exchanges", values);
            else await updateRow("exchanges", modal.data.id, values);
            notify(modal.isNew ? "Pedido de troca registado." : "Troca atualizada.");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function ExchangeModal({ data, isNew, exchanges, sales, articlesComputed, clientName, articleName, onClose, onSave, janelaTroca }) {
  const [f, setF] = useState({ ...data });
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const saleSelecionada = sales.find((s) => s.id === f.sale_id);
  const artigoOriginal = articlesComputed.find((a) => a.id === f.original_article_id);
  const novoArtigo = articlesComputed.find((a) => a.id === f.novo_article_id);
  const limite = dataLimiteTroca(saleSelecionada, janelaTroca);
  const jaExpirada = limite && limite < todayISO();

  // ao escolher a encomenda, o artigo devolvido é sempre o artigo dessa venda — e sugere-se logo o código
  function escolherVenda(saleId) {
    const s = sales.find((x) => x.id === saleId);
    setF((prev) => ({
      ...prev, sale_id: saleId, original_article_id: s?.article_id || "",
      codigo: prev.codigo || sugerirCodigoPorData("TROCA", todayISO(), exchanges, "codigo", prev.id),
    }));
  }

  // diferença sugerida = preço do novo artigo − preço do artigo devolvido (na venda original)
  function recalcularDiferenca(novoArticleId) {
    const novo = articlesComputed.find((a) => a.id === novoArticleId);
    const precoOriginal = Number(saleSelecionada?.valor_venda || artigoOriginal?.valor_venda || 0);
    const diferenca = Math.round(((Number(novo?.valor_venda || 0) - precoOriginal) + Number.EPSILON) * 100) / 100;
    setF((prev) => ({ ...prev, novo_article_id: novoArticleId, diferenca }));
  }

  async function confirmarRececao() {
    if (f.stock_ajustado) return;
    setF((prev) => ({ ...prev, stock_ajustado: true, estado: "Artigo devolvido recebido", data_rececao: todayISO() }));
  }

  return (
    <ModalShell title={isNew ? "Novo pedido de troca" : "Editar troca"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Código (único, tipo SKU)">
          <div className="flex gap-1.5">
            <input className={`${inputCls} font-mono`} value={f.codigo} onChange={set("codigo")} placeholder="ex: TROCA-20260815" />
            <Button type="button" onClick={() => setF({ ...f, codigo: sugerirCodigoPorData("TROCA", todayISO(), exchanges, "codigo", f.id) })}>🔄</Button>
          </div>
        </Field>
        <Field label="Data do pedido"><input type="date" className={inputCls} value={f.data_pedido} onChange={set("data_pedido")} /></Field>
      </div>
      {error && <p className="text-clay-dark text-xs -mt-1.5 mb-3">{error}</p>}

      <div className="mb-3">
        <Field label="1. Encomenda (venda original)">
          <select className={inputCls} value={f.sale_id} onChange={(e) => escolherVenda(e.target.value)}>
            <option value="">— escolher —</option>
            {[...sales].filter((s) => s.estado === "Pago" || s.id === f.sale_id).sort((a, b) => (b.data || "").localeCompare(a.data || "")).map((s) => (
              <option key={s.id} value={s.id}>{s.codigo || "sem código"} — {clientName(s.client_id)} — {articleName(s.article_id)} ({fmtDate(s.data)})</option>
            ))}
          </select>
          <p className="text-stone text-[11px] mt-1">Só aparecem vendas já "Pago" — uma troca só faz sentido para uma compra concretizada.</p>
        </Field>
      </div>

      {saleSelecionada && (
        <div className="bg-paper rounded-md p-3 mb-3 text-xs">
          <p className="mb-1"><span className="text-stone">2. Artigo devolvido (da encomenda):</span> <span className="font-medium">{artigoOriginal ? `${displaySku(artigoOriginal)} — ${artigoOriginal.artigo}` : articleName(f.original_article_id)}</span></p>
          <p className={jaExpirada ? "text-clay-dark font-semibold" : "text-sage-dark font-medium"}>
            📅 Data limite para troca: {limite ? fmtDate(limite) : "—"} {jaExpirada && "— já expirada ⚠"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="3. Motivo">
          <select className={inputCls} value={f.motivo} onChange={set("motivo")}>{EXCHANGE_MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field label="Quantidade"><input type="number" min="1" className={inputCls} value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: Number(e.target.value) || 1 })} /></Field>
      </div>
      {f.motivo === "Outro" && (
        <div className="mb-3">
          <Field label="Detalhe do motivo"><input className={inputCls} value={f.motivo_notas} onChange={set("motivo_notas")} /></Field>
        </div>
      )}

      <div className="mb-3">
        <Field label="4. Novo artigo pretendido">
          <select className={inputCls} value={f.novo_article_id} onChange={(e) => recalcularDiferenca(e.target.value)}>
            <option value="">— escolher —</option>
            {articlesComputed.map((a) => (
              <option key={a.id} value={a.id}>{displaySku(a)} — {a.artigo} — {money(a.valor_venda)} (stock: {a.stockAtual})</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="5. Diferença a pagar (+) / devolver (−)">
          <input type="number" step="0.01" className={inputCls} value={f.diferenca} onChange={(e) => setF({ ...f, diferenca: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="6. Estado da troca">
          <select className={inputCls} value={f.estado} onChange={set("estado")}>
            {EXCHANGE_ESTADOS.map((es) => <option key={es}>{es}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-stone text-[11px] -mt-2 mb-3">{f.diferenca > 0 ? `O cliente paga ${money(f.diferenca)} a mais.` : f.diferenca < 0 ? `Deves devolver ${money(Math.abs(f.diferenca))} ao cliente.` : "Sem diferença de valor entre os dois artigos."} Valor sugerido automaticamente — podes ajustar.</p>

      <div className="bg-paper rounded-md p-3 mb-4">
        {f.stock_ajustado ? (
          <p className="text-sage-dark text-xs font-medium">✓ Receção confirmada em {fmtDate(f.data_rececao)} — stock já ajustado (artigo devolvido voltou ao stock; novo artigo foi retirado).</p>
        ) : (
          <>
            <p className="text-stone text-xs mb-2">Quando o artigo devolvido chegar, confirma a receção: a peça devolvida volta a entrar em stock e a peça nova sai do stock, automaticamente.</p>
            <Button onClick={confirmarRececao} disabled={!f.original_article_id || !f.novo_article_id}>📦 Confirmar receção do artigo devolvido</Button>
          </>
        )}
      </div>

      <div className="mb-4">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={f.notas} onChange={set("notas")} /></Field>
      </div>

      <ModalActions
        onClose={onClose}
        onSave={async () => {
          if (!f.sale_id) { setError("Escolhe a encomenda (venda original)."); return; }
          if (!f.novo_article_id) { setError("Escolhe o novo artigo pretendido."); return; }
          const codigo = (f.codigo || "").trim();
          if (!codigo) { setError("Indica um código para a troca."); return; }
          const duplicado = exchanges.some((x) => x.id !== f.id && (x.codigo || "").trim().toLowerCase() === codigo.toLowerCase());
          if (duplicado) { setError(`Já existe uma troca com o código "${codigo}" — escolhe outro.`); return; }
          return onSave({ ...f, codigo });
        }}
        label={isNew ? "Registar pedido de troca" : "Guardar"}
      />
    </ModalShell>
  );
}
