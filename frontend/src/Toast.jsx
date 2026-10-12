import { createContext, useCallback, useContext, useState, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONO = { exito: CheckCircle2, advertencia: AlertTriangle, error: XCircle };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const quitar = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const mostrar = (texto, tipo = 'exito', ms = 4000) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, texto, tipo }]);
    if (ms > 0) setTimeout(() => quitar(id), ms);
  };

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => {
          const Icono = ICONO[t.tipo] || CheckCircle2;
          return (
            <div key={t.id} className={`toast toast-${t.tipo}`} role="status">
              <Icono size={18} className="toast-icono" aria-hidden />
              <span className="toast-texto">{t.texto}</span>
              <button type="button" className="toast-cerrar" onClick={() => quitar(t.id)} aria-label="Cerrar">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx.mostrar;
}
