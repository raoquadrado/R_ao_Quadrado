import { useState } from "react";
import { supabase } from "../supabaseClient";
import Logo from "./Logo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Email ou palavra-passe incorretos.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-line rounded-xl p-8 shadow-sm">
        <div className="mb-6">
          <Logo size="lg" showTagline />
          <p className="text-stone text-sm mt-3">Inicia sessão para gerir o negócio.</p>
        </div>

        <label className="block text-xs text-stone mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
        />

        <label className="block text-xs text-stone mb-1">Palavra-passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
        />

        {error && <p className="text-clay-dark text-xs mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-rust text-white text-sm font-medium py-2.5 rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "A entrar…" : "Entrar"}
        </button>

        <p className="text-stone text-xs mt-5">
          As contas (Rosa e Rita) são criadas manualmente no painel do Supabase — não há registo público. Vê o guia de configuração.
        </p>
      </form>
    </div>
  );
}
