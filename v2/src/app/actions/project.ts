"use server";

import pool from "@/lib/db";
import type { PoolClient } from "pg";
import { getCurrentUser } from "@/lib/auth/session";
import { userHasPermission } from "@/lib/auth/rbac";
import type { GanttTask } from "@/components/gantt/types";
import type { PlanningAuditEvent } from "@/types/audit";
import type { Observation } from "@/lib/observations/observations";
import type { Resource, Assignment } from "@/types/resource";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { Baseline } from "@/types/baseline";
import type { MatrixIssue, MatrixPlan, MatrixTemplate } from "@/types/matrix";
import type {
  AssignmentColumnSettings,
  MppAssignmentColumn,
  MppCustomFieldDefinition,
  MppResourceColumn,
  MppTaskColumn,
  ResourceColumnSettings,
  TaskColumnSettings,
} from "@/types/mppColumns";
import {
  DEFAULT_UI_SETTINGS,
  type UISettings,
} from "@/types/ui";
import {
  DEFAULT_PROJECT_CALENDAR,
  type ProjectCalendar,
} from "@/types/calendar";
import { createProjectDate } from "@/lib/date/projectDate";
import { normalizeProjectCalendar } from "@/lib/scheduling/projectCalendar";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import {
  createMatrixPlanFromTemplate as buildMatrixPlanFromTemplate,
} from "@/lib/matrix/templates";
import type { PermissionKey } from "@/types/auth";

/* ── ProjectData interface ── */

export interface ProjectData {
  id?: string;
  name: string;
  statusDate?: string;
  tasks: GanttTask[];
  resources: Resource[];
  assignments: Assignment[];
  budgetItems: BudgetItem[];
  budgetMappings: BudgetMapping[];
  baselines: Baseline[];
  calendar: ProjectCalendar;
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
  observations?: Observation[];
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
  matrixSync?: GanttTask["matrixSync"];
}

interface SerializedBaselineTask {
  taskId: string | number;
  baselineStart: string;
  baselineFinish: string;
  baselineDuration: number;
  baselineWork?: number;
  baselineCost?: number;
  baselineBudgetWork?: number;
  baselineBudgetCost?: number;
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
    manualStart: t.manualStart?.toISOString(),
    constraintDate: t.constraintDate?.toISOString(),
    deadline: t.deadline?.toISOString(),
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
    manualStart: t.manualStart ? new Date(t.manualStart) : undefined,
    constraintDate: t.constraintDate ? new Date(t.constraintDate) : undefined,
    deadline: t.deadline ? new Date(t.deadline) : undefined,
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
  statusDate?: string;
  tasks: SerializedGanttTask[];
  resources: Resource[];
  assignments: Assignment[];
  budgetItems: BudgetItem[];
  budgetMappings: BudgetMapping[];
  baselines: SerializedBaseline[];
  calendar?: ProjectCalendar;
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
  observations?: Observation[];
}

function serializeProjectData(data: ProjectData): SerializedProjectData {
  return {
    name: data.name,
    statusDate: data.statusDate,
    tasks: serializeTasks(data.tasks),
    resources: data.resources,
    assignments: data.assignments,
    budgetItems: data.budgetItems,
    budgetMappings: data.budgetMappings,
    baselines: serializeBaselines(data.baselines),
    calendar: normalizeProjectCalendar(data.calendar),
    matrixPlan: data.matrixPlan,
    mppTaskColumns: data.mppTaskColumns ?? [],
    mppResourceColumns: data.mppResourceColumns ?? [],
    mppAssignmentColumns: data.mppAssignmentColumns ?? [],
    customFieldDefinitions: data.customFieldDefinitions ?? [],
    calculationEngineVersion: data.calculationEngineVersion,
    calculatedAt: data.calculatedAt,
    taskColumnSettings: data.taskColumnSettings,
    resourceColumnSettings: data.resourceColumnSettings,
    assignmentColumnSettings: data.assignmentColumnSettings,
    uiSettings: data.uiSettings ?? DEFAULT_UI_SETTINGS,
    planningAuditEvents: data.planningAuditEvents ?? [],
    observations: data.observations ?? [],
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
    statusDate: pd.statusDate,
    tasks: deserializeTasks(pd.tasks ?? []),
    resources: pd.resources ?? [],
    assignments: pd.assignments ?? [],
    budgetItems: pd.budgetItems ?? [],
    budgetMappings: pd.budgetMappings ?? [],
    baselines: deserializeBaselines(pd.baselines ?? []),
    calendar: normalizeProjectCalendar(pd.calendar ?? DEFAULT_PROJECT_CALENDAR),
    matrixPlan: pd.matrixPlan,
    mppTaskColumns: pd.mppTaskColumns ?? [],
    mppResourceColumns: pd.mppResourceColumns ?? [],
    mppAssignmentColumns: pd.mppAssignmentColumns ?? [],
    customFieldDefinitions: pd.customFieldDefinitions ?? [],
    calculationEngineVersion: pd.calculationEngineVersion,
    calculatedAt: pd.calculatedAt,
    taskColumnSettings: pd.taskColumnSettings,
    resourceColumnSettings: pd.resourceColumnSettings,
    assignmentColumnSettings: pd.assignmentColumnSettings,
    uiSettings: pd.uiSettings ?? DEFAULT_UI_SETTINGS,
    planningAuditEvents: pd.planningAuditEvents ?? [],
    observations: pd.observations ?? [],
  };
}

/* ── Server Actions ── */

async function authorizeProjectAction(permission: PermissionKey): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "No autenticado" };
  }
  const allowed = await userHasPermission(user.id, permission);
  if (!allowed) {
    return { ok: false, error: "No tienes permisos para esta acción" };
  }
  return { ok: true, userId: user.id };
}

async function ensureMatrixTemplatesTable(
  client: PoolClient,
): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS matrix_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project_type TEXT,
      template_data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export interface MatrixTemplateListItem {
  id: string;
  name: string;
  projectType?: string;
  template: MatrixTemplate;
  updatedAt: Date;
}

export async function saveMatrixTemplate(
  template: MatrixTemplate,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const auth = await authorizeProjectAction("project:update");
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    const client = await pool.connect();
    try {
      await ensureMatrixTemplatesTable(client);
      const res = await client.query(
        `INSERT INTO matrix_templates (id, name, project_type, template_data, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             project_type = EXCLUDED.project_type,
             template_data = EXCLUDED.template_data,
             updated_at = NOW()
         RETURNING id`,
        [
          template.id,
          template.name,
          template.projectType ?? null,
          JSON.stringify(template),
        ],
      );
      return { success: true, id: res.rows[0].id as string };
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("saveMatrixTemplate error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error desconocido al guardar plantilla de matriz",
    };
  }
}

export async function listMatrixTemplates(): Promise<MatrixTemplateListItem[]> {
  try {
    const auth = await authorizeProjectAction("project:read");
    if (!auth.ok) return [];

    const client = await pool.connect();
    try {
      await ensureMatrixTemplatesTable(client);
      const res = await client.query(
        `SELECT id, name, project_type, template_data, updated_at
         FROM matrix_templates
         ORDER BY updated_at DESC`,
      );
      return res.rows.map(
        (row: {
          id: string;
          name: string;
          project_type?: string | null;
          template_data: MatrixTemplate;
          updated_at: string;
        }) => ({
          id: row.id,
          name: row.name,
          projectType: row.project_type ?? undefined,
          template: row.template_data,
          updatedAt: new Date(row.updated_at),
        }),
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("listMatrixTemplates error:", err);
    return [];
  }
}

export async function createMatrixPlanFromTemplate({
  template,
  id,
  name,
  startDate,
}: {
  template: MatrixTemplate;
  id?: string;
  name: string;
  startDate: string;
}): Promise<MatrixPlan> {
  return buildMatrixPlanFromTemplate({ template, id, name, startDate });
}

/**
 * Save (insert or update) a project.
 * If `id` is undefined, inserts a new row and returns the generated id.
 */
export async function saveProject(
  projectData: ProjectData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const auth = await authorizeProjectAction(
      projectData.id ? "project:update" : "project:create",
    );
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

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
    mppTaskColumns: [],
    mppResourceColumns: [],
    mppAssignmentColumns: [],
    uiSettings: DEFAULT_UI_SETTINGS,
  });
}

export async function createMatrixProject({
  name,
  matrixPlan,
}: {
  name: string;
  matrixPlan: MatrixPlan;
}): Promise<{
  success: boolean;
  id?: string;
  issues?: MatrixIssue[];
  error?: string;
}> {
  const generated = generateScheduleFromMatrix(matrixPlan);
  const blockingIssues = generated.issues.filter(
    (issue) => issue.severity === "high",
  );

  if (blockingIssues.length > 0) {
    return {
      success: false,
      issues: generated.issues,
      error: "La matriz tiene errores que impiden generar el cronograma",
    };
  }

  const matrixPlanWithLinks: MatrixPlan = {
    ...matrixPlan,
    cells: matrixPlan.cells.map((cell) => ({
      ...cell,
      generatedTaskIds: generated.provenance[cell.id] ?? [],
      syncedTaskIds: generated.provenance[cell.id] ?? [],
    })),
  };

  const result = await saveProject({
    name,
    tasks: generated.tasks,
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar: DEFAULT_PROJECT_CALENDAR,
    matrixPlan: matrixPlanWithLinks,
  });

  return {
    ...result,
    issues: generated.issues,
  };
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
    const auth = await authorizeProjectAction("project:read");
    if (!auth.ok) return [];

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
    const auth = await authorizeProjectAction("project:delete");
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    const client = await pool.connect();
    try {
      // `project_snapshots.project_id` es TEXT y no tiene clave foránea a
      // `projects.id` porque el tipo de esa columna es ambiguo entre las
      // fuentes del esquema (SERIAL en unas, UUID en otras): un FK con el
      // tipo equivocado rompería la migración en el entorno que no coincida.
      // Sin FK no hay `ON DELETE CASCADE`, así que las fotos se limpian a
      // mano aquí, en la misma transacción que borra el proyecto, para que
      // no queden huérfanas ni el borrado quede a medias.
      await client.query("BEGIN");
      try {
        await client.query(`DELETE FROM project_snapshots WHERE project_id = $1`, [projectId]);
        await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
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
