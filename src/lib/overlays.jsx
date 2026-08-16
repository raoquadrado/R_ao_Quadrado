import { createContext, useCallback, useContext, useRef, useState } from "react";

// ---------------------------------------------------------------- Toasts ----
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const notify = useCallback((message, kind = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium text-white animate-[fadeInUp_0.2s_ease-out] ${
              t.kind === "error" ? "bg-clay-dark" : t.kind === "info" ? "bg-ink" : "bg-sage-dark"
            }`}
          >
            <span>{t.kind === "error" ? "⚠" : t.kind === "info" ? "ℹ" : "✓"}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// -------------------------------------------------------------- Confirm ----
const ConfirmContext = createContext(() => Promise.resolve(false));

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmLabel, danger, resolve }

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        title: opts?.title || "Confirmas?",
        message: opts?.message || "Esta ação não pode ser desfeita.",
        confirmLabel: opts?.confirmLabel || "Confirmar",
        danger: opts?.danger !== false,
        resolve,
      });
    });
  }, []);

  function close(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div onClick={() => close(false)} className="fixed inset-0 bg-ink/45 flex items-center justify-center z-[110] p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-paper rounded-xl p-5 w-full max-w-sm shadow-2xl">
            <h2 className="font-display text-base font-semibold mb-1.5">{state.title}</h2>
            <p className="text-sm text-stone mb-5">{state.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => close(false)} className="text-sm font-medium px-3.5 py-2 rounded-md bg-transparent text-stone">Cancelar</button>
              <button
                onClick={() => close(true)}
                className={`text-sm font-medium px-3.5 py-2 rounded-md text-white ${state.danger ? "bg-clay-dark" : "bg-rust"}`}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
