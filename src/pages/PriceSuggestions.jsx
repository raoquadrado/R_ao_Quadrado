import { useState } from "react";
import { gerarSugestoesPreco, NIVEL_LABEL, NIVEL_COLORS } from "../lib/priceSuggestions";
import { displaySku } from "../lib/computations";
import { Badge, SearchBox, EmptyRow } from "../components/ui";

export default function PriceSuggestions({ articlesComputed, sales, settings, onOpenArticle }) {
  const [q, setQ] = useState("");
  const [nivelFiltro, setNivelFiltro] = useState("todos");

  const sugestoes = gerarSugestoesPreco(articlesComputed, sales, settings);
  const filtradas = sugestoes
    .filter((s) => nivelFiltro === "todos" || s.nivel === nivelFiltro)
    .filter((s) => ((s.article.artigo || "") + displaySku(s.article)).toLowerCase().includes(q.toLowerCase()));

  const contagens = {
    vermelho: sugestoes.filter((s) => s.nivel === "vermelho").length,
    amarelo: sugestoes.filter((s) => s.nivel === "amarelo").length,
    verde: sugestoes.filter((s) => s.nivel === "verde").length,
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold mb-0.5">💰 Sugestões de Preço</h1>
        <p className="text-stone text-sm">
          Analisa margem, tempo em stock, quantidade e vendas de cada artigo, e sugere se vale a pena manter o preço, promover ou liquidar. São regras simples e explicáveis — a decisão final é sempre vossa.
        </p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: "todos", label: `Todos (${sugestoes.length})` },
          { key: "vermelho", label: `🔴 Liquidar (${contagens.vermelho})` },
          { key: "amarelo", label: `🟡 Promover (${contagens.amarelo})` },
          { key: "verde", label: `🟢 Manter (${contagens.verde})` },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setNivelFiltro(f.key)}
            className={`text-xs font-medium rounded-full px-3.5 py-1.5 border ${nivelFiltro === f.key ? "bg-ink text-white border-ink" : "bg-white text-ink border-line"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SearchBox value={q} onChange={setQ} placeholder="Procurar por SKU ou nome…" />

      <div className="bg-white border border-line rounded-xl overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Artigo</th><th>Stock</th><th>Dias em stock</th><th>Vendas</th><th>Margem</th><th>Sugestão</th><th>Porquê</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && <EmptyRow span={7} text="Sem artigos nesta categoria." />}
            {filtradas.map((s) => {
              const nc = NIVEL_COLORS[s.nivel];
              return (
                <tr key={s.article.id}>
                  <td>
                    <button type="button" onClick={() => onOpenArticle(s.article.id)} className="font-medium text-ink underline decoration-line hover:decoration-rust text-left">
                      {displaySku(s.article) ? `${displaySku(s.article)} — ${s.article.artigo}` : s.article.artigo}
                    </button>
                  </td>
                  <td className="font-mono">{s.article.stockAtual}</td>
                  <td className="font-mono">{s.dias}</td>
                  <td className="font-mono">{s.vendas}</td>
                  <td className="font-mono">{(s.article.margemPct ?? 0).toFixed(0)}%</td>
                  <td><Badge text={NIVEL_LABEL[s.nivel]} color={nc.color} bg={nc.bg} /></td>
                  <td className="text-stone text-xs max-w-[280px] whitespace-normal">{s.texto}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
