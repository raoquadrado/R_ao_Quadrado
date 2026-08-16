import { useState, useMemo } from "react";
import { preencherTemplate, whatsappLink } from "../lib/computations";
import { useToast } from "../lib/overlays";
import { ModalShell, Button, inputCls } from "./ui";

// Modal reutilizável para compor e enviar (copiar / WhatsApp) uma mensagem a um cliente,
// a partir dos modelos definidos no módulo de Comunicação. `dados` são os valores
// disponíveis para preencher as variáveis {{...}} do modelo (cliente, artigo, valor, etc.)
// — o que não se aplicar ao contexto fica simplesmente vazio no texto.
export default function MessageComposer({ templates, dados, telefone, defaultTemplateId, onClose }) {
  const ativos = (templates || []).filter((t) => t.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const [templateId, setTemplateId] = useState(defaultTemplateId || ativos[0]?.id || "");
  const templateAtual = ativos.find((t) => t.id === templateId);
  const [texto, setTexto] = useState(() => preencherTemplate(templateAtual?.corpo, dados));
  const notify = useToast();

  function escolherTemplate(id) {
    setTemplateId(id);
    const t = ativos.find((x) => x.id === id);
    setTexto(preencherTemplate(t?.corpo, dados));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      notify("Mensagem copiada.");
      return;
    } catch {
      // API de clipboard bloqueada (ex.: contexto restrito) — tenta o método alternativo abaixo
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) { notify("Mensagem copiada."); return; }
    } catch {
      // cai no aviso abaixo
    }
    notify("Não foi possível copiar automaticamente — seleciona o texto na caixa e usa Ctrl/⌘+C.", "error");
  }

  const link = whatsappLink(telefone, texto);

  return (
    <ModalShell title="Enviar mensagem" subtitle="Escolhe a situação, confirma o texto (podes editar) e copia ou abre no WhatsApp." onClose={onClose} wide>
      {ativos.length === 0 ? (
        <p className="text-stone text-sm">Ainda não há modelos de mensagem ativos — cria um em "💬 Comunicação".</p>
      ) : (
        <>
          <div className="mb-3">
            <label className="flex flex-col gap-1 text-xs text-stone">
              Situação
              <select className={inputCls} value={templateId} onChange={(e) => escolherTemplate(e.target.value)}>
                {ativos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
          </div>
          <div className="mb-4">
            <label className="flex flex-col gap-1 text-xs text-stone">
              Mensagem (editável)
              <textarea rows={6} className={inputCls} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </label>
          </div>
          {!telefone && (
            <p className="text-stone text-xs mb-3">Sem telefone guardado neste cliente — só é possível copiar a mensagem (o botão de WhatsApp precisa de um nº de telefone).</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
            <div className="flex gap-2">
              <Button onClick={copiar}>📋 Copiar mensagem</Button>
              {link && (
                <Button variant="primary" onClick={() => window.open(link, "_blank", "noopener,noreferrer")}>💬 Abrir WhatsApp</Button>
              )}
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}
