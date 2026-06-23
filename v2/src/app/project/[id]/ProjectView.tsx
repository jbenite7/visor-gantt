"use client";

import { useMemo } from "react";
import GanttView from "@/components/views/GanttView";
import type { GanttTask } from "@/components/gantt/types";
import Link from "next/link";
import { createProjectDate } from "@/lib/date/projectDate";
import type { ProjectCalendar } from "@/types/calendar";

interface SerializedTask {
  id: string | number;
  name: string;
  start: string;
  finish: string;
  duration: number;
  progress: number;
  isCritical: boolean;
  isMilestone: boolean;
  isSummary: boolean;
  outlineLevel: number;
  dependencies: Array<{
    from: string | number;
    to: string | number;
    type: string;
    lag?: number;
  }>;
  baselineStart?: string;
  baselineFinish?: string;
  baselineDuration?: number;
  earlyStart?: string;
  lateStart?: string;
  earlyFinish?: string;
  lateFinish?: string;
  totalFloat?: number;
  percentComplete?: number;
  wbs?: string;
  resourceNames?: string[];
  cost?: number;
  actualCost?: number;
}

export default function ProjectView({
  projectId,
  tasks,
  projectName,
  calendar,
}: {
  projectId?: string;
  tasks: SerializedTask[];
  projectName: string;
  calendar: ProjectCalendar;
}) {
  // Deserialize ISO strings back to Date objects — memoized to avoid recreating on every render
  const deserializedTasks: GanttTask[] = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        start: createProjectDate(t.start),
        finish: createProjectDate(t.finish),
        baselineStart: t.baselineStart ? createProjectDate(t.baselineStart) : undefined,
        baselineFinish: t.baselineFinish ? createProjectDate(t.baselineFinish) : undefined,
        earlyStart: t.earlyStart ? createProjectDate(t.earlyStart) : undefined,
        lateStart: t.lateStart ? createProjectDate(t.lateStart) : undefined,
        earlyFinish: t.earlyFinish ? createProjectDate(t.earlyFinish) : undefined,
        lateFinish: t.lateFinish ? createProjectDate(t.lateFinish) : undefined,
        dependencies: t.dependencies as GanttTask["dependencies"],
      })),
    [tasks],
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--aia-alabaster)]">
      <header className="shrink-0 px-6 py-4 bg-white border-b border-[var(--gray-200)]">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-[var(--aia-corp-main)] hover:text-[var(--aia-corp-dark)] font-medium transition-colors"
            >
              ← Volver
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[var(--aia-corp-dark)] font-[var(--font-heading)]">
                {projectName}
              </h1>
              <p className="text-sm text-[var(--gray-500)]">
                {deserializedTasks.length} tareas
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <GanttView
          projectId={projectId}
          projectName={projectName}
          tasks={deserializedTasks}
          calendar={calendar}
          onTaskClick={(task) => console.log("Clicked:", task.name)}
        />
      </div>
    </div>
  );
}
