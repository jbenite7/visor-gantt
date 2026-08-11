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
import {
  EMPTY_DETECTION_DICTIONARY,
  type DetectionDictionary,
} from "@/lib/scheduling/detection/dictionary";
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
import { canAccessProject, projectFilterFor } from "@/lib/auth/projectAccess";

/* ── ProjectData interface ── */

export interface ProjectData {
  id?: string;
  /**
   * Con qué versión se cargó el proyecto.
   *
   * Sin esto, dos pestañas abiertas sobre el mismo proyecto se pisaban: la B
   * reescribía el blob con su copia antigua y borraba el trabajo de la A.
   * Ninguna se enteraba y las dos decían «Guardado».
   */
  version?: number;
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
  /**
   * Lo que el usuario corrigió a mano sobre la detección automática. Viaja
   * dentro de `project_data`: no necesita columna ni migración, y el motor
   * lo recibe como argumento porque no sabe dónde se guarda.
   */
  detectionDictionary?: DetectionDictionary;
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
  detectionDictionary?: DetectionDictionary;
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
    detectionDictionary: data.detectionDictionary ?? EMPTY_DETECTION_DICTIONARY,
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
  row: { name: string; project_data: SerializedProjectData; version?: number },
): ProjectData {
  const pd = row.project_data;
  return {
    id,
    // Viaja hasta la pantalla para que el guardado sepa contra qué versión
    // escribe. Sin esto, dos pestañas se pisan en silencio.
    version: row.version,
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
    detectionDictionary: pd.detectionDictionary ?? EMPTY_DETECTION_DICTIONARY,
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

/**
 * Permiso **y** propiedad. Hacen falta las dos.
 *
 * Hasta el 2026-08-10 esto solo comprobaba el permiso global del rol: devolvía
 * el `userId` y **nunca llegaba a un `WHERE`**. Cualquier usuario con rol
 * `member` abría el proyecto de otro y el autoguardado le reemplazaba el blob
 * entero. El permiso dice qué clase de cosas puede hacer alguien; `projectId`
 * dice sobre cuál.
 *
 * Sin `projectId` la comprobación sigue siendo solo de permiso, y eso es
 * correcto para lo que no cuelga de un proyecto —las plantillas de matriz son
 * de la instalación, no de un proyecto— y para crear uno nuevo, que todavía no
 * tiene dueño porque no existe.
 */
async function authorizeProjectAction(
  permission: PermissionKey,
  projectId?: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "No autenticado" };
  }
  const allowed = await userHasPermission(user.id, permission);
  if (!allowed) {
    return { ok: false, error: "No tienes permisos para esta acción" };
  }
  if (projectId) {
    const suyo = await canAccessProject(
      { userId: user.id, roles: user.roles ?? [] },
      projectId,
    );
    if (!suyo) {
      return { ok: false, error: "Este proyecto no es tuyo" };
    }
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
): Promise<{
  success: boolean;
  id?: string;
  error?: string;
  /** La versión ya incrementada, para que el cliente guarde la siguiente vez. */
  version?: number;
}> {
  try {
    const auth = await authorizeProjectAction(
      projectData.id ? "project:update" : "project:create",
      projectData.id,
    );
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    const serialized = serializeProjectData(projectData);
    const client = await pool.connect();

    try {
      if (projectData.id) {
        // El `WHERE version = $4` es lo que impide que dos pestañas se pisen:
        // si otra guardó entre medias, la versión ya no casa y el UPDATE no
        // toca ninguna fila. Antes se devolvía `{success:true}` sin mirar
        // `rowCount`, así que un guardado a la nada decía «Guardado» y una
        // tarde de trabajo se tiraba en silencio.
        const condicionVersion =
          projectData.version === undefined ? "" : " AND version = $4";
        const parametros: unknown[] = [
          serialized.name,
          JSON.stringify(serialized),
          projectData.id,
        ];
        if (projectData.version !== undefined) {
          parametros.push(projectData.version);
        }

        const res = await client.query(
          `UPDATE projects
           SET name = $1, project_data = $2, updated_at = NOW(),
               version = version + 1
           WHERE id = $3${condicionVersion}
           RETURNING version`,
          parametros,
        );

        if (res.rowCount === 0) {
          return {
            success: false,
            error:
              projectData.version === undefined
                ? "El proyecto ya no existe: no se guardó nada."
                : "Otra pestaña guardó este proyecto mientras lo editabas. Recarga para no perder lo suyo ni lo tuyo.",
          };
        }

        return {
          success: true,
          id: projectData.id,
          version: res.rows[0]?.version as number | undefined,
        };
      } else {
        // INSERT new project
        const res = await client.query(
          `INSERT INTO projects (name, project_data)
           VALUES ($1, $2)
           RETURNING id`,
          [serialized.name, JSON.stringify(serialized)],
        );
        const nuevoId = res.rows[0].id as string;
        // Quien lo crea queda como miembro. Sin esta fila, el propio autor no
        // podría reabrir el proyecto que acaba de guardar.
        await client.query(
          `INSERT INTO project_members (project_id, user_id, role_id)
           VALUES ($1, $2, 'admin')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [String(nuevoId), auth.userId],
        );
        return { success: true, id: nuevoId };
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
/**
 * Leía cualquier proyecto por su identificador, sin pedir nada.
 *
 * La página `/project/[id]` sí exige sesión, así que por ahí no se colaba
 * nadie; pero una acción de servidor es una puerta propia, y esta no tenía
 * cerradura. Este proyecto no tiene `middleware.ts`: la protección va página
 * por página y acción por acción, y esta se había quedado fuera de las dos.
 *
 * El acceso compartido de E51 **no** pasa por aquí: tendrá su propia entrada,
 * que autoriza por token y no por sesión. Esta puerta es la de siempre y se
 * cierra como las demás.
 */
export async function loadProject(
  projectId: string,
): Promise<ProjectData | null> {
  const auth = await authorizeProjectAction("project:read", projectId);
  if (!auth.ok) return null;

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT name, project_data, version FROM projects WHERE id = $1`,
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
    const user = await getCurrentUser();
    const auth = await authorizeProjectAction("project:read");
    if (!auth.ok || !user) return [];

    // El listado enseñaba TODOS los proyectos de la instalación a cualquiera
    // con permiso de lectura. Ahora enseña aquellos de los que se es miembro;
    // al admin, todos, que es la decisión tomada.
    const filtro = projectFilterFor({
      userId: user.id,
      roles: user.roles ?? [],
    });

    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, name, updated_at FROM projects
         ${filtro.where}
         ORDER BY updated_at DESC`,
        filtro.params,
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
    const auth = await authorizeProjectAction("project:delete", projectId);
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
