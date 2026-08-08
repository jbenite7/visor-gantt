"use client";

import { AlertTriangle, GitBranch, Timer, Users } from "lucide-react";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";

interface BottlenecksViewProps {
  issues: ScheduleIssue[];
  bottlenecks: Bottleneck[];
}

const KIND_LABEL: Record<Bottleneck["kind"], string> = {
  critical: "Ruta crítica",
  nearCritical: "Holgura baja",
  dependencyConvergence: "Convergencia",
  resourceOverallocation: "Recurso",
};

function iconFor(kind: Bottleneck["kind"]) {
  switch (kind) {
    case "critical":
      return AlertTriangle;
    case "nearCritical":
      return Timer;
    case "dependencyConvergence":
      return GitBranch;
    case "resourceOverallocation":
      return Users;
  }
}

function severityColor(severity: "low" | "medium" | "high"): string {
  if (severity === "high") return "var(--aia-alert-main)";
  if (severity === "medium") return "var(--aia-warn-main)";
  return "var(--aia-proj-main)";
}

function formatDate(date?: Date): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function BottlenecksView({
  issues,
  bottlenecks,
}: BottlenecksViewProps) {
  return (
    <div
      data-testid="bottlenecks-view"
      className="apple-module h-full overflow-auto"
    >
      <div className="apple-module-header px-5 py-4">
        <h2 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--color-text-strong)]">
          Cuellos de botella
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {bottlenecks.length} indicadores activos
          {issues.length > 0 ? ` · ${issues.length} conflictos` : ""}
        </p>
      </div>

      <div className="p-5">
        {issues.length > 0 && (
          <section className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-[var(--aia-alert-main)]">
              Conflictos de programacion
            </h3>
            <div className="apple-section divide-y divide-[var(--color-hairline)] overflow-hidden">
              {issues.map((issue, index) => (
                <div key={`${issue.kind}-${index}`} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} color={severityColor(issue.severity)} />
                    <span className="text-sm font-semibold text-[var(--color-text-strong)]">
                      {issue.message}
                    </span>
                  </div>
                  {issue.taskIds.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Tareas: {issue.taskIds.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {bottlenecks.length === 0 ? (
          <div className="apple-section flex min-h-64 items-center justify-center text-sm text-[var(--color-text-muted)]">
            No hay cuellos de botella detectados.
          </div>
        ) : (
          <section className="apple-section divide-y divide-[var(--color-hairline)] overflow-hidden">
            {bottlenecks.map((bottleneck, index) => {
              const Icon = iconFor(bottleneck.kind);
              return (
                <article
                  key={`${bottleneck.kind}-${bottleneck.resourceId ?? ""}-${index}`}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_180px_140px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon size={16} color={severityColor(bottleneck.severity)} />
                      <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-2 py-0.5 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                        {KIND_LABEL[bottleneck.kind]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">
                      {bottleneck.message}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Tareas: {bottleneck.taskIds.join(", ")}
                      {bottleneck.resourceId ? ` · Recurso: ${bottleneck.resourceId}` : ""}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-strong)]">
                    {bottleneck.metric}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    {formatDate(bottleneck.date)}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
