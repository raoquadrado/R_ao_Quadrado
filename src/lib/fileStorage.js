import { supabase } from "../supabaseClient";

const BUCKET = "documents";

/**
 * Envia um documento (PDF ou imagem) para o Supabase Storage.
 * `folder` organiza por tipo, ex: "purchases/<id>" ou "sales/<id>/fatura".
 * Devolve o URL público, pronto a guardar na base de dados.
 */
export async function uploadDocument(file, folder) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Remove um documento do Storage a partir do seu URL público (silencioso se falhar). */
export async function deleteDocument(url) {
  if (!url) return;
  try {
    const marker = `/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // não bloqueia a UI se a remoção falhar
  }
}
