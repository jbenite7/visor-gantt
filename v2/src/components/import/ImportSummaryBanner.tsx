"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import WarningList from "@/components/upload/WarningList";
import {
  formatImportSummary,
  type ImportSummary,
} from "@/lib/import/importSummary";

interface ImportSummaryBannerProps {
  summary: ImportSummary | null;
}

/** Cierra el viaje de la importación: qué entró de verdad al cronograma. */
export default function ImportSummaryBanner({ summary }: ImportSummaryBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  if (!summary || dismissed) return null;

  const descartadas = summary.discardedColumns;

  return (
    <div className="import-summary-banner" role="status">
      <CheckCircle2 size={16} aria-hidden />
      <span>{formatImportSummary(summary)}</span>

      {descartadas.length > 0 && (
        <button
          type="button"
          data-testid="import-warnings-toggle"
          onClick={() => setShowWarnings((visible) => !visible)}
          className="import-summary-banner__warnings-toggle"
        >
          Ver las {descartadas.length} columnas que no se importaron
        </button>
      )}

      {showWarnings && (
        <div data-testid="import-warnings" className="import-summary-banner__warnings">
          <WarningList
            warnings={descartadas}
            onDismiss={() => setShowWarnings(false)}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Cerrar el resumen"
        className="import-summary-banner__dismiss"
      >
        ×
      </button>
    </div>
  );
}
