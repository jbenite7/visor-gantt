"use client";

export interface WarningListProps {
  warnings: string[];
  onDismiss?: () => void;
}

export default function WarningList({ warnings, onDismiss }: WarningListProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] p-3 text-sm text-[var(--aia-alert-main)]">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <p className="font-medium mb-1">Advertencias:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {warnings.map((warning, index) => (
              <li key={index} className="text-[var(--aia-alert-main)] opacity-80">
                {warning}
              </li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-[var(--radius-sm)] p-0.5 transition-colors hover:bg-[var(--color-bg-elevated)]"
            aria-label="Cerrar advertencias"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
