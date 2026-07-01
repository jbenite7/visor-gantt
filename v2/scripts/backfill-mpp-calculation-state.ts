import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { Client } from "pg";
import {
  buildMppAssignmentColumnsFromAssignments,
  buildMppResourceColumnsFromResources,
  buildMppTaskColumnsFromTasks,
} from "@/lib/mpp/taskColumns";
import { calculateMppFields } from "@/lib/mpp/mppCalculationEngine";
import { normalizeProjectCalendar } from "@/lib/scheduling/projectCalendar";
import type { MppAssignmentColumn, MppCustomFieldDefinition, MppResourceColumn, MppTaskColumn } from "@/types/mppColumns";
import type { Assignment, Resource } from "@/types/resource";
import type { Baseline } from "@/types/baseline";
import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

interface BackfillOptions {
  batchSize: number;
  limit?: number;
  projectId?: string;
  dryRun: boolean;
}

interface RawProjectRow {
  id: string;
  name: string;
  project_data: Record<string, unknown>;
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

interface SerializedProjectData {
  name?: string;
  statusDate?: string;
  tasks?: Array<Record<string, unknown>>;
  resources?: Array<Record<string, unknown>>;
  assignments?: Array<Record<string, unknown>>;
  budgetItems?: Array<Record<string, unknown>>;
  budgetMappings?: Array<Record<string, unknown>>;
  baselines?: SerializedBaseline[];
  calendar?: Record<string, unknown>;
  matrixPlan?: Record<string, unknown>;
  mppTaskColumns?: MppTaskColumn[];
  mppResourceColumns?: MppResourceColumn[];
  mppAssignmentColumns?: MppAssignmentColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
  calculationEngineVersion?: string;
  calculatedAt?: string;
  taskColumnSettings?: Record<string, unknown>;
  resourceColumnSettings?: Record<string, unknown>;
  assignmentColumnSettings?: Record<string, unknown>;
  uiSettings?: Record<string, unknown>;
}

interface NormalizedProjectData {
  name: string;
  statusDate?: string;
  tasks: GanttTask[];
  resources: Resource[];
  assignments: Assignment[];
  baselines: Baseline[];
  calendar?: Record<string, unknown>;
  mppTaskColumns?: MppTaskColumn[];
  mppResourceColumns?: MppResourceColumn[];
  mppAssignmentColumns?: MppAssignmentColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
}

interface BackfillProjectData {
  projectData: SerializedProjectData;
  statusDate?: string;
  tasks: GanttTask[];
  resources: Resource[];
  assignments: Assignment[];
  baselines: Baseline[];
  mppTaskColumns?: MppTaskColumn[];
  mppResourceColumns?: MppResourceColumn[];
  mppAssignmentColumns?: MppAssignmentColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
}

const INTERNAL_RECORD_KEYS = new Set<string>([
  "id",
  "name",
  "start",
  "finish",
  "duration",
  "progress",
  "isCritical",
  "isMilestone",
  "isSummary",
  "outlineLevel",
  "dependencies",
  "baselineStart",
  "baselineFinish",
  "baselineDuration",
  "earlyStart",
  "lateStart",
  "earlyFinish",
  "lateFinish",
  "totalFloat",
  "manualStart",
  "constraintType",
  "constraintDate",
  "deadline",
  "percentComplete",
  "wbs",
  "resourceNames",
  "cost",
  "actualCost",
  "mppFields",
  "matrixSource",
  "matrixSync",
  "__rowId",
]);

const INTERNAL_RESOURCE_KEYS = new Set<string>([
  "uid",
  "name",
  "type",
  "rate",
  "availability",
  "group",
  "calendar",
  "assignments",
  "mppFields",
]);

const INTERNAL_ASSIGNMENT_KEYS = new Set<string>([
  "taskId",
  "resourceId",
  "units",
  "cost",
  "mppFields",
]);

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sí", "si"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function coerceDateToISOString(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function parseDependencyType(value: unknown): GanttDependency["type"] {
  const raw = String(value ?? "FS").trim().toLowerCase();
  if (["ff", "0"].includes(raw)) return "FF";
  if (["fs", "1"].includes(raw)) return "FS";
  if (["sf", "2"].includes(raw)) return "SF";
  if (["ss", "3"].includes(raw)) return "SS";
  return "FS";
}

function normalizeDependency(raw: unknown): GanttDependency {
  const input = isRecord(raw) ? raw : {};
  const from = input.from ?? input.From ?? input.predecessorId ?? input.predecessor_uid ?? input.PredecessorUID;
  const to = input.to ?? input.To ?? input.taskId ?? input.task_id ?? input.SuccessorUID;
  const lagRaw = toNumber(input.lag ?? input.Lag ?? input.LinkLag, 0);
  const typeRaw = input.type ?? input.Type;

  return {
    from: from === undefined || from === null || from === "" ? "0" : String(from),
    to: to === undefined || to === null || to === "" ? "0" : String(to),
    type: parseDependencyType(typeRaw),
    lag: lagRaw,
  };
}

function preserveRecordMppFields(record: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(record.mppFields) && Object.keys(record.mppFields).length > 0) {
    return record.mppFields;
  }
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    values[key] = value;
  }
  return values;
}

function normalizeTask(raw: unknown): GanttTask {
  const source = isRecord(raw) ? raw : {};
  const idValue = source.id ?? source.UID ?? source.ID ?? source.UniqueId ?? "";
  const id = typeof idValue === "number" || typeof idValue === "string"
    ? idValue
    : String(idValue);
  const start = parseDate(source.start ?? source.Start ?? source.StartDate) ?? new Date();
  const finish = parseDate(source.finish ?? source.Finish ?? source.FinishDate) ?? start;
  const dependencies = Array.isArray(source.dependencies)
    ? source.dependencies.map(normalizeDependency)
    : [];

  return {
    id,
    name: String(source.name ?? source.Name ?? "Tarea"),
    start,
    finish,
    duration: toNumber(source.duration ?? source.Duration ?? source.durationDays, 0),
    progress: toNumber(source.progress ?? source.percentComplete ?? source.PercentComplete, 0),
    isCritical: parseBoolean(source.isCritical ?? source.Critical, false),
    isMilestone: parseBoolean(source.isMilestone ?? source.Milestone, false),
    isSummary: parseBoolean(source.isSummary ?? source.Summary, false),
    outlineLevel: Math.max(1, toNumber(source.outlineLevel ?? source.OutlineLevel, 1)),
    dependencies,
    baselineStart: parseDate(source.baselineStart ?? source.BaselineStart),
    baselineFinish: parseDate(source.baselineFinish ?? source.BaselineFinish),
    baselineDuration: toNumber(source.baselineDuration ?? source.BaselineDuration, 0),
    earlyStart: parseDate(source.earlyStart ?? source.EarlyStart),
    lateStart: parseDate(source.lateStart ?? source.LateStart),
    earlyFinish: parseDate(source.earlyFinish ?? source.EarlyFinish),
    lateFinish: parseDate(source.lateFinish ?? source.LateFinish),
    totalFloat: toNumber(source.totalFloat ?? source.TotalSlack, 0),
    manualStart: parseDate(source.manualStart ?? source.ManualStart),
    constraintType: source.constraintType as GanttTask["constraintType"],
    constraintDate: parseDate(source.constraintDate ?? source.ConstraintDate),
    deadline: parseDate(source.deadline ?? source.Deadline),
    percentComplete: toNumber(
      source.percentComplete ??
        source.PercentComplete ??
        source.progress ??
        source.PERCENT_COMPLETE,
      0,
    ),
    wbs: String(source.wbs ?? source.WBS ?? ""),
    resourceNames: Array.isArray(source.resourceNames)
      ? source.resourceNames.map((name) => String(name))
      : undefined,
    mppFields: preserveRecordMppFields(source),
  };
}

function normalizeResource(raw: unknown): Resource {
  const source = isRecord(raw) ? raw : {};
  const rawType = toNumber(source.type ?? source.Type ?? 0, 0);
  const type: Resource["type"] =
    String(source.type ?? source.Type ?? "").toLowerCase().includes("material") ||
      rawType === 2
      ? "material"
      : String(source.type ?? source.Type ?? "").toLowerCase().includes("cost") ||
          rawType === 3
        ? "cost"
        : "work";

  return {
    uid: toNumber(source.uid ?? source.UID ?? source.ID, 0),
    name: String(source.name ?? source.Name ?? "Recurso"),
    type,
    rate: toNumber(source.rate ?? source.StandardRate ?? source.STANDARD_RATE),
    availability: toNumber(source.availability ?? source.MaxUnits ?? source.MAX_UNITS, 100),
    group: source.group ? String(source.group) : undefined,
    calendar: isRecord(source.calendar)
      ? normalizeProjectCalendar(source.calendar as Record<string, unknown>) as ProjectCalendar
      : undefined,
    mppFields: preserveRecordMppFields(source),
  };
}

function normalizeAssignment(raw: unknown): Assignment {
  const source = isRecord(raw) ? raw : {};
  return {
    taskId: String(source.taskId ?? source.TaskUID ?? source.TaskID ?? ""),
    resourceId: toNumber(source.resourceId ?? source.ResourceUID ?? source.ResourceID, 0),
    units: toNumber(source.units ?? source.UNITS ?? source.AssignmentUnits, 100),
    cost: toNumber(source.cost ?? source.COST, 0),
    mppFields: preserveRecordMppFields(source),
  };
}

function normalizeBaseline(raw: unknown): Baseline | undefined {
  if (!isRecord(raw)) return undefined;
  if (!raw.tasks || !Array.isArray(raw.tasks)) return undefined;
  return {
    id: String(raw.id ?? raw.ID ?? Math.random()),
    name: String(raw.name ?? "Baseline"),
    createdAt: parseDate(raw.createdAt) ?? new Date(),
    tasks: raw.tasks.map((task) => {
      const record = isRecord(task) ? task : {};
      const taskIdRaw = record.taskId ??
        record.TaskUID ??
        record.TaskID ??
        record.ID ??
        record.UniqueId ??
        record.uniqueId ??
        "";
      const taskId = typeof taskIdRaw === "number" || typeof taskIdRaw === "string"
        ? taskIdRaw
        : String(taskIdRaw);
      return {
        taskId,
        baselineStart: parseDate(record.baselineStart ?? record.BaselineStart) ?? new Date(),
        baselineFinish: parseDate(record.baselineFinish ?? record.BaselineFinish) ?? new Date(),
        baselineDuration: toNumber(record.baselineDuration ?? record.BaselineDuration, 0),
        baselineWork: toNumber(record.baselineWork ?? record.BASELINE_WORK),
        baselineCost: toNumber(record.baselineCost ?? record.BASELINE_COST),
        baselineBudgetWork: toNumber(record.baselineBudgetWork ?? record.BASELINE_BUDGET_WORK),
        baselineBudgetCost: toNumber(record.baselineBudgetCost ?? record.BASELINE_BUDGET_COST),
      };
    }),
  };
}

function collectAvailableColumns(
  records: Array<Record<string, unknown>>,
  internalKeys: Set<string>,
): string[] {
  const fields = new Set<string>();

  for (const record of records) {
    const recordMpp = isRecord(record.mppFields) ? record.mppFields : {};
    const candidateKeys = [Object.keys(record), Object.keys(recordMpp)];
    for (const keys of candidateKeys) {
      for (const key of keys) {
        if (internalKeys.has(key) || key.startsWith("__")) continue;
        if (String(key).trim().length === 0) continue;
        fields.add(String(key));
      }
    }
  }

  return [...fields];
}

function serializeTasks(tasks: GanttTask[]) {
  return tasks.map((task) => ({
    ...task,
    start: coerceDateToISOString(task.start),
    finish: coerceDateToISOString(task.finish),
    baselineStart: coerceDateToISOString(task.baselineStart),
    baselineFinish: coerceDateToISOString(task.baselineFinish),
    earlyStart: coerceDateToISOString(task.earlyStart),
    lateStart: coerceDateToISOString(task.lateStart),
    earlyFinish: coerceDateToISOString(task.earlyFinish),
    lateFinish: coerceDateToISOString(task.lateFinish),
    manualStart: coerceDateToISOString(task.manualStart),
    constraintDate: coerceDateToISOString(task.constraintDate),
    deadline: coerceDateToISOString(task.deadline),
  }));
}

function serializeResources(resources: Resource[]) {
  return resources.map((resource) => ({
    ...resource,
    calendar: resource.calendar && "timeZone" in resource.calendar
      ? resource.calendar
      : resource.calendar ?? undefined,
    mppFields: preserveRecordMppFields(resource as unknown as Record<string, unknown>),
  })) as Array<Record<string, unknown>>;
}

function serializeAssignments(assignments: Assignment[]) {
  return assignments.map((assignment) => ({
    ...assignment,
    mppFields: preserveRecordMppFields(assignment as unknown as Record<string, unknown>),
  })) as Array<Record<string, unknown>>;
}

function serializeBaselines(baselines: Baseline[]) {
  return baselines.map((baseline) => ({
    ...baseline,
    createdAt: coerceDateToISOString(baseline.createdAt) ?? new Date().toISOString(),
    tasks: baseline.tasks.map((task) => ({
      ...task,
      baselineStart: coerceDateToISOString(task.baselineStart) ?? "",
      baselineFinish: coerceDateToISOString(task.baselineFinish) ?? "",
    })),
  }));
}

function parseOptions(argv: string[]): BackfillOptions {
  const options: BackfillOptions = {
    batchSize: 200,
    dryRun: false,
  };

  for (const item of argv) {
    if (item === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (item.startsWith("--batch-size=")) {
      const value = Number(item.split("=")[1]);
      if (Number.isFinite(value) && value > 0) options.batchSize = value;
      continue;
    }

    if (item.startsWith("--limit=")) {
      const value = Number(item.split("=")[1]);
      if (Number.isFinite(value) && value > 0) options.limit = value;
      continue;
    }

    if (item.startsWith("--project-id=")) {
      options.projectId = item.split("=")[1];
      continue;
    }

    if (item === "--help") {
      console.log(`
Uso:
  npx --yes tsx scripts/backfill-mpp-calculation-state.ts [opciones]

Opciones:
  --batch-size=<n>   Cantidad de proyectos por lote (default 200)
  --limit=<n>        Límite de proyectos a procesar
  --project-id=<id>  Procesar solo un proyecto
  --dry-run          No guarda cambios, solo muestra cambios
  --help             Ver esta ayuda
`);
      process.exit(0);
    }
  }

  return options;
}

async function fetchProjects(
  client: Client,
  options: BackfillOptions,
  offset: number,
): Promise<RawProjectRow[]> {
  if (options.projectId) {
    const res = await client.query<{
      id: string;
      name: string;
      project_data: Record<string, unknown>;
    }>(
      `SELECT id, name, project_data FROM projects WHERE id = $1 LIMIT 1`,
      [options.projectId],
    );
    return res.rows;
  }

  const res = await client.query<{
    id: string;
    name: string;
    project_data: Record<string, unknown>;
  }>(
    `SELECT id, name, project_data
     FROM projects
     ORDER BY id::text
     LIMIT $1
     OFFSET $2`,
    [options.batchSize, offset],
  );
  return res.rows;
}

async function normalizeProject(row: RawProjectRow): Promise<BackfillProjectData> {
  const projectData = isRecord(row.project_data) ? row.project_data : {};
  const statusDate =
    typeof projectData.statusDate === "string"
      ? projectData.statusDate
      : undefined;

  const tasks = Array.isArray(projectData.tasks)
    ? projectData.tasks
    : [];
  const resources = Array.isArray(projectData.resources)
    ? projectData.resources
    : [];
  const assignments = Array.isArray(projectData.assignments)
    ? projectData.assignments
    : [];
  const baselines = Array.isArray(projectData.baselines)
    ? (projectData.baselines as SerializedBaseline[])
        .map(normalizeBaseline)
        .filter((baseline): baseline is Baseline => Boolean(baseline))
    : [];

  const normalizedTasks = tasks.map(normalizeTask);
  const normalizedResources = resources.map(normalizeResource);
  const normalizedAssignments = assignments.map(normalizeAssignment);

  const taskAvailableColumns = collectAvailableColumns(tasks, INTERNAL_RECORD_KEYS);
  const resourceAvailableColumns = collectAvailableColumns(resources, INTERNAL_RESOURCE_KEYS);
  const assignmentAvailableColumns = collectAvailableColumns(assignments, INTERNAL_ASSIGNMENT_KEYS);

  return {
    projectData: {
      ...projectData,
      statusDate,
    } as SerializedProjectData,
    statusDate,
    tasks: normalizedTasks,
    resources: normalizedResources,
    assignments: normalizedAssignments,
    baselines,
    mppTaskColumns: buildMppTaskColumnsFromTasks(
      normalizedTasks,
      taskAvailableColumns,
      Array.isArray(projectData.mppTaskColumns) ? projectData.mppTaskColumns : [],
    ),
    mppResourceColumns: buildMppResourceColumnsFromResources(
      normalizedResources,
      resourceAvailableColumns,
      Array.isArray(projectData.mppResourceColumns) ? projectData.mppResourceColumns : [],
    ),
    mppAssignmentColumns: buildMppAssignmentColumnsFromAssignments(
      normalizedAssignments,
      assignmentAvailableColumns,
      Array.isArray(projectData.mppAssignmentColumns)
        ? projectData.mppAssignmentColumns
        : [],
    ),
    customFieldDefinitions: Array.isArray(projectData.customFieldDefinitions)
      ? projectData.customFieldDefinitions
      : [],
  };
}

async function runBackfill(options: BackfillOptions): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida en el entorno.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    let processed = 0;
    let offset = 0;

    while (true) {
      const rows = await fetchProjects(client, options, offset);
      if (rows.length === 0) break;

      for (const row of rows) {
        const normalized = await normalizeProject(row);
        const calendar = normalizeProjectCalendar(
          (normalized.projectData.calendar as Record<string, unknown>) ?? undefined,
        );

        const calculated = calculateMppFields({
          tasks: normalized.tasks,
          resources: normalized.resources,
          assignments: normalized.assignments,
          baselines: normalized.baselines,
          calendar,
          statusDate: normalized.statusDate,
          mppTaskColumns: normalized.mppTaskColumns,
          mppResourceColumns: normalized.mppResourceColumns,
          mppAssignmentColumns: normalized.mppAssignmentColumns,
          customFieldDefinitions: normalized.customFieldDefinitions,
        });

        const nextProjectData: SerializedProjectData = {
          ...normalized.projectData,
          tasks: serializeTasks(calculated.tasks),
          resources: serializeResources(calculated.resources),
          assignments: serializeAssignments(calculated.assignments),
          baselines: serializeBaselines(normalized.baselines),
          mppTaskColumns: calculated.mppTaskColumns,
          mppResourceColumns: calculated.mppResourceColumns,
          mppAssignmentColumns: calculated.mppAssignmentColumns,
          customFieldDefinitions: calculated.customFieldDefinitions,
          calculationEngineVersion: calculated.engineVersion,
          calculatedAt: calculated.calculatedAt,
          statusDate: normalized.statusDate ?? normalized.projectData.statusDate,
          calendar: calendar as unknown as Record<string, unknown>,
        };

        const planMessage =
          `Proyecto ${row.id} (${row.name}): ${calculated.tasks.length} tareas, ${calculated.resources.length} recursos, ${calculated.assignments.length} asignaciones`;

        if (options.dryRun) {
          console.log(`DRY-RUN ${planMessage}`);
        } else {
          await client.query(
            `UPDATE projects
             SET project_data = $1, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(nextProjectData), row.id],
          );
          console.log(`OK ${planMessage}`);
        }

        processed += 1;
      }

      offset += rows.length;
      if (options.projectId || (options.limit && processed >= options.limit)) break;
      if (options.limit && processed >= options.limit) break;
    }

    if (options.projectId) {
      console.log(`Backfill finalizado para proyecto ${options.projectId}`);
      return;
    }

    console.log(`Backfill finalizado. Proyectos procesados: ${processed}`);
  } finally {
    await client.end();
  }
}

const options = parseOptions(process.argv.slice(2));

runBackfill(options)
  .then(() => {
    console.log("Finalizado correctamente.");
    process.exit(0);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error(`Error ejecutando backfill: ${message}`);
    process.exit(1);
  });
