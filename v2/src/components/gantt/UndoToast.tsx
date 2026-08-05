"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { LastAction } from "@/lib/state/ProjectContext";

const VISIBLE_MS = 8000;

interface UndoToastProps {
  action: LastAction | null;
  onUndo: () => void;
  locale?: "es" | "en";
}

/**
 * Anuncia la última acción deshacible y ofrece el atajo para revertirla.
 * Sustituye a la confirmación previa al borrado: se actúa primero y se puede volver atrás.
 */
export default function UndoToast({ action, onUndo, locale = "es" }: UndoToastProps) {
  // Se guarda el token ya descartado en vez de un booleano, para que una acción
  // nueva vuelva a mostrar el aviso sin necesidad de reiniciar estado en un efecto.
  const [dismissedToken, setDismissedToken] = useState<number | null>(null);
  const visible = action !== null && action.token !== dismissedToken;

  useEffect(() => {
    if (!visible || !action) return;
    const timer = setTimeout(() => setDismissedToken(action.token), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, action]);

  if (!action || !visible) return null;

  return (
    <div className="gantt-undo-toast" role="status" aria-live="polite">
      <span>{action.description}</span>
      <button
        type="button"
        className="gantt-undo-toast-action"
        onClick={() => {
          onUndo();
          setDismissedToken(action.token);
        }}
      >
        <RotateCcw size={14} aria-hidden />
        {locale === "en" ? "Undo" : "Deshacer"}
      </button>
      <button
        type="button"
        className="gantt-undo-toast-dismiss"
        onClick={() => setDismissedToken(action.token)}
        aria-label={locale === "en" ? "Dismiss" : "Cerrar aviso"}
      >
        ×
      </button>
    </div>
  );
}
