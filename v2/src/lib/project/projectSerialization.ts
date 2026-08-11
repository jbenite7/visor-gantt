/**
 * Cómo viaja un proyecto entre la memoria y la base.
 *
 * Vivía dentro de `src/app/actions/project.ts`, que es un módulo `"use server"`
 * y por tanto **no puede exportar funciones que no sean acciones asíncronas**.
 * Eso dejaba `deserializeProjectData` encerrada, y E51 la necesita desde
 * `loadSharedProject`, que lee un proyecto por su enlace y no por sesión.
 *
 * La alternativa era duplicar la deserialización, y dos copias de esto se
 * separan en cuanto alguien añade un campo: exactamente el fallo de
 * `statusDate`, que se guardaba y no llegaba a la pantalla.
 */
import type { GanttTask } from "@/components/gantt/types";
import type { PlanningAuditEvent } from "@/types/audit";
import type { Observation } from "@/lib/observations/observations";
import type { Resource, Assignment } from "@/types/resource";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { Baseline } from "@/types/baseline";
import type { MatrixPlan } from "@/types/matrix";
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
import { DEFAULT_UI_SETTINGS, type UISettings } from "@/types/ui";
import {
  DEFAULT_PROJECT_CALENDAR,
  type ProjectCalendar,
} from "@/types/calendar";
import { normalizeProjectCalendar } from "@/lib/scheduling/projectCalendar";

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

export interface SerializedGanttTask {
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

export interface SerializedBaselineTask {
  taskId: string | number;
  baselineStart: string;
  baselineFinish: string;
  baselineDuration: number;
  baselineWork?: number;
  baselineCost?: number;
  baselineBudgetWork?: number;
  baselineBudgetCost?: number;
}

export interface SerializedBaseline {
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

export interface SerializedProjectData {
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

export function serializeProjectData(data: ProjectData): SerializedProjectData {
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

export function deserializeProjectData(
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

