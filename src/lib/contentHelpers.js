import { insertRow, updateRow } from "./useRealtimeTable";

// Guarda um item de conteúdo (publicação de artigo ou conteúdo geral), tratando a
// normalização dos campos consoante o tipo — partilhado entre o Centro de Conteúdo e o
// Calendário, para nunca divergir o comportamento entre os dois.
export async function saveContentItem(values, isNew, existingId) {
  const { isGeneral, ...clean } = values;
  if (clean.data_publicacao === "") clean.data_publicacao = null;
  if (isGeneral) clean.article_id = null;
  else { clean.titulo = null; clean.link_onedrive = null; }
  if (isNew) await insertRow("content_items", clean);
  else await updateRow("content_items", existingId, clean);
  return clean;
}
