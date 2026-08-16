import { supabase } from "../supabaseClient";
import { TABELAS_COM_MODO_TESTE } from "./testMode";

// Tabelas incluídas na cópia de segurança — dados de negócio only. Fica de fora o
// `audit_log` (é só um registo histórico, não dados a restaurar) e o `sku_counters`
// (gerado automaticamente pela app, não precisa de cópia).
export const TABELAS_BACKUP = [
  "suppliers", "articles", "purchases", "clients", "sales",
  "content_items", "lives", "live_registos", "message_templates",
  "exchanges", "tasks", "settings", "marketing_dates",
];

// Lê todas as tabelas (só registos ativos, não os já eliminados, e só dados REAIS — nunca
// dados do Modo de Teste) e devolve um objeto pronto a descarregar como JSON.
export async function gerarCopiaSeguranca() {
  const resultado = { gerado_em: new Date().toISOString(), versao: 1, app: "R²", tabelas: {} };
  for (const tabela of TABELAS_BACKUP) {
    let query = supabase.from(tabela).select("*").is("deleted_at", null);
    if (TABELAS_COM_MODO_TESTE.has(tabela)) query = query.eq("is_test", false);
    const { data, error } = await query;
    if (error) throw new Error(`Erro ao ler "${tabela}": ${error.message}`);
    resultado.tabelas[tabela] = data || [];
  }
  return resultado;
}

// Dispara o download de um objeto como ficheiro .json no browser.
export function descarregarJSON(objeto, nomeFicheiro) {
  const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Restaura os dados de uma cópia de segurança gerada por gerarCopiaSeguranca(). Faz
// "upsert" por id — um registo do ficheiro com o mesmo id de um já existente substitui-o;
// um id novo é acrescentado. Nunca apaga registos que não estejam no ficheiro.
export async function restaurarCopiaSeguranca(objeto, onProgress) {
  if (!objeto || typeof objeto !== "object" || !objeto.tabelas) {
    throw new Error("Ficheiro inválido — não parece ser uma cópia de segurança desta aplicação.");
  }
  for (const tabela of Object.keys(objeto.tabelas)) {
    if (!TABELAS_BACKUP.includes(tabela)) continue; // ignora nomes de tabela desconhecidos, por segurança
    const linhas = objeto.tabelas[tabela];
    if (!Array.isArray(linhas) || linhas.length === 0) continue;
    onProgress?.(tabela);
    // em lotes, para não ultrapassar limites de tamanho de pedido
    for (let i = 0; i < linhas.length; i += 200) {
      const lote = linhas.slice(i, i + 200);
      const { error } = await supabase.from(tabela).upsert(lote, { onConflict: "id" });
      if (error) throw new Error(`Erro ao restaurar "${tabela}": ${error.message}`);
    }
  }
}
