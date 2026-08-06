"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
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
  if (!summary || dismissed) return null;

  return (
    <div className="import-summary-banner" role="status">
      <CheckCircle2 size={16} aria-hidden />
      <span>{formatImportSummary(summary)}</span>
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
