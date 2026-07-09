"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import GanttView from "@/components/views/GanttView";
import type { GanttTask } from "@/components/gantt/types";
import type { PlanningAuditEvent } from "@/types/audit";
import Link from "next/link";
import { createProjectDate } from "@/lib/date/projectDate";
import type { ProjectCalendar } from "@/types/calendar";
import type { Resource, Assignment } from "@/types/resource";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { Baseline } from "@/types/baseline";
import type { MatrixPlan } from "@/types/matrix";
import type {
  AssignmentColumnSettings,
  MppAssignmentColumn,
  MppCustomFieldDefinition,
  MppResourceColumn,
  MppTaskColumn,
  ResourceColumnSettings,
  TaskColumnSettings,
} from "@/types/mppColumns";
import type { UISettings } from "@/types/ui";

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
  manualStart?: string;
  constraintType?: GanttTask["constraintType"];
  constraintDate?: string;
  deadline?: string;
  percentComplete?: number;
  wbs?: string;
  resourceNames?: string[];
  cost?: number;
  actualCost?: number;
  mppFields?: Record<string, unknown>;
  matrixSource?: GanttTask["matrixSource"];
}

interface SerializedBaseline {
  id: string;
  name: string;
  createdAt: string;
  tasks: Array<{
    taskId: string | number;
    baselineStart: string;
    baselineFinish: string;
    baselineDuration: number;
    baselineWork?: number;
    baselineCost?: number;
    baselineBudgetWork?: number;
    baselineBudgetCost?: number;
  }>;
}

export default function ProjectView({
  projectId,
  tasks,
  projectName,
  calendar,
  resources,
  assignments,
  budgetItems,
  budgetMappings,
  baselines,
  matrixPlan,
  mppTaskColumns,
  mppResourceColumns,
  mppAssignmentColumns,
  customFieldDefinitions,
  calculationEngineVersion,
  calculatedAt,
  taskColumnSettings,
  resourceColumnSettings,
  assignmentColumnSettings,
  uiSettings,
  planningAuditEvents,
}: {
  projectId?: string;
  tasks: SerializedTask[];
  projectName: string;
  calendar: ProjectCalendar;
  resources: Resource[];
  assignments: Assignment[];
  budgetItems: BudgetItem[];
  budgetMappings: BudgetMapping[];
  baselines: SerializedBaseline[];
  matrixPlan?: MatrixPlan;
  mppTaskColumns?: MppTaskColumn[];
  mppResourceColumns?: MppResourceColumn[];
  mppAssignmentColumns?: MppAssignmentColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
  calculationEngineVersion?: string;
  calculatedAt?: string;
  taskColumnSettings?: TaskColumnSettings;
  resourceColumnSettings?: ResourceColumnSettings;
  assignmentColumnSettings?: AssignmentColumnSettings;
  uiSettings?: UISettings;
  planningAuditEvents?: PlanningAuditEvent[];
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setIsMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

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
        manualStart: t.manualStart ? createProjectDate(t.manualStart) : undefined,
        constraintDate: t.constraintDate ? createProjectDate(t.constraintDate) : undefined,
        deadline: t.deadline ? createProjectDate(t.deadline) : undefined,
        dependencies: t.dependencies as GanttTask["dependencies"],
      })),
    [tasks],
  );

  const deserializedBaselines: Baseline[] = useMemo(
    () =>
      baselines.map((baseline) => ({
        ...baseline,
        createdAt: createProjectDate(baseline.createdAt),
        tasks: baseline.tasks.map((task) => ({
          ...task,
          baselineStart: createProjectDate(task.baselineStart),
          baselineFinish: createProjectDate(task.baselineFinish),
        })),
      })),
    [baselines],
  );

  return (
    <div className="apple-page flex h-screen min-w-0 flex-col overflow-hidden">
      <header className="apple-page-header shrink-0 px-6 py-4">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/"
              className="apple-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              <ArrowLeft size={15} aria-hidden />
              Volver
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-[var(--color-text-strong)] font-[var(--font-heading)]">
                {projectName}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {deserializedTasks.length} tareas
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {isMounted ? (
          <GanttView
            projectId={projectId}
            projectName={projectName}
            tasks={deserializedTasks}
            calendar={calendar}
            resources={resources}
            assignments={assignments}
            budgetItems={budgetItems}
            budgetMappings={budgetMappings}
            baselines={deserializedBaselines}
            matrixPlan={matrixPlan}
            mppTaskColumns={mppTaskColumns}
            mppResourceColumns={mppResourceColumns}
            mppAssignmentColumns={mppAssignmentColumns}
            customFieldDefinitions={customFieldDefinitions}
            calculationEngineVersion={calculationEngineVersion}
            calculatedAt={calculatedAt}
            taskColumnSettings={taskColumnSettings}
            resourceColumnSettings={resourceColumnSettings}
            assignmentColumnSettings={assignmentColumnSettings}
            uiSettings={uiSettings}
            planningAuditEvents={planningAuditEvents}
            onTaskClick={(task) => console.log("Clicked:", task.name)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
            Cargando cronograma...
          </div>
        )}
      </div>
    </div>
  );
}
