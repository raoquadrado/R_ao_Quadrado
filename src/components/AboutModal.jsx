import { APP_VERSION, APP_RELEASE_DATE, APP_CHANGELOG } from "../lib/constants";
import { fmtDate } from "../lib/computations";
import { ModalShell } from "./ui";
import Logo from "./Logo";

// Agrupa o changelog por data, mantendo a ordem (mais recente primeiro) já definida na
// própria lista — cada grupo vira uma secção com a data como título.
function agruparPorData(changelog) {
  const grupos = [];
  changelog.forEach((entrada) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === entrada.data) ultimo.itens.push(entrada);
    else grupos.push({ data: entrada.data, itens: [entrada] });
  });
  return grupos;
}

export default function AboutModal({ onClose }) {
  const ultimaAtualizacao = APP_CHANGELOG[0]?.data || APP_RELEASE_DATE;
  const grupos = agruparPorData(APP_CHANGELOG);

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
        <div className="flex justify-between py-1">
          <span className="text-stone">Última atualização</span>
          <span className="font-medium">{fmtDate(ultimaAtualizacao)}</span>
        </div>
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">Histórico de alterações</h3>
      <div className="flex flex-col gap-4 mb-2 max-h-72 overflow-y-auto pr-1">
        {grupos.map((grupo) => (
          <div key={grupo.data}>
            <div className="text-xs font-mono font-medium text-plum mb-1.5">{fmtDate(grupo.data)}</div>
            <div className="flex flex-col gap-2">
              {grupo.itens.map((entrada, i) => (
                <div key={i} className="border-l-2 border-line pl-3">
                  <div className="text-sm font-medium text-ink">
                    {entrada.titulo}
                    {entrada.hora && <span className="text-xs font-mono font-normal text-stone ml-1.5">· {entrada.hora}</span>}
                  </div>
                  {entrada.notas && <p className="text-xs text-stone mt-0.5">{entrada.notas}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <a href="/manual-utilizador.pdf" target="_blank" rel="noreferrer" className="text-purple-600 text-xs underline block mt-4">
        📖 Consultar o Manual de Utilizador
      </a>
    </ModalShell>
  );
}
