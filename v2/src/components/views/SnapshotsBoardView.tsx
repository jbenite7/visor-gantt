"use client";

import { useCallback, useMemo, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import type {
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SnapshotOrigin,
} from "@/types/snapshot";
import { compareSnapshotToTasks } from "@/lib/scheduling/snapshots";
import { formatProjectDate } from "@/lib/date/projectDate";

const ORIGIN_LABEL: Record<SnapshotOrigin, string> = {
  import: "Importación",
  manual: "Corte marcado",
  baseline: "Línea base",
};

const KIND_LABEL = {
  atrasada: "Se atrasó",
  adelantada: "Se adelantó",
  sinCambio: "Igual",
  nueva: "Nueva",
  eliminada: "Ya no está",
} as const;

export interface SnapshotsBoardViewProps {
  tasks: GanttTask[];
  summaries: ProjectSnapshotSummary[];
  isLoading: boolean;
  loadSnapshot: (snapshotId: string) => Promise<ProjectSnapshot | null>;
  onMarkSnapshot: (name: string) => void;
}

function shiftLabel(days: number): string {
  if (days === 0) return "—";
  return days > 0 ? `+${days} d` : `${days} d`;
}

export default function SnapshotsBoardView({
  tasks,
  summaries,
  isLoading,
  loadSnapshot,
  onMarkSnapshot,
}: SnapshotsBoardViewProps) {
  const [selected, setSelected] = useState<ProjectSnapshot | null>(null);
  const [markName, setMarkName] = useState("");

  const handleSelect = useCallback(
    async (snapshotId: string) => {
      const snapshot = await loadSnapshot(snapshotId);
      setSelected(snapshot);
    },
    [loadSnapshot],
  );

  const comparison = useMemo(
    () => (selected ? compareSnapshotToTasks(selected, tasks) : null),
    [selected, tasks],
  );

  // La tabla solo enseña lo que cambió: las que no se movieron ya están
  // resumidas en el contador. Mostrarlas todas convertiría un vistazo útil
  // en una lista de cientos de filas repitiendo "Igual".
  const movedChanges = useMemo(
    () => comparison?.changes.filter((change) => change.kind !== "sinCambio") ?? [],
    [comparison],
  );

  return (
    <div data-testid="snapshots-board" className="apple-module flex h-full flex-col">
      <div className="apple-module-header px-5 py-4">
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Historial de cortes
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8rem",
            color: "var(--color-text-muted)",
            margin: "2px 0 0",
          }}
        >
          Compara el plan de hoy contra cualquier versión anterior del cronograma
        </p>
      </div>

      <div className="apple-subtoolbar flex-wrap gap-2">
        <input
          data-testid="snapshots-board-mark-name"
          value={markName}
          onChange={(event) => setMarkName(event.target.value)}
          placeholder="Nombre del corte, p. ej. «Corte de obra de enero»"
          className="apple-input"
          style={{ minWidth: 260 }}
        />
        <button
          data-testid="snapshots-board-mark"
          type="button"
          className="apple-button"
          onClick={() => {
            const name = markName.trim();
            if (!name) return;
            onMarkSnapshot(name);
            setMarkName("");
          }}
        >
          Marcar corte
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Cargando el historial de cortes…
          </p>
        ) : summaries.length === 0 ? (
          <div data-testid="snapshots-board-empty" className="apple-empty-state">
            <p>
              Todavía no hay ningún corte guardado. Cada vez que importas un
              archivo de Microsoft Project se guarda una foto del cronograma sin
              que tengas que acordarte, y puedes marcar un corte a mano —con
              nombre propio— para los hitos que importan.
            </p>
          </div>
        ) : (
          <>
            <ul data-testid="snapshots-board-list" className="mb-4 grid gap-2">
              {summaries.map((summary) => (
                <li key={summary.id}>
                  <button
                    type="button"
                    className="apple-section w-full px-3 py-2 text-left"
                    onClick={() => {
                      void handleSelect(summary.id);
                    }}
                  >
                    <span className="text-sm font-semibold text-[var(--color-text-strong)]">
                      {summary.name}
                    </span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                      {formatProjectDate(summary.capturedAt)} ·{" "}
                      {ORIGIN_LABEL[summary.origin]} · {summary.taskCount} actividades
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {comparison && (
              <section data-testid="snapshots-board-comparison" className="apple-section p-3">
                <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                  {comparison.delayedCount} atrasada(s) · {comparison.aheadCount}{" "}
                  adelantada(s) · {comparison.addedCount} nueva(s) ·{" "}
                  {comparison.removedCount} eliminada(s) · {comparison.unchangedCount}{" "}
                  sin cambios
                </p>
                {movedChanges.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    El plan no se ha movido desde ese corte: todas las
                    actividades siguen donde estaban.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[var(--color-text-muted)]">
                        <th>Actividad</th>
                        <th>Estado</th>
                        <th>Inicio</th>
                        <th>Fin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movedChanges.map((change) => (
                        <tr key={String(change.taskId)}>
                          <td>{change.taskName}</td>
                          <td>{KIND_LABEL[change.kind]}</td>
                          <td>{shiftLabel(change.startShiftDays)}</td>
                          <td>{shiftLabel(change.finishShiftDays)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
