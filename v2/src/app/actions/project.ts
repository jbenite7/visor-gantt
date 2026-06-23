"use server";

import pool from "@/lib/db";
import type { GanttTask } from "@/components/gantt/types";
import type { Resource, Assignment } from "@/types/resource";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { Baseline } from "@/types/baseline";
import {
  DEFAULT_PROJECT_CALENDAR,
  type ProjectCalendar,
} from "@/types/calendar";
import { createProjectDate } from "@/lib/date/projectDate";

/* ── ProjectData interface ── */

export interface ProjectData {
  id?: string;
  name: string;
  tasks: GanttTask[];
  resources: Resource[];
  assignments: Assignment[];
  budgetItems: BudgetItem[];
  budgetMappings: BudgetMapping[];
  baselines: Baseline[];
  calendar: ProjectCalendar;
}

/* ── Serialization helpers ── */

interface SerializedGanttTask {
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
  dependencies: GanttTask["dependencies"];
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

interface SerializedBaselineTask {
  taskId: string | number;
  baselineStart: string;
  baselineFinish: string;
  baselineDuration: number;
  baselineCost?: number;
}

interface SerializedBaseline {
  id: string;
  name: string;
  createdAt: string;
  tasks: SerializedBaselineTask[];
}

/** Convert Date fields to ISO strings for JSON storage. */
function serializeTasks(tasks: GanttTask[]): SerializedGanttTask[] {
  return tasks.map((t) => ({
    ...t,
    start: t.start.toISOString(),
    finish: t.finish.toISOString(),
    baselineStart: t.baselineStart?.toISOString(),
    baselineFinish: t.baselineFinish?.toISOString(),
    earlyStart: t.earlyStart?.toISOString(),
    lateStart: t.lateStart?.toISOString(),
    earlyFinish: t.earlyFinish?.toISOString(),
    lateFinish: t.lateFinish?.toISOString(),
  }));
}

/** Parse ISO strings back to Date objects. */
function deserializeTasks(raw: SerializedGanttTask[]): GanttTask[] {
  return raw.map((t) => ({
    ...t,
    start: new Date(t.start),
    finish: new Date(t.finish),
    baselineStart: t.baselineStart ? new Date(t.baselineStart) : undefined,
    baselineFinish: t.baselineFinish ? new Date(t.baselineFinish) : undefined,
    earlyStart: t.earlyStart ? new Date(t.earlyStart) : undefined,
    lateStart: t.lateStart ? new Date(t.lateStart) : undefined,
    earlyFinish: t.earlyFinish ? new Date(t.earlyFinish) : undefined,
    lateFinish: t.lateFinish ? new Date(t.lateFinish) : undefined,
  }));
}

function serializeBaselines(baselines: Baseline[]): SerializedBaseline[] {
  return baselines.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    tasks: b.tasks.map((bt) => ({
      ...bt,
      baselineStart: bt.baselineStart.toISOString(),
      baselineFinish: bt.baselineFinish.toISOString(),
    })),
  }));
}

function deserializeBaselines(raw: SerializedBaseline[]): Baseline[] {
  return raw.map((b) => ({
    ...b,
    createdAt: new Date(b.createdAt),
    tasks: b.tasks.map((bt) => ({
      ...bt,
      baselineStart: new Date(bt.baselineStart),
      baselineFinish: new Date(bt.baselineFinish),
    })),
  }));
}

interface SerializedProjectData {
  name: string;
  tasks: SerializedGanttTask[];
  resources: Resource[];
  assignments: Assignment[];
  budgetItems: BudgetItem[];
  budgetMappings: BudgetMapping[];
  baselines: SerializedBaseline[];
  calendar?: ProjectCalendar;
}

function serializeProjectData(data: ProjectData): SerializedProjectData {
  return {
    name: data.name,
    tasks: serializeTasks(data.tasks),
    resources: data.resources,
    assignments: data.assignments,
    budgetItems: data.budgetItems,
    budgetMappings: data.budgetMappings,
    baselines: serializeBaselines(data.baselines),
    calendar: data.calendar,
  };
}

function deserializeProjectData(
  id: string,
  row: { name: string; project_data: SerializedProjectData },
): ProjectData {
  const pd = row.project_data;
  return {
    id,
    name: row.name,
    tasks: deserializeTasks(pd.tasks ?? []),
    resources: pd.resources ?? [],
    assignments: pd.assignments ?? [],
    budgetItems: pd.budgetItems ?? [],
    budgetMappings: pd.budgetMappings ?? [],
    baselines: deserializeBaselines(pd.baselines ?? []),
    calendar: pd.calendar ?? DEFAULT_PROJECT_CALENDAR,
  };
}

/* ── Server Actions ── */

/**
 * Save (insert or update) a project.
 * If `id` is undefined, inserts a new row and returns the generated id.
 */
export async function saveProject(
  projectData: ProjectData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const serialized = serializeProjectData(projectData);
    const client = await pool.connect();

    try {
      if (projectData.id) {
        // UPDATE existing project
        await client.query(
          `UPDATE projects
           SET name = $1, project_data = $2, updated_at = NOW()
           WHERE id = $3`,
          [serialized.name, JSON.stringify(serialized), projectData.id],
        );
        return { success: true, id: projectData.id };
      } else {
        // INSERT new project
        const res = await client.query(
          `INSERT INTO projects (name, project_data)
           VALUES ($1, $2)
           RETURNING id`,
          [serialized.name, JSON.stringify(serialized)],
        );
        return { success: true, id: res.rows[0].id as string };
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("saveProject error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido al guardar",
    };
  }
}

export async function createBlankProject({
  name,
  startDate,
}: {
  name: string;
  startDate: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const start = createProjectDate(startDate);

  return saveProject({
    name,
    tasks: [
      {
        id: 1,
        name: "Tarea inicial",
        start,
        finish: createProjectDate(startDate),
        duration: 1,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
        wbs: "1",
      },
    ],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar: DEFAULT_PROJECT_CALENDAR,
  });
}

/**
 * Load a project by id. Returns null if not found.
 */
export async function loadProject(
  projectId: string,
): Promise<ProjectData | null> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT name, project_data FROM projects WHERE id = $1`,
        [projectId],
      );
      if (res.rows.length === 0) return null;
      return deserializeProjectData(projectId, res.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("loadProject error:", err);
    return null;
  }
}

/**
 * List all projects (summary only).
 */
export async function listProjects(): Promise<
  { id: string; name: string; updatedAt: Date }[]
> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC`,
      );
      return res.rows.map(
        (row: { id: string; name: string; updated_at: string }) => ({
          id: row.id,
          name: row.name,
          updatedAt: new Date(row.updated_at),
        }),
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("listProjects error:", err);
    return [];
  }
}

/**
 * Delete a project by id.
 */
export async function deleteProject(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("deleteProject error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar proyecto",
    };
  }
}
