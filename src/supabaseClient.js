import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Cria um ficheiro .env a partir de .env.example."
  );
}

export const supabase = createClient(url, anonKey);
