"use client";

import { useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import type { DetectionDictionary } from "@/lib/scheduling/detection/dictionary";
import { formatLocationLabel } from "@/lib/scheduling/detection/location";
import { resolveTaskLocation } from "@/lib/scheduling/detection/taskLocation";

/**
 * Donde se cierra el ciclo de aprendizaje que P3 construyó a medias.
 *
 * El motor exponía el diccionario y su API, pero la pantalla que lo usaría
 * quedó en otro proyecto: el motor aprendía de correcciones que nadie podía
 * escribir. La corrección es **puntual** —se guarda contra el nombre exacto
 * de esa tarea— y no una regla que arrastre a las de nombre parecido.
 */
export interface LocationCorrectionPanelProps {
  tasks: GanttTask[];
  dictionary: DetectionDictionary;
  onCorrect: (input: { taskName: string; value: string; note: string }) => void;
}

export default function LocationCorrectionPanel({
  tasks,
  dictionary,
  onCorrect,
}: LocationCorrectionPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = (task: GanttTask) => {
    const key = String(task.id);
    const value = (values[key] ?? "").trim();
    const note = (notes[key] ?? "").trim();

    if (!value) {
      setError("Escribe el nivel al que va la tarea.");
      return;
    }
    if (!note) {
      setError(
        "Escribe por qué la corriges: sin motivo, en seis meses nadie sabrá si sigue haciendo falta.",
      );
      return;
    }

    setError(null);
    onCorrect({ taskName: task.name, value, note });
    setValues((current) => ({ ...current, [key]: "" }));
    setNotes((current) => ({ ...current, [key]: "" }));
  };

  return (
    <section data-testid="location-correction-panel" className="apple-section p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
        Corregir ubicaciones
      </h3>
      <p className="mt-1 max-w-prose text-xs text-[var(--color-text-muted)]">
        Lo que corrijas aquí manda sobre la detección automática la próxima vez.
        Es puntual: solo afecta a esta tarea, no a las de nombre parecido.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs font-semibold text-[var(--aia-warn-main)]"
        >
          {error}
        </p>
      )}

      <ul className="mt-3 divide-y divide-[var(--color-hairline)]">
        {tasks.map((task) => {
          const key = String(task.id);
          const { location, scope } = resolveTaskLocation(task, tasks, dictionary);

          return (
            <li
              key={key}
              className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_120px_140px_minmax(0,1fr)_auto]"
            >
              <span className="truncate text-sm text-[var(--color-text-strong)]">
                {task.name}
              </span>

              <span
                data-testid={`correction-detected-${key}`}
                className="text-sm text-[var(--color-text-muted)]"
              >
                {location ? formatLocationLabel(location) : "Obra general"}
              </span>

              <span
                data-testid={`correction-source-${key}`}
                className="text-xs text-[var(--color-text-muted)]"
              >
                {scope === "diccionario"
                  ? "Corregida a mano"
                  : "Detección automática"}
              </span>

              <div className="grid gap-2">
                <input
                  aria-label={`Nivel corregido de ${task.name}`}
                  value={values[key] ?? ""}
                  placeholder="Nivel, por ejemplo 4 o -1"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="rounded border border-[var(--color-hairline)] px-2 py-1 text-sm"
                />
                <input
                  aria-label={`Motivo de la corrección de ${task.name}`}
                  value={notes[key] ?? ""}
                  placeholder="Por qué la corriges"
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="rounded border border-[var(--color-hairline)] px-2 py-1 text-sm"
                />
              </div>

              <button
                type="button"
                aria-label={`Corregir ${task.name}`}
                onClick={() => submit(task)}
                className="apple-button-secondary self-start rounded px-3 py-1 text-sm font-semibold"
              >
                Corregir
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
