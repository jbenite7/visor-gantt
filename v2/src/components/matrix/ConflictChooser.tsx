"use client";

import { useState } from "react";
import type { ConflictResolution, MatrixSyncConflict } from "@/types/matrix";

interface ConflictChooserProps {
  conflicts: MatrixSyncConflict[];
  onResolve: (resolutions: Record<string, ConflictResolution>) => void;
  onCancel: () => void;
}

const FIELD_LABEL: Record<MatrixSyncConflict["field"], string> = {
  name: "el nombre",
  duration: "la duración",
  start: "el inicio",
  finish: "el fin",
};

/**
 * Qué gana cuando la matriz y el Gantt dicen cosas distintas.
 *
 * Antes se resolvía en silencio con «gana el más reciente» y el usuario se
 * enteraba al ver el cronograma cambiado. Aquí se decide tarea por tarea, con
 * las dos versiones delante.
 */
export default function ConflictChooser({
  conflicts,
  onResolve,
  onCancel,
}: ConflictChooserProps) {
  const keyOf = (conflict: MatrixSyncConflict) =>
    `${conflict.taskId}::${conflict.field}`;

  const [choices, setChoices] = useState<Record<string, ConflictResolution>>(() =>
    Object.fromEntries(
      conflicts.map((conflict) => [keyOf(conflict), "matriz" as ConflictResolution]),
    ),
  );

  if (conflicts.length === 0) return null;

  return (
    <section className="apple-section space-y-3 p-3" data-testid="conflict-chooser">
      <p data-testid="conflict-summary" className="text-sm">
        {`${conflicts.length} cambios hechos en el Gantt chocan con la matriz. Elige cuál gana en cada uno.`}
      </p>

      <ul className="space-y-2">
        {conflicts.map((conflict) => {
          const key = keyOf(conflict);
          const label = FIELD_LABEL[conflict.field];
          return (
            <li
              key={key}
              data-testid={`conflict-${conflict.taskId}-${conflict.field}`}
              className="rounded-lg border border-[var(--color-hairline)] p-2 text-sm"
            >
              <p className="text-xs text-[var(--color-text-muted)]">{conflict.message}</p>
              <label className="mt-1 flex items-center gap-2">
                <input
                  type="radio"
                  name={key}
                  aria-label={`Usar lo de la matriz en ${label}`}
                  checked={choices[key] === "matriz"}
                  onChange={() => setChoices({ ...choices, [key]: "matriz" })}
                />
                <span>{`Matriz: ${conflict.matrixValue}`}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={key}
                  aria-label={`Conservar lo del Gantt en ${label}`}
                  checked={choices[key] === "gantt"}
                  onChange={() => setChoices({ ...choices, [key]: "gantt" })}
                />
                <span>{`Gantt: ${conflict.ganttValue}`}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <button type="button" onClick={() => onResolve(choices)}>
          Aplicar con estas decisiones
        </button>
        <button type="button" onClick={onCancel}>
          No aplicar
        </button>
      </div>
    </section>
  );
}
