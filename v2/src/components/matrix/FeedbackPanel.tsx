"use client";

import type { MatrixPlan } from "@/types/matrix";
import { listPendingFeedback } from "@/lib/matrix/feedback";
import { getAreaLeaves, getScopeLeaves } from "@/lib/matrix/tree";

interface FeedbackPanelProps {
  plan: MatrixPlan;
  onApprove: (cellId: string) => void;
  onDismiss: (cellId: string) => void;
}

/**
 * Los rendimientos que la obra sacó de verdad, esperando visto bueno.
 *
 * La app ya los calculaba y nadie los veía. Aprobar uno cierra el ciclo: la
 * próxima torre se programa con los datos de la anterior.
 */
export default function FeedbackPanel({
  plan,
  onApprove,
  onDismiss,
}: FeedbackPanelProps) {
  const pending = listPendingFeedback(plan);
  const scopeName = new Map(
    getScopeLeaves(plan.scopeTree).map((leaf) => [leaf.node.id, leaf.node.name]),
  );
  const areaName = new Map(
    getAreaLeaves(plan.areas).map((leaf) => [leaf.node.id, leaf.node.name]),
  );

  if (pending.length === 0) {
    return (
      <section className="apple-section p-3" data-testid="feedback-panel">
        <p data-testid="feedback-empty" className="text-sm text-[var(--color-text-muted)]">
          Aún no hay rendimientos observados. Aparecerán cuando se reporte avance real
          sobre las tareas que generó la matriz.
        </p>
      </section>
    );
  }

  return (
    <section className="apple-section space-y-2 p-3" data-testid="feedback-panel">
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
        Rendimientos observados en obra
      </h3>
      <ul className="space-y-2">
        {pending.map((item) => (
          <li
            key={item.cellId}
            data-testid={`feedback-item-${item.cellId}`}
            className="rounded-lg border border-[var(--color-hairline)] p-2 text-sm"
          >
            <p className="font-semibold text-[var(--color-text-strong)]">
              {`${scopeName.get(item.scopeId) ?? item.scopeId} · ${areaName.get(item.areaId) ?? item.areaId}`}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{item.message}</p>
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => onApprove(item.cellId)}>
                Usar el rendimiento real
              </button>
              <button type="button" onClick={() => onDismiss(item.cellId)}>
                Mantener lo planificado
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
