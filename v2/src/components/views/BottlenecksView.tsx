"use client";

import { AlertTriangle, GitBranch, Timer, Users } from "lucide-react";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";

interface BottlenecksViewProps {
  issues: ScheduleIssue[];
  bottlenecks: Bottleneck[];
}

const KIND_LABEL: Record<Bottleneck["kind"], string> = {
  critical: "Ruta critica",
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
      className="h-full overflow-auto bg-[var(--aia-alabaster)]"
    >
      <div className="border-b border-[var(--gray-200)] bg-white px-5 py-4">
        <h2 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--aia-corp-dark)]">
          Cuellos de botella
        </h2>
        <p className="mt-1 text-sm text-[var(--gray-500)]">
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
            <div className="divide-y divide-[var(--gray-200)] border border-[var(--gray-200)] bg-white">
              {issues.map((issue, index) => (
                <div key={`${issue.kind}-${index}`} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} color={severityColor(issue.severity)} />
                    <span className="text-sm font-semibold text-[var(--gray-900)]">
                      {issue.message}
                    </span>
                  </div>
                  {issue.taskIds.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--gray-500)]">
                      Tareas: {issue.taskIds.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {bottlenecks.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center border border-[var(--gray-200)] bg-white text-sm text-[var(--gray-500)]">
            No hay cuellos de botella detectados.
          </div>
        ) : (
          <section className="divide-y divide-[var(--gray-200)] border border-[var(--gray-200)] bg-white">
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
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-500)]">
                        {KIND_LABEL[bottleneck.kind]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--gray-900)]">
                      {bottleneck.message}
                    </p>
                    <p className="mt-1 text-xs text-[var(--gray-500)]">
                      Tareas: {bottleneck.taskIds.join(", ")}
                      {bottleneck.resourceId ? ` · Recurso: ${bottleneck.resourceId}` : ""}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-[var(--aia-corp-dark)]">
                    {bottleneck.metric}
                  </div>
                  <div className="text-sm text-[var(--gray-500)]">
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
