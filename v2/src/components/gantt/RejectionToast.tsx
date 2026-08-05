"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { LastRejection } from "@/lib/state/ProjectContext";

const VISIBLE_MS = 10000;

interface RejectionToastProps {
  rejection: LastRejection | null;
  locale?: "es" | "en";
}

/**
 * Explica por qué una edición no se aplicó, en la misma pantalla donde se hizo.
 * Antes estos rechazos solo eran visibles abriendo la vista "Cuellos".
 */
export default function RejectionToast({
  rejection,
  locale = "es",
}: RejectionToastProps) {
  const [dismissedToken, setDismissedToken] = useState<number | null>(null);
  const visible = rejection !== null && rejection.token !== dismissedToken;

  useEffect(() => {
    if (!visible || !rejection) return;
    const timer = setTimeout(() => setDismissedToken(rejection.token), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, rejection]);

  if (!rejection || !visible) return null;

  return (
    <div
      className="gantt-rejection-toast"
      role="alert"
      data-testid="gantt-rejection-toast"
    >
      <AlertTriangle size={16} aria-hidden />
      <span className="gantt-rejection-toast__text">
        <strong>
          {locale === "en" ? "Change not applied" : "El cambio no se aplicó"}
        </strong>
        <span>
          {rejection.reason}
          {rejection.detail ? ` ${rejection.detail}` : ""}
        </span>
      </span>
      <button
        type="button"
        className="gantt-rejection-toast__dismiss"
        onClick={() => setDismissedToken(rejection.token)}
        aria-label={locale === "en" ? "Dismiss" : "Cerrar aviso"}
      >
        ×
      </button>
    </div>
  );
}
