// Helpers partilhados entre LiveDetail.jsx e WaitlistAll.jsx para resolver itens de um
// direto (artigo/conjunto/peça individual dentro de um conjunto) e o respetivo stock.

// resolve um live_item_id — pode ser um item normal (artigo/conjunto), ou uma peça
// individual dentro de um conjunto, codificada como "conjuntoId::articleId"
export function resolveLiveItem(live, liveItemId) {
  if (!live || !liveItemId) return null;
  if (liveItemId.includes("::")) {
    const [conjId, artId] = liveItemId.split("::");
    const conj = (live.itens || []).find((i) => i.id === conjId);
    if (!conj) return null;
    return { id: liveItemId, tipo: "artigo", article_ids: [artId], nome: "", preco_direto: null, _conjuntoNome: conj.nome };
  }
  return (live.itens || []).find((i) => i.id === liveItemId) || null;
}

export function liveItemLabel(item, articleName) {
  if (!item) return "—";
  if (item.tipo === "conjunto") return item.nome || `Conjunto (${item.article_ids.length} peças)`;
  return articleName(item.article_ids[0]);
}

export function liveItemStock(item, articlesComputed) {
  if (!item || !item.article_ids?.length) return 0;
  return Math.min(...item.article_ids.map((aid) => articlesComputed.find((a) => a.id === aid)?.stockAtual ?? 0));
}

// Artigo efetivamente a usar para um registo em lista de espera — o substituto, se
// tiver sido escolhido um (reposição com outro SKU), ou o artigo original do item.
export function effectiveArticleId(registo, item) {
  return registo?.artigo_substituto_id || item?.article_ids?.[0] || null;
}

export function effectiveStock(registo, item, articlesComputed) {
  const articleId = effectiveArticleId(registo, item);
  if (!articleId) return 0;
  return articlesComputed.find((a) => a.id === articleId)?.stockAtual ?? 0;
}
