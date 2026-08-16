import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { getTestMode, subscribeTestMode, TABELAS_COM_MODO_TESTE } from "./testMode";

// Hook interno: devolve o modo de teste atual, e faz o componente re-renderizar sempre que
// muda (mesmo vindo de outro sítio da app, ex: o interruptor na barra lateral).
function useTestModeFlag() {
  const [mode, setMode] = useState(getTestMode());
  useEffect(() => subscribeTestMode(setMode), []);
  return mode;
}

/**
 * Lê os registos ATIVOS (não eliminados) de `table` e mantém o
 * estado sincronizado em tempo real entre a Rosa e a Rita.
 */
export function useRealtimeTable(table, orderBy = "created_at") {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const testMode = useTestModeFlag();

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .is("deleted_at", null)
      .order(orderBy, { ascending: false });
    if (!error) setAllRows(data || []);
    setLoading(false);
  }, [table, orderBy]);

  useEffect(() => {
    let active = true;
    reload();
    const channel = supabase
      .channel(`realtime:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => { if (active) reload(); })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [table, reload]);

  // Só as tabelas com Modo de Teste são filtradas — "settings" fica sempre partilhada.
  const rows = TABELAS_COM_MODO_TESTE.has(table)
    ? allRows.filter((r) => !!r.is_test === testMode)
    : allRows;

  return { rows, loading, reload };
}

/** Lê os registos ELIMINADOS de `table` — para a página Lixeira. */
export function useTrashedTable(table, orderBy = "deleted_at") {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const testMode = useTestModeFlag();

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .not("deleted_at", "is", null)
      .order(orderBy, { ascending: false });
    if (!error) setAllRows(data || []);
    setLoading(false);
  }, [table, orderBy]);

  useEffect(() => {
    let active = true;
    reload();
    const channel = supabase
      .channel(`realtime-trash:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => { if (active) reload(); })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [table, reload]);

  const rows = TABELAS_COM_MODO_TESTE.has(table)
    ? allRows.filter((r) => !!r.is_test === testMode)
    : allRows;

  return { rows, loading, reload };
}

/** Lê o histórico de alterações (tabela audit_log), mais recentes primeiro. */
export function useAuditLog(limit = 200) {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const testMode = useTestModeFlag();

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(limit);
    if (!error) setAllRows(data || []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    let active = true;
    reload();
    const channel = supabase
      .channel("realtime:audit_log")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, () => { if (active) reload(); })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [reload]);

  // O próprio audit_log não tem coluna is_test — lê-se do snapshot da linha (new_data/old_data).
  // Entradas anteriores a esta funcionalidade não têm esse campo — contam sempre como reais.
  const rows = allRows.filter((entry) => {
    if (!TABELAS_COM_MODO_TESTE.has(entry.table_name)) return true;
    const snapshot = entry.new_data || entry.old_data || {};
    return !!snapshot.is_test === testMode;
  });

  return { rows, loading };
}

/** Histórico de alterações de UM registo específico (para a Ficha completa do artigo). */
export function useAuditLogForRecord(tableName, recordId, limit = 100) {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const testMode = useTestModeFlag();

  const reload = useCallback(async () => {
    if (!recordId) { setAllRows([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("table_name", tableName)
      .eq("record_id", recordId)
      .order("changed_at", { ascending: false })
      .limit(limit);
    if (!error) setAllRows(data || []);
    setLoading(false);
  }, [tableName, recordId, limit]);

  useEffect(() => {
    let active = true;
    reload();
    const channel = supabase
      .channel(`realtime:audit_log:${tableName}:${recordId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, () => { if (active) reload(); })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [reload]);

  const rows = TABELAS_COM_MODO_TESTE.has(tableName)
    ? allRows.filter((entry) => {
        const snapshot = entry.new_data || entry.old_data || {};
        return !!snapshot.is_test === testMode;
      })
    : allRows;

  return { rows, loading };
}

export async function insertRow(table, values) {
  // Marca automaticamente o registo com o Modo de Teste atual, exceto se quem chamou já
  // tiver definido "is_test" explicitamente, e exceto nas tabelas partilhadas (ex: settings).
  const payload = TABELAS_COM_MODO_TESTE.has(table) && values.is_test === undefined
    ? { ...values, is_test: getTestMode() }
    : values;
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** "Eliminar" normal — reversível. Marca a linha, não a apaga. */
export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Traz de volta um registo eliminado. */
export async function restoreRow(table, id) {
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

/** Elimina em definitivo (só a partir da Lixeira, sem retorno possível). */
export async function hardDeleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
