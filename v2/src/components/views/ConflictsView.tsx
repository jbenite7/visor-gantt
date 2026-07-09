"use client";

import { AlertTriangle, GitBranch } from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import { analyzeScheduleConflicts } from "@/lib/scheduling/conflicts";

interface ConflictsViewProps {
  tasks: GanttTask[];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

type Analysis = ReturnType<typeof analyzeScheduleConflicts>;
type Row = Analysis["violations"][number] | Analysis["deviations"][number];

function ConflictTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="apple-section overflow-hidden">
      <div className="border-b border-[var(--color-hairline)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-sm text-[var(--color-text-muted)]">
          Sin hallazgos.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--color-bg-surface-secondary)] text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                {["Nivel", "Predecesora", "Sucesora", "Relación", "Lag", "Fecha esperada", "Fecha real", "Días"].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {rows.map((row, index) => (
                <tr key={`${row.predecessor}-${row.successor}-${index}`}>
                  <td className="px-3 py-2 font-medium text-[var(--color-text-strong)]">{row.level}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{row.predecessor}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{row.successor}</td>
                  <td className="px-3 py-2 font-semibold text-[var(--color-text-strong)]">{row.relation}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{row.lag}d</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatDate(row.expectedDate)}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatDate(row.actualDate)}</td>
                  <td className="px-3 py-2 font-semibold text-[var(--aia-alert-main)]">{row.delayDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ConflictsView({ tasks }: ConflictsViewProps) {
  const analysis = analyzeScheduleConflicts(tasks);

  return (
    <div data-testid="conflicts-view" className="apple-module h-full overflow-auto">
      <div className="apple-module-header px-5 py-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-[var(--aia-alert-main)]" />
          <h2 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--color-text-strong)]">
            Conflictos
          </h2>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {analysis.violations.length} violaciones de restricción · {analysis.deviations.length} desviaciones atípicas
        </p>
      </div>
      <div className="grid gap-4 p-5">
        <ConflictTable title="Violaciones de restricción" rows={analysis.violations} />
        <ConflictTable title="Desviaciones atípicas" rows={analysis.deviations} />
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <GitBranch size={14} />
          Las desviaciones atípicas comparan tareas hermanas por WBS sin dependencia formal.
        </div>
      </div>
    </div>
  );
}
