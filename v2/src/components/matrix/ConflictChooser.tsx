"use client";

import { useState } from "react";
import type { ConflictResolution, MatrixSyncConflict } from "@/types/matrix";

interface ConflictChooserProps {
  conflicts: MatrixSyncConflict[];
  onResolve: (resolutions: Record<string, ConflictResolution>) => void;
  onCancel: () => void;
}

const SCHEDULE_FIELDS: MatrixSyncConflict["field"][] = ["duration", "start", "finish"];

const FIELD_LABEL: Record<MatrixSyncConflict["field"], string> = {
  name: "el nombre",
  duration: "Duración",
  start: "Inicio",
  finish: "Fin",
};

interface TaskGroup {
  taskId: string | number;
  nameConflict?: MatrixSyncConflict;
  scheduleConflicts: MatrixSyncConflict[];
}

/**
 * Qué gana cuando la matriz y el Gantt dicen cosas distintas.
 *
 * Antes se resolvía en silencio con «gana el más reciente» y el usuario se
 * enteraba al ver el cronograma cambiado. Aquí se decide tarea por tarea, con
 * las dos versiones delante.
 *
 * El motor (`applyMatrixUpdate`) resuelve inicio, fin y duración como un solo
 * bloque: describen una sola cosa y mezclarlas produce una tarea que dice dos
 * cosas distintas sobre sí misma. Por eso los tres conflictos de horario de
 * una tarea se muestran juntos y se deciden con una sola elección, que se
 * emite para las tres claves.
 */
export default function ConflictChooser({
  conflicts,
  onResolve,
  onCancel,
}: ConflictChooserProps) {
  const [choices, setChoices] = useState<Record<string, ConflictResolution>>({});

  if (conflicts.length === 0) return null;

  const nameKeyOf = (taskId: string | number) => `${taskId}::name`;
  const scheduleKeyOf = (taskId: string | number) => `${taskId}::schedule`;

  const getChoice = (key: string): ConflictResolution => choices[key] ?? "matriz";

  const groups: TaskGroup[] = [];
  const groupIndexByTaskId = new Map<string | number, number>();
  for (const conflict of conflicts) {
    let index = groupIndexByTaskId.get(conflict.taskId);
    if (index === undefined) {
      index = groups.length;
      groupIndexByTaskId.set(conflict.taskId, index);
      groups.push({ taskId: conflict.taskId, scheduleConflicts: [] });
    }
    if (conflict.field === "name") {
      groups[index].nameConflict = conflict;
    } else {
      groups[index].scheduleConflicts.push(conflict);
    }
  }

  const decisionCount = groups.reduce(
    (count, group) =>
      count + (group.nameConflict ? 1 : 0) + (group.scheduleConflicts.length > 0 ? 1 : 0),
    0,
  );

  const setChoice = (key: string, value: ConflictResolution) =>
    setChoices((current) => ({ ...current, [key]: value }));

  const handleResolve = () => {
    const resolutions: Record<string, ConflictResolution> = {};
    for (const group of groups) {
      if (group.nameConflict) {
        resolutions[`${group.taskId}::name`] = getChoice(nameKeyOf(group.taskId));
      }
      if (group.scheduleConflicts.length > 0) {
        const resolution = getChoice(scheduleKeyOf(group.taskId));
        for (const conflict of group.scheduleConflicts) {
          resolutions[`${group.taskId}::${conflict.field}`] = resolution;
        }
      }
    }
    onResolve(resolutions);
  };

  return (
    <section className="apple-section space-y-3 p-3" data-testid="conflict-chooser">
      <p data-testid="conflict-summary" className="text-sm">
        {`${decisionCount} cambios hechos en el Gantt chocan con la matriz. Elige cuál gana en cada uno.`}
      </p>

      <ul className="space-y-2">
        {groups.map((group) => (
          <li key={group.taskId} className="space-y-2">
            {group.nameConflict && (
              <div
                data-testid={`conflict-${group.taskId}-name`}
                className="rounded-lg border border-[var(--color-hairline)] p-2 text-sm"
              >
                <p className="text-xs text-[var(--color-text-muted)]">
                  {group.nameConflict.message}
                </p>
                <label className="mt-1 flex items-center gap-2">
                  <input
                    type="radio"
                    name={nameKeyOf(group.taskId)}
                    aria-label={`Usar lo de la matriz en el nombre de ${group.taskId}`}
                    checked={getChoice(nameKeyOf(group.taskId)) === "matriz"}
                    onChange={() => setChoice(nameKeyOf(group.taskId), "matriz")}
                  />
                  <span>{`Matriz: ${group.nameConflict.matrixValue}`}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={nameKeyOf(group.taskId)}
                    aria-label={`Conservar lo del Gantt en el nombre de ${group.taskId}`}
                    checked={getChoice(nameKeyOf(group.taskId)) === "gantt"}
                    onChange={() => setChoice(nameKeyOf(group.taskId), "gantt")}
                  />
                  <span>{`Gantt: ${group.nameConflict.ganttValue}`}</span>
                </label>
              </div>
            )}

            {group.scheduleConflicts.length > 0 && (
              <div
                data-testid={`conflict-${group.taskId}-schedule`}
                className="rounded-lg border border-[var(--color-hairline)] p-2 text-sm"
              >
                <ul className="text-xs text-[var(--color-text-muted)]">
                  {SCHEDULE_FIELDS.filter((field) =>
                    group.scheduleConflicts.some((conflict) => conflict.field === field),
                  ).map((field) => {
                    const conflict = group.scheduleConflicts.find((c) => c.field === field)!;
                    return (
                      <li key={field}>
                        {`${FIELD_LABEL[field]}: ${conflict.matrixValue} → ${conflict.ganttValue}`}
                      </li>
                    );
                  })}
                </ul>
                <label className="mt-1 flex items-center gap-2">
                  <input
                    type="radio"
                    name={scheduleKeyOf(group.taskId)}
                    aria-label={`Usar lo de la matriz en el horario de ${group.taskId}`}
                    checked={getChoice(scheduleKeyOf(group.taskId)) === "matriz"}
                    onChange={() => setChoice(scheduleKeyOf(group.taskId), "matriz")}
                  />
                  <span>Matriz</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={scheduleKeyOf(group.taskId)}
                    aria-label={`Conservar lo del Gantt en el horario de ${group.taskId}`}
                    checked={getChoice(scheduleKeyOf(group.taskId)) === "gantt"}
                    onChange={() => setChoice(scheduleKeyOf(group.taskId), "gantt")}
                  />
                  <span>Gantt</span>
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button type="button" onClick={handleResolve}>
          Aplicar con estas decisiones
        </button>
        <button type="button" onClick={onCancel}>
          No aplicar
        </button>
      </div>
    </section>
  );
}
