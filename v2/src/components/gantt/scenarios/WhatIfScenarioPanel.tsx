"use client";

import { useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import type { UILocale } from "@/types/ui";
import { compareScenario, type WhatIfScenario } from "@/lib/gantt/scenarios";

interface WhatIfScenarioPanelProps {
  tasks: GanttTask[];
  selectedTaskId?: string | number;
  locale: UILocale;
  onApplyDuration: (taskId: string | number, duration: number) => void;
}

function formatDelta(value: number, locale: UILocale): string {
  if (value === 0) return locale === "en" ? "no change" : "sin cambio";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}d`;
}

export default function WhatIfScenarioPanel({
  tasks,
  selectedTaskId,
  locale,
  onApplyDuration,
}: WhatIfScenarioPanelProps) {
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId && !task.isSummary),
    [selectedTaskId, tasks],
  );
  const [durationDelta, setDurationDelta] = useState("1");
  const [isPreviewing, setIsPreviewing] = useState(false);

  const parsedDelta = Number(durationDelta);
  const nextDuration = selectedTask
    ? Math.max(selectedTask.isMilestone ? 0 : 1, selectedTask.duration + (Number.isFinite(parsedDelta) ? parsedDelta : 0))
    : 0;

  const scenario = useMemo<WhatIfScenario | undefined>(() => {
    if (!selectedTask || !isPreviewing) return undefined;
    return {
      id: `duration-${selectedTask.id}`,
      name: locale === "en" ? "Duration what-if" : "What-if duracion",
      changes: [
        {
          type: "updateTask",
          taskId: selectedTask.id,
          patch: { duration: nextDuration },
        },
      ],
    };
  }, [isPreviewing, locale, nextDuration, selectedTask]);

  const comparison = useMemo(
    () => (scenario ? compareScenario(tasks, scenario) : undefined),
    [scenario, tasks],
  );

  return (
    <section
      data-testid="what-if-scenario-panel"
      className="apple-module-header px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GitCompareArrows size={16} color="var(--aia-corp-main)" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
              {locale === "en" ? "What-if scenario" : "Escenario what-if"}
            </h3>
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {selectedTask
                ? `${selectedTask.id} - ${selectedTask.name}`
                : locale === "en"
                  ? "Select one task to compare a duration change."
                  : "Selecciona una tarea para comparar cambio de duracion."}
            </p>
          </div>
        </div>

        {selectedTask && (
          <>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-strong)]">
              {locale === "en" ? "Delta" : "Delta"}
              <input
                data-testid="what-if-duration-delta"
                type="number"
                value={durationDelta}
                onChange={(event) => {
                  setDurationDelta(event.target.value);
                  setIsPreviewing(false);
                }}
                className="w-20 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs text-[var(--color-text-strong)]"
              />
            </label>

            {!isPreviewing ? (
              <button
                type="button"
                data-testid="what-if-preview"
                onClick={() => setIsPreviewing(true)}
                className="apple-button-secondary rounded-lg px-3 py-1 text-xs font-semibold"
              >
                {locale === "en" ? "Compare" : "Comparar"}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="what-if-discard"
                  onClick={() => setIsPreviewing(false)}
                  className="apple-button-secondary rounded-lg px-3 py-1 text-xs font-semibold"
                >
                  {locale === "en" ? "Discard" : "Descartar"}
                </button>
                <button
                  type="button"
                  data-testid="what-if-apply"
                  disabled={(comparison?.issues.length ?? 0) > 0}
                  onClick={() => {
                    onApplyDuration(selectedTask.id, nextDuration);
                    setIsPreviewing(false);
                  }}
                  className="apple-button-primary rounded-lg px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locale === "en" ? "Apply" : "Aplicar"}
                </button>
              </div>
            )}
          </>
        )}

        {comparison && (
          <div
            data-testid="what-if-summary"
            className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]"
          >
            {comparison.issues.length > 0 ? (
              <strong className="text-[var(--aia-alert-main)]">
                {comparison.issues[0].message}
              </strong>
            ) : (
              <>
                <span>
                  {locale === "en" ? "Changed tasks" : "Tareas impactadas"}:{" "}
                  <strong>{comparison.summary.changedTaskCount}</strong>
                </span>
                <span>
                  {locale === "en" ? "Project finish" : "Fin proyecto"}:{" "}
                  <strong>{formatDelta(comparison.summary.projectFinishDeltaDays, locale)}</strong>
                </span>
                <span>
                  {locale === "en" ? "Critical tasks" : "Criticas"}:{" "}
                  <strong>{comparison.summary.criticalTaskDelta}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
