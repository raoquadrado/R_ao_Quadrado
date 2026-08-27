import { useState } from "react";
import { supabase } from "../supabaseClient";
import { deleteRow } from "../lib/useRealtimeTable";
import { getTestMode } from "../lib/testMode";
import { OWNERS, tipoUsoInterno } from "../lib/constants";
import { money, fmtDate, displaySku, todayISO, uid } from "../lib/computations";
import { useToast, useConfirm } from "../lib/overlays";
import { Field, Button, ModalShell, ModalActions, TabHeader, EmptyRow, inputCls } from "../components/ui";

export default function Consumos({ articlesComputed, tipos, transformacoes, transformacaoItens, consumosManuais, transformacaoExecucoes, gastosDiversos, suppliers, supplierName }) {
  const [consumoModal, setConsumoModal] = useState(false);
  const [transformacaoModal, setTransformacaoModal] = useState(false);
  const [gastoModal, setGastoModal] = useState(false);
  const notify = useToast();
  const confirm = useConfirm();

  const artigoNome = (id) => articlesComputed.find((a) => a.id === id)?.artigo || "artigo removido";

  async function handleAnularConsumo(c) {
    const ok = await confirm({ title: "Anular consumo?", message: "A quantidade consumida volta a entrar no stock.", confirmLabel: "Anular" });
    if (!ok) return;
    await deleteRow("consumos_manuais", c.id);
    notify("Consumo anulado — stock devolvido.");
  }
  async function handleAnularTransformacao(t) {
    const ok = await confirm({ title: "Anular transformação?", message: "Devolve o que foi consumido e retira o que foi produzido — tudo de uma vez.", confirmLabel: "Anular" });
    if (!ok) return;
    await deleteRow("transformacao_execucoes", t.id);
    notify("Transformação anulada — stock revertido.");
  }
  async function handleAnularGasto(g) {
    const ok = await confirm({ title: "Anular gasto?", message: `"${g.descricao}" deixa de contar para o lucro do Painel.`, confirmLabel: "Anular" });
    if (!ok) return;
    await deleteRow("gastos_diversos", g.id);
    notify("Gasto anulado.");
  }

  const movimentos = [
    ...(consumosManuais || []).filter((c) => !c.deleted_at).map((c) => ({ tipo: "consumo", data: c.data, criado: c.created_at, item: c })),
    ...(transformacaoExecucoes || []).filter((t) => !t.deleted_at).map((t) => ({ tipo: "transformacao", data: (t.created_at || "").slice(0, 10), criado: t.created_at, item: t })),
    ...(gastosDiversos || []).filter((g) => !g.deleted_at).map((g) => ({ tipo: "gasto", data: g.data, criado: g.created_at, item: g })),
  ].sort((a, b) => (b.criado || "").localeCompare(a.criado || ""));

  return (
    <div>
      <TabHeader title="Consumos, Gastos & Transformações" sub={`${movimentos.length} movimento(s) registado(s)`} />
      <p className="text-stone text-sm mb-4 -mt-2">Tudo o que sai do negócio sem ser uma Compra de artigo nem uma Venda: consumo avulso de material interno, gastos diversos (ex: gasóleo, portes), e transformações de material (ex: papel + tinteiro → etiquetas).</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button onClick={() => setConsumoModal(true)}>📉 Registar consumo</Button>
        <Button onClick={() => setGastoModal(true)}>💸 Registar gasto diverso</Button>
        <Button onClick={() => setTransformacaoModal(true)}>🔄 Registar transformação</Button>
      </div>
      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead><tr><th>Tipo</th><th>Descrição</th><th>Valor / Qtd</th><th>Owner / Artigo</th><th>Data</th><th></th></tr></thead>
          <tbody>
            {movimentos.length === 0 && <EmptyRow span={6} text="Ainda sem movimentos registados." />}
            {movimentos.map((m) => {
              if (m.tipo === "consumo") {
                const c = m.item;
                return (
                  <tr key={c.id}>
                    <td>📉 Consumo</td>
                    <td className="text-stone text-xs">{c.motivo || "—"}</td>
                    <td className="font-mono text-xs">−{c.quantidade}</td>
                    <td className="text-xs">{artigoNome(c.article_id)}</td>
                    <td className="text-xs">{fmtDate(c.data)}</td>
                    <td><button type="button" onClick={() => handleAnularConsumo(c)} className="text-clay-dark underline text-xs">anular</button></td>
                  </tr>
                );
              }
              if (m.tipo === "transformacao") {
                const t = m.item;
                return (
                  <tr key={t.id}>
                    <td>🔄 Transformação</td>
                    <td className="text-stone text-xs">{t.nome || "—"}{t.notas ? ` — ${t.notas}` : ""}</td>
                    <td className="font-mono text-xs">+{t.output_quantidade}</td>
                    <td className="text-xs">{artigoNome(t.output_article_id)}</td>
                    <td className="text-xs">{fmtDate((t.created_at || "").slice(0, 10))}</td>
                    <td><button type="button" onClick={() => handleAnularTransformacao(t)} className="text-clay-dark underline text-xs">anular</button></td>
                  </tr>
                );
              }
              const g = m.item;
              return (
                <tr key={g.id}>
                  <td>💸 Gasto diverso</td>
                  <td className="text-stone text-xs">{g.descricao}{g.notas ? ` — ${g.notas}` : ""}</td>
                  <td className="font-mono text-xs">{money(g.valor)}</td>
                  <td className="text-xs">{g.owner || "—"}{g.supplier_id ? ` · ${supplierName(g.supplier_id)}` : ""}</td>
                  <td className="text-xs">{fmtDate(g.data)}</td>
                  <td><button type="button" onClick={() => handleAnularGasto(g)} className="text-clay-dark underline text-xs">anular</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {consumoModal && (
        <ConsumoManualModal
          articlesComputed={articlesComputed}
          tipos={tipos}
          onClose={() => setConsumoModal(false)}
          onSaved={() => { notify("Consumo registado."); setConsumoModal(false); }}
        />
      )}
      {transformacaoModal && (
        <TransformacaoModal
          articlesComputed={articlesComputed}
          tipos={tipos}
          transformacoes={transformacoes}
          transformacaoItens={transformacaoItens}
          onClose={() => setTransformacaoModal(false)}
          onSaved={() => { notify("Transformação registada — stock atualizado."); setTransformacaoModal(false); }}
        />
      )}
      {gastoModal && (
        <GastoDiversoModal
          suppliers={suppliers}
          onClose={() => setGastoModal(false)}
          onSaved={() => { notify("Gasto registado."); setGastoModal(false); }}
        />
      )}
    </div>
  );
}

function GastoDiversoModal({ suppliers, onClose, onSaved }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [owner, setOwner] = useState(OWNERS[0]);
  const [supplierId, setSupplierId] = useState("");
  const [data, setDataCampo] = useState(todayISO());
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!descricao.trim()) { setError("Indica uma descrição (ex: gasóleo)."); return; }
    if (!valor || valor <= 0) { setError("Indica um valor válido."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.from("gastos_diversos").insert({
        descricao: descricao.trim(), valor, owner, supplier_id: supplierId || null, data, notas: notas || null, is_test: getTestMode(),
      });
      if (err) throw new Error(err.message);
      onSaved();
    } catch (err) {
      setError(err.message || "Não foi possível registar o gasto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Registar gasto diverso" onClose={onClose}>
      <p className="text-stone text-sm mb-3">Para saídas de dinheiro que não são uma Compra de artigo nem uma Venda — ex: gasóleo, portes, serviços. Conta para o Lucro do Painel.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-3 mb-3">
        <Field label="Descrição"><input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex: gasóleo" /></Field>
        <Field label="Valor (€)"><input type="number" min="0" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(parseFloat(e.target.value) || 0)} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Quem pagou">
          <select className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
            {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Data"><input type="date" className={inputCls} value={data} onChange={(e) => setDataCampo(e.target.value)} /></Field>
      </div>
      <div className="mb-3">
        <Field label="Fornecedor (opcional)">
          <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— nenhum —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
      </div>
      {error && <p className="text-clay-dark text-xs mb-3">{error}</p>}
      <div className="mb-5">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} label={saving ? "A guardar…" : "Registar gasto"} disabled={saving} />
    </ModalShell>
  );
}

function ConsumoManualModal({ articlesComputed, tipos, onClose, onSaved }) {
  const artigosInternos = articlesComputed.filter((a) => tipoUsoInterno(a.tipo, tipos));
  const [articleId, setArticleId] = useState(artigosInternos[0]?.id || "");
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [data, setDataCampo] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const artigoEscolhido = artigosInternos.find((a) => a.id === articleId);

  async function handleSave() {
    if (!articleId) { setError("Escolhe um artigo."); return; }
    if (!quantidade || quantidade <= 0) { setError("Indica uma quantidade válida."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.from("consumos_manuais").insert({
        article_id: articleId, quantidade, motivo: motivo || null, data, is_test: getTestMode(),
      });
      if (err) throw new Error(err.message);
      onSaved();
    } catch (err) {
      setError(err.message || "Não foi possível registar o consumo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Registar consumo de material interno" onClose={onClose}>
      <p className="text-stone text-sm mb-3">Dá baixa de stock a um material interno por um motivo avulso — sem estar ligado a nenhuma venda ou encomenda.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px] gap-3 mb-3">
        <Field label="Artigo">
          <select className={inputCls} value={articleId} onChange={(e) => setArticleId(e.target.value)}>
            {artigosInternos.length === 0 && <option value="">— sem material interno —</option>}
            {artigosInternos.map((a) => <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo} (stock: {a.stockAtual})</option>)}
          </select>
        </Field>
        <Field label="Qtd"><input type="number" min="1" step="1" className={inputCls} value={quantidade} onChange={(e) => setQuantidade(parseFloat(e.target.value) || 1)} /></Field>
      </div>
      {artigoEscolhido && artigoEscolhido.stockAtual < quantidade && (
        <p className="text-[11px] text-clay-dark mb-3">⚠ Este consumo deixa o stock negativo (atual: {artigoEscolhido.stockAtual}).</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Data"><input type="date" className={inputCls} value={data} onChange={(e) => setDataCampo(e.target.value)} /></Field>
        <Field label="Motivo"><input className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex: fita para decorar a montra" /></Field>
      </div>
      {error && <p className="text-clay-dark text-xs mb-3">{error}</p>}
      <ModalActions onClose={onClose} onSave={handleSave} label={saving ? "A guardar…" : "Registar consumo"} disabled={saving} />
    </ModalShell>
  );
}

function TransformacaoModal({ articlesComputed, tipos, transformacoes, transformacaoItens, onClose, onSaved }) {
  const artigosInternos = articlesComputed.filter((a) => tipoUsoInterno(a.tipo, tipos));
  const receitasAtivas = (transformacoes || []).filter((t) => t.ativo !== false && !t.deleted_at);
  const [receitaId, setReceitaId] = useState(""); // "" = avulsa
  const [nome, setNome] = useState("");
  const [outputArticleId, setOutputArticleId] = useState("");
  const [outputQuantidadeBase, setOutputQuantidadeBase] = useState(1);
  const [itens, setItens] = useState([{ id: uid(), article_id: "", quantidade: 1 }]);
  const [lotes, setLotes] = useState(1);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function aplicarReceita(id) {
    setReceitaId(id);
    if (!id) return;
    const r = transformacoes.find((t) => t.id === id);
    const itensReceita = (transformacaoItens || []).filter((it) => it.transformacao_id === id);
    if (r) {
      setNome(r.nome);
      setOutputArticleId(r.output_article_id);
      setOutputQuantidadeBase(r.output_quantidade);
      setItens(itensReceita.map((it) => ({ id: uid(), article_id: it.article_id, quantidade: it.quantidade })));
    }
  }

  function addItem() { setItens((prev) => [...prev, { id: uid(), article_id: "", quantidade: 1 }]); }
  function removeItem(id) { setItens((prev) => prev.filter((it) => it.id !== id)); }
  function updateItem(id, patch) { setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it))); }

  const outputArtigo = artigosInternos.find((a) => a.id === outputArticleId);
  const outputQuantidadeTotal = (Number(outputQuantidadeBase) || 0) * (Number(lotes) || 0);
  const itensValidos = itens.filter((it) => it.article_id);

  async function handleSave() {
    if (!nome.trim()) { setError("Indica um nome para esta transformação."); return; }
    if (!outputArticleId) { setError("Escolhe o artigo de saída."); return; }
    if (itensValidos.length === 0) { setError("Acrescenta pelo menos um artigo consumido (input)."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.rpc("executar_transformacao", {
        p_transformacao_id: receitaId || null,
        p_nome: nome.trim(),
        p_output_article_id: outputArticleId,
        p_output_quantidade: outputQuantidadeTotal,
        p_lotes: lotes,
        p_itens: itensValidos.map((it) => ({ article_id: it.article_id, quantidade: (Number(it.quantidade) || 0) * (Number(lotes) || 0) })),
        p_notas: notas || null,
        p_is_test: getTestMode(),
      });
      if (err) throw new Error(err.message);
      onSaved();
    } catch (err) {
      setError(err.message || "Não foi possível registar a transformação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Registar transformação" onClose={onClose} wide>
      <p className="text-stone text-sm mb-3">Consome vários materiais e dá entrada de stock a um único artigo produzido (ex: 20 folhas + 5ml de tinteiro → +100 etiquetas).</p>

      {receitasAtivas.length > 0 && (
        <div className="mb-3">
          <Field label="Usar um Tipo de Transformação guardado (opcional)">
            <select className={inputCls} value={receitaId} onChange={(e) => aplicarReceita(e.target.value)}>
              <option value="">— avulsa, sem receita —</option>
              {receitasAtivas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Etiquetas caseiras" /></Field>
        <Field label="Nº de lotes"><input type="number" min="1" step="1" className={inputCls} value={lotes} onChange={(e) => setLotes(parseFloat(e.target.value) || 1)} /></Field>
      </div>

      <div className="bg-paper border border-line rounded-lg p-3 mb-3">
        <p className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">Artigo produzido (saída)</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3">
          <Field label="Artigo">
            <select className={inputCls} value={outputArticleId} onChange={(e) => setOutputArticleId(e.target.value)}>
              <option value="">— escolher —</option>
              {artigosInternos.map((a) => <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo} (stock: {a.stockAtual})</option>)}
            </select>
          </Field>
          <Field label="Qtd por lote"><input type="number" min="0" step="1" className={inputCls} value={outputQuantidadeBase} onChange={(e) => setOutputQuantidadeBase(parseFloat(e.target.value) || 0)} /></Field>
        </div>
        {outputArtigo && <p className="text-xs text-stone mt-2">Vai dar entrada de <strong>+{outputQuantidadeTotal}</strong> em {outputArtigo.artigo} ({lotes} lote(s) × {outputQuantidadeBase}).</p>}
      </div>

      <p className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">Artigos consumidos (inputs)</p>
      <div className="space-y-2 mb-2">
        {itens.map((it) => {
          const artigoInput = artigosInternos.find((a) => a.id === it.article_id);
          const qtdReal = (Number(it.quantidade) || 0) * (Number(lotes) || 0);
          return (
            <div key={it.id} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2 items-end">
              <Field label="Artigo">
                <select className={inputCls} value={it.article_id} onChange={(e) => updateItem(it.id, { article_id: e.target.value })}>
                  <option value="">— escolhe um artigo —</option>
                  {artigosInternos.map((a) => <option key={a.id} value={a.id}>{displaySku(a)} · {a.artigo} (stock: {a.stockAtual})</option>)}
                </select>
              </Field>
              <Field label="Qtd por lote">
                <input type="number" min="0" step="0.01" className={inputCls} value={it.quantidade} onChange={(e) => updateItem(it.id, { quantidade: parseFloat(e.target.value) || 0 })} />
              </Field>
              <button type="button" onClick={() => removeItem(it.id)} disabled={itens.length === 1} className="text-xs text-clay-dark underline disabled:opacity-30 disabled:no-underline h-[38px]">remover</button>
              {artigoInput && artigoInput.stockAtual < qtdReal && (
                <p className="text-[11px] text-clay-dark sm:col-span-3 -mt-1">⚠ Vai consumir {qtdReal} de {artigoInput.artigo}, mas só há {artigoInput.stockAtual} em stock.</p>
              )}
            </div>
          );
        })}
      </div>
      <Button variant="default" onClick={addItem}>+ Adicionar artigo consumido</Button>

      {error && <p className="text-clay-dark text-xs my-3">{error}</p>}
      <div className="my-4">
        <Field label="Notas"><textarea rows={2} className={inputCls} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} label={saving ? "A guardar…" : "Registar transformação"} disabled={saving} />
    </ModalShell>
  );
}
