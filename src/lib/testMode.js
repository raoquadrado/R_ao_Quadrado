// Modo de Teste: um interruptor global que faz a app trabalhar sobre um "sandbox" de dados
// (marcados com is_test = true), em vez dos dados reais — sem ser preciso mudar nada nos
// sítios onde a app cria/lê registos. Vive fora do React de propósito, para que
// useRealtimeTable.js (o "data layer") possa consultá-lo diretamente, e qualquer componente
// possa subscrever-se a mudanças com useTestMode().

const STORAGE_KEY = "r2_test_mode";

let current = false;
const listeners = new Set();

// Tabelas que têm coluna is_test (settings fica sempre partilhada entre os dois modos, de
// propósito — os limiares/definições não fazem sentido duplicados).
export const TABELAS_COM_MODO_TESTE = new Set([
  "suppliers", "articles", "purchases", "clients", "sales", "content_items",
  "tasks", "lives", "live_registos", "message_templates", "exchanges", "marketing_dates",
]);

export function getTestMode() {
  return current;
}

export function setTestMode(value) {
  current = !!value;
  try { localStorage.setItem(STORAGE_KEY, current ? "1" : "0"); } catch { /* ignora, ex: modo privado */ }
  listeners.forEach((fn) => fn(current));
}

export function subscribeTestMode(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Chamar uma vez, cedo (ex: no topo do App.jsx), para carregar a preferência guardada.
export function initTestMode() {
  try {
    current = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    current = false;
  }
  return current;
}
