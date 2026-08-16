import { useState } from "react";
import { money, displaySku } from "../lib/computations";
import { WAITLIST_ESTADOS } from "../lib/constants";
import { liveItemLabel, effectiveArticleId, effectiveStock } from "../lib/liveHelpers";
import { Button, inputCls } from "./ui";

// Linha da lista de espera, usada tanto dentro de um direto (LiveDetail) como na vista
// agregada de todos os diretos (WaitlistAll). `showDireto` mostra a coluna do direto de
// origem, e `onOpenLive` navega até lá — só fazem sentido na vista agregada.
export default function WaitlistRow({
  r, live, item, articlesComputed, articleName, clientName, allArticles,
  onFazerVenda, onCancelarRegisto, onOpenSale, onMessage, onSetSubstituto, onSetEstadoEspera,
  showDireto, onOpenLive,
}) {
  const [parcial, setParcial] = useState(null);
  const [trocando, setTrocando] = useState(false);

  const articleIdEfetivo = effectiveArticleId(r, item);
  const artigoEfetivo = articlesComputed.find((a) => a.id === articleIdEfetivo);
  const disponivel = effectiveStock(r, item, articlesComputed);
  const encerrado = (r.estado_lista_espera || "Pendente") === "Encerrado — Artigo sem reposição";
  const nomeCliente = clientName ? clientName(r.client_id) : "—";

  return (
    <tr>
      {showDireto && (
        <td className="text-xs">
          <button type="button" onClick={() => onOpenLive?.(r.live_id)} className="text-ink underline decoration-line hover:decoration-rust text-left">
            {live?.codigo || live?.nome || "—"}
          </button>
        </td>
      )}
      <td className="font-mono text-stone">{r.ordem + 1}</td>
      <td className="font-medium">{nomeCliente}{r.client_id && <span title="Cliente já com ficha" className="ml-1">✓</span>}</td>
      <td className="text-xs">
        {r.artigo_substituto_id ? (
          <div>
            <div className="text-stone line-through">{item ? liveItemLabel(item, articleName) : "—"}</div>
            <div className="text-ink font-medium">🔁 {artigoEfetivo ? `${displaySku(artigoEfetivo)} — ${artigoEfetivo.artigo}` : "—"}</div>
          </div>
        ) : (
          <span>{item ? (item._conjuntoNome ? `${item._conjuntoNome} — só ${liveItemLabel(item, articleName)}` : liveItemLabel(item, articleName)) : "—"}</span>
        )}
        {!encerrado && (
          trocando ? (
            <select
              className={`${inputCls} mt-1 text-xs py-1`}
              value={r.artigo_substituto_id || ""}
              onChange={(e) => { onSetSubstituto(r.id, e.target.value || null); setTrocando(false); }}
              onBlur={() => setTrocando(false)}
              autoFocus
            >
              <option value="">— artigo original —</option>
              {allArticles.map((a) => <option key={a.id} value={a.id}>{displaySku(a)} — {a.artigo} (stock: {a.stockAtual})</option>)}
            </select>
          ) : (
            <button type="button" onClick={() => setTrocando(true)} className="text-purple-600 text-[11px] mt-0.5 block">🔁 Trocar artigo (repor com outro SKU)</button>
          )
        )}
      </td>
      <td className="font-mono text-[11px]">
        <span className={disponivel > 0 ? "text-stone" : "text-clay-dark"}>{articleIdEfetivo ? `${displaySku(artigoEfetivo)} · stock: ${disponivel}` : "—"}</span>
      </td>
      <td className="font-mono">{r.quantidade}</td>
      <td>
        <select
          className={`${inputCls} text-xs py-1`}
          value={r.estado_lista_espera || "Pendente"}
          onChange={(e) => onSetEstadoEspera(r.id, e.target.value)}
        >
          {WAITLIST_ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </td>
      <td>
        {!encerrado && artigoEfetivo && (
          disponivel >= r.quantidade ? (
            <Button onClick={() => onFazerVenda(r, item, r.quantidade)}>Fazer nova venda</Button>
          ) : disponivel > 0 ? (
            parcial === null ? (
              <Button variant="ghost" onClick={() => setParcial(disponivel)}>⚠ Só há {disponivel} de {r.quantidade} — decidir</Button>
            ) : (
              <div className="flex gap-1.5 items-center">
                <input type="number" min="0" max={disponivel} className={`${inputCls} w-14 py-1`} value={parcial} onChange={(e) => setParcial(Math.max(0, Math.min(disponivel, Number(e.target.value))))} />
                <Button variant="primary" onClick={() => onFazerVenda(r, item, parcial)}>Confirmar</Button>
              </div>
            )
          ) : (
            <span className="text-stone text-xs">Ainda sem stock</span>
          )
        )}
        {r.sale_id && (
          <button onClick={() => onOpenSale?.(r.sale_id)} className="text-sage-dark text-xs underline decoration-sage/40 hover:decoration-sage block mt-1" title="Abrir esta venda">
            ✓ venda criada — ver venda ↗
          </button>
        )}
        <div className="flex items-center gap-2 mt-1">
          {r.client_id && (
            <button onClick={onMessage} title="Enviar mensagem ao cliente" className="text-purple-600 text-xs">✉️</button>
          )}
          <button onClick={() => onCancelarRegisto(r.id)} title="Cancelar registo" className="text-stone text-xs">✕</button>
        </div>
      </td>
    </tr>
  );
}
