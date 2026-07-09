"use client";

import { AlertTriangle, X } from "lucide-react";

export interface ErrorDisplayProps {
  error: string;
  onDismiss?: () => void;
}

export default function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] p-3 text-sm text-[var(--aia-alert-main)]">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="flex-1">{error}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-[var(--radius-lg)] border border-transparent p-0.5 transition-colors hover:border-[var(--aia-alert-main)] hover:bg-[var(--color-bg-elevated)]"
          aria-label="Cerrar error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
