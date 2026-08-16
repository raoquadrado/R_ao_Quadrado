import { APP_VERSION, APP_RELEASE_DATE, APP_CHANGELOG } from "../lib/constants";
import { fmtDate } from "../lib/computations";
import { ModalShell } from "./ui";
import Logo from "./Logo";

export default function AboutModal({ onClose }) {
  return (
    <ModalShell title="Sobre" onClose={onClose}>
      <div className="flex flex-col items-center text-center mb-5">
        <Logo size="sm" />
        <p className="text-stone text-xs mt-2">Gestão de fornecedores, artigos, compras, clientes, vendas, trocas, diretos e comunicação.</p>
      </div>

      <div className="bg-paper rounded-lg p-4 mb-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-stone">Versão</span>
          <span className="font-mono font-medium">{APP_VERSION}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-stone">Lançada em</span>
          <span className="font-medium">{fmtDate(APP_RELEASE_DATE)}</span>
        </div>
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">Notas de versão</h3>
      <div className="flex flex-col gap-3 mb-2 max-h-64 overflow-y-auto">
        {APP_CHANGELOG.map((v) => (
          <div key={v.versao} className="border-l-2 border-line pl-3">
            <div className="text-xs font-mono text-stone mb-0.5">v{v.versao} · {fmtDate(v.data)}</div>
            <p className="text-sm text-ink">{v.notas}</p>
          </div>
        ))}
      </div>

      <a href="/manual-utilizador.pdf" target="_blank" rel="noreferrer" className="text-purple-600 text-xs underline block mt-4">
        📖 Consultar o Manual de Utilizador
      </a>
    </ModalShell>
  );
}
