"use client";

import { useMemo, useState } from "react";
import { Layers3 } from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import { analyzeTypicalUnits } from "@/lib/scheduling/typicalUnit";

interface TypicalUnitViewProps {
  tasks: GanttTask[];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default function TypicalUnitView({ tasks }: TypicalUnitViewProps) {
  const [mode, setMode] = useState<"level" | "consolidated">("level");
  const analysis = useMemo(() => analyzeTypicalUnits(tasks), [tasks]);

  return (
    <div data-testid="typical-unit-view" className="apple-module h-full overflow-auto">
      <div className="apple-module-header flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers3 size={18} className="text-[var(--aia-corp-main)]" />
            <h2 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--color-text-strong)]">
              Unidad Típica
            </h2>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {analysis.groups.length} sistemas repetidos detectados
          </p>
          {/*
            El rótulo anterior prometía algo que el número no era:
            es el inverso de la duración, y no hay ninguna cantidad de obra
            detrás. Se llama por su nombre y se explica de dónde sale (M2).
          */}
          <p
            data-testid="ritmo-nota"
            className="mt-1 max-w-prose text-sm text-[var(--color-text-muted)]"
          >
            El <strong>ritmo (1/día)</strong> es el inverso de la duración:
            cuántos niveles por día da el paso actual. Cuando la matriz aporte
            cantidades de obra ejecutada, este número podrá medir rendimiento real.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] p-1">
          {[
            ["level", "Por Nivel"],
            ["consolidated", "Consolidado"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="gantt-typical-unit-mode rounded-md px-3 py-1 text-xs font-semibold"
              data-active={mode === id}
              onClick={() => setMode(id as "level" | "consolidated")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {analysis.groups.length === 0 ? (
          <div className="apple-section flex min-h-64 items-center justify-center px-6 text-center text-sm text-[var(--color-text-muted)]">
            {analysis.insufficientReason}
          </div>
        ) : mode === "consolidated" ? (
          <section className="apple-section overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--color-bg-surface-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  {["Sistema", "Niveles", "Actividades", "Duración promedio", "Ritmo (1/día)"].map((head) => (
                    <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {analysis.groups.map((group) => (
                  <tr key={group.system}>
                    <td className="px-3 py-2 font-semibold capitalize text-[var(--color-text-strong)]">{group.system}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{group.levelCount}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{group.taskCount}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatNumber(group.averageDurationDays)}d</td>
                    <td className="px-3 py-2 font-semibold text-[var(--aia-corp-dark)]">{formatNumber(group.averageProductivity)} 1/día</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <div className="grid gap-4">
            {analysis.groups.map((group) => (
              <section key={group.system} className="apple-section overflow-hidden">
                <div className="border-b border-[var(--color-hairline)] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold capitalize text-[var(--color-text-strong)]">{group.system}</h3>
                    {group.family.family && (
                      <span
                        data-testid="typical-unit-family-badge"
                        className="rounded-full bg-[var(--color-bg-surface-secondary)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]"
                      >
                        {group.family.family}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {group.levelCount} niveles · {formatNumber(group.averageProductivity)} 1/día
                  </p>
                  {group.family.reviewReason && (
                    <p className="mt-1 text-xs text-[var(--color-warning,#b45309)]">
                      {group.family.reviewReason}
                    </p>
                  )}
                </div>
                <div className="divide-y divide-[var(--color-hairline)]">
                  {group.activities.map((activity) => (
                    <div key={String(activity.taskId)} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[90px_minmax(0,1fr)_120px_160px]">
                      <span className="font-semibold text-[var(--color-text-strong)]">{activity.level}</span>
                      <span className="truncate text-[var(--color-text-muted)]">{activity.name}</span>
                      <span className="text-[var(--color-text-muted)]">{activity.durationDays}d</span>
                      <span className="font-semibold text-[var(--aia-corp-dark)]">{formatNumber(activity.productivity)} 1/día</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
