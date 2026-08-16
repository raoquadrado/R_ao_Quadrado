import { supabase } from "../supabaseClient";

const BUCKET = "article-photos";
const LOGO_BUCKET = "brand-assets";

function resizeImageToBlob(file, maxWidth = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao converter a imagem."))), "image/jpeg", quality);
      };
      img.onerror = () => reject(new Error("Ficheiro de imagem inválido."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensiona e envia a foto de um artigo para o Supabase Storage.
 * Devolve o URL público, pronto a guardar em articles.foto_url.
 */
export async function uploadArticlePhoto(file, articleId) {
  const blob = await resizeImageToBlob(file);
  const path = `${articleId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Remove a foto do Storage a partir do seu URL público (silencioso se falhar). */
export async function deleteArticlePhoto(url) {
  if (!url) return;
  try {
    const marker = `/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // não bloqueia a UI se a remoção falhar (ex: já não existia)
  }
}

/**
 * Redimensiona e envia o logótipo da marca para o Supabase Storage (bucket próprio,
 * separado das fotos de artigos). Devolve o URL público, pronto a guardar em
 * settings.logo_url.
 */
export async function uploadLogo(file) {
  const blob = await resizeImageToBlob(file, 400, 0.9);
  const path = `logo-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
