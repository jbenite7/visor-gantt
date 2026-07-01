import type {
  MppColumnDataType,
  MppTaskColumn,
} from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";

interface FieldLabelDefinition {
  en: string;
  es: string;
  dataType: MppColumnDataType;
  group: MppTaskColumn["group"];
  width?: number;
}

const FIELD_ID_ALIASES: Record<string, string> = {
  UID: "UNIQUE_ID",
  UNIQUEID: "UNIQUE_ID",
  COMPLETE: "PERCENT_COMPLETE",
  PERCENTCOMPLETE: "PERCENT_COMPLETE",
  PERCENTAGE_COMPLETE: "PERCENT_COMPLETE",
  WORK_COMPLETE: "PERCENT_WORK_COMPLETE",
  PERCENT_WORK_COMPLETE: "PERCENT_WORK_COMPLETE",
  PHYSICAL_COMPLETE: "PHYSICAL_PERCENT_COMPLETE",
  PHYSICAL_PERCENT_COMPLETE: "PHYSICAL_PERCENT_COMPLETE",
  CV_PERCENT: "CV_PERCENT",
  SV_PERCENT: "SV_PERCENT",
  OUTLINELEVEL: "OUTLINE_LEVEL",
  OUTLINENUMBER: "OUTLINE_NUMBER",
  RESOURCENAMES: "RESOURCE_NAMES",
  CONSTRAINTTYPE: "CONSTRAINT_TYPE",
  CONSTRAINTDATE: "CONSTRAINT_DATE",
  ACTUALCOST: "ACTUAL_COST",
  BASELINESTART: "BASELINE_START",
  BASELINEFINISH: "BASELINE_FINISH",
  BASELINEDURATION: "BASELINE_DURATION",
  BASELINECOST: "BASELINE_COST",
  EARLYSTART: "EARLY_START",
  EARLYFINISH: "EARLY_FINISH",
  LATESTART: "LATE_START",
  LATEFINISH: "LATE_FINISH",
  TOTALSLACK: "TOTAL_SLACK",
  FREESLACK: "FREE_SLACK",
  MAXUNITS: "MAX_UNITS",
  STANDARD_RATE: "STANDARD_RATE",
  STANDARDRATE: "STANDARD_RATE",
  COSTPERUSE: "COST_PER_USE",
  COSTRATETABLE: "COST_RATE_TABLE",
  RESOURCEID: "RESOURCE_ID",
  RESOURCEUID: "RESOURCE_UNIQUE_ID",
  RESOURCEUNIQUEID: "RESOURCE_UNIQUE_ID",
  TASKID: "TASK_ID",
  TASKUID: "TASK_UNIQUE_ID",
  TASKUNIQUEID: "TASK_UNIQUE_ID",
  TASKNAME: "TASK_NAME",
  ASSIGNMENTUNITS: "ASSIGNMENT_UNITS",
};

export const MS_PROJECT_TASK_FIELD_LABELS: Record<string, FieldLabelDefinition> = {
  ID: { en: "ID", es: "ID", dataType: "number", group: "basic", width: 50 },
  UNIQUE_ID: { en: "Unique ID", es: "Id. único", dataType: "number", group: "basic", width: 90 },
  WBS: { en: "WBS", es: "EDT", dataType: "string", group: "basic", width: 80 },
  OUTLINE_NUMBER: { en: "Outline Number", es: "Número de esquema", dataType: "string", group: "basic", width: 130 },
  OUTLINE_LEVEL: { en: "Outline Level", es: "Nivel de esquema", dataType: "number", group: "basic", width: 120 },
  NAME: { en: "Name", es: "Nombre", dataType: "string", group: "basic", width: 220 },
  ACTIVE: { en: "Active", es: "Activa", dataType: "boolean", group: "basic", width: 80 },
  DURATION: { en: "Duration", es: "Duración", dataType: "duration", group: "schedule", width: 90 },
  START: { en: "Start", es: "Comienzo", dataType: "date", group: "schedule", width: 110 },
  FINISH: { en: "Finish", es: "Fin", dataType: "date", group: "schedule", width: 110 },
  PREDECESSORS: { en: "Predecessors", es: "Predecesoras", dataType: "string", group: "schedule", width: 120 },
  SUCCESSORS: { en: "Successors", es: "Sucesoras", dataType: "string", group: "schedule", width: 120 },
  PERCENT_COMPLETE: { en: "% Complete", es: "% completado", dataType: "number", group: "tracking", width: 100 },
  SUMMARY: { en: "Summary", es: "Resumen", dataType: "boolean", group: "basic", width: 80 },
  MILESTONE: { en: "Milestone", es: "Hito", dataType: "boolean", group: "basic", width: 80 },
  CRITICAL: { en: "Critical", es: "Crítica", dataType: "boolean", group: "schedule", width: 80 },
  CONSTRAINT_TYPE: { en: "Constraint Type", es: "Tipo de delimitación", dataType: "number", group: "schedule", width: 150 },
  CONSTRAINT_DATE: { en: "Constraint Date", es: "Fecha de delimitación", dataType: "date", group: "schedule", width: 150 },
  RESOURCE_NAMES: { en: "Resource Names", es: "Nombres de los recursos", dataType: "string", group: "basic", width: 180 },
  COST: { en: "Cost", es: "Costo", dataType: "currency", group: "cost", width: 110 },
  ACTUAL_COST: { en: "Actual Cost", es: "Costo real", dataType: "currency", group: "cost", width: 110 },
  FIXED_COST: { en: "Fixed Cost", es: "Costo fijo", dataType: "currency", group: "cost", width: 110 },
  FIXED_COST_ACCRUAL: { en: "Fixed Cost Accrual", es: "Acumulación de costos fijos", dataType: "string", group: "cost", width: 170 },
  ACTUAL_FIXED_COST: { en: "Actual Fixed Cost", es: "Costo fijo real", dataType: "currency", group: "cost", width: 150 },
  BASELINE_START: { en: "Baseline Start", es: "Comienzo previsto", dataType: "date", group: "schedule", width: 140 },
  BASELINE_FINISH: { en: "Baseline Finish", es: "Fin previsto", dataType: "date", group: "schedule", width: 120 },
  BASELINE_DURATION: { en: "Baseline Duration", es: "Duración prevista", dataType: "duration", group: "schedule", width: 150 },
  BASELINE_COST: { en: "Baseline Cost", es: "Costo previsto", dataType: "currency", group: "cost", width: 130 },
  EARLY_START: { en: "Early Start", es: "Comienzo anticipado", dataType: "date", group: "schedule", width: 150 },
  EARLY_FINISH: { en: "Early Finish", es: "Fin anticipado", dataType: "date", group: "schedule", width: 130 },
  LATE_START: { en: "Late Start", es: "Comienzo tardío", dataType: "date", group: "schedule", width: 140 },
  LATE_FINISH: { en: "Late Finish", es: "Fin tardío", dataType: "date", group: "schedule", width: 120 },
  TOTAL_SLACK: { en: "Total Slack", es: "Margen de demora total", dataType: "duration", group: "schedule", width: 170 },
  FREE_SLACK: { en: "Free Slack", es: "Margen de demora permisible", dataType: "duration", group: "schedule", width: 190 },
  PRIORITY: { en: "Priority", es: "Prioridad", dataType: "number", group: "schedule", width: 90 },
  NOTES: { en: "Notes", es: "Notas", dataType: "string", group: "other", width: 180 },
  DEADLINE: { en: "Deadline", es: "Fecha límite", dataType: "date", group: "schedule", width: 120 },
  CREATED: { en: "Created", es: "Creado", dataType: "date", group: "other", width: 120 },
  TYPE: { en: "Type", es: "Tipo", dataType: "string", group: "basic", width: 100 },
  GROUP: { en: "Group", es: "Grupo", dataType: "string", group: "basic", width: 120 },
  STANDARD_RATE: { en: "Standard Rate", es: "Tasa estándar", dataType: "currency", group: "cost", width: 130 },
  OVERTIME_RATE: { en: "Overtime Rate", es: "Tasa de horas extra", dataType: "currency", group: "cost", width: 150 },
  COST_PER_USE: { en: "Cost Per Use", es: "Costo por uso", dataType: "currency", group: "cost", width: 130 },
  COST_RATE_TABLE: { en: "Cost Rate Table", es: "Tabla de tasas de costo", dataType: "string", group: "cost", width: 150 },
  MAX_UNITS: { en: "Max Units", es: "Capacidad máxima", dataType: "number", group: "basic", width: 130 },
  RESOURCE_ID: { en: "Resource ID", es: "Id. de recurso", dataType: "number", group: "basic", width: 120 },
  RESOURCE_UNIQUE_ID: { en: "Resource Unique ID", es: "Id. único de recurso", dataType: "number", group: "basic", width: 150 },
  RESOURCE_NAME: { en: "Resource Name", es: "Nombre del recurso", dataType: "string", group: "basic", width: 170 },
  TASK_ID: { en: "Task ID", es: "Id. de tarea", dataType: "number", group: "basic", width: 100 },
  TASK_UNIQUE_ID: { en: "Task Unique ID", es: "Id. único de tarea", dataType: "number", group: "basic", width: 140 },
  TASK_NAME: { en: "Task Name", es: "Nombre de tarea", dataType: "string", group: "basic", width: 180 },
  ASSIGNMENT_UNITS: { en: "Assignment Units", es: "Unidades de asignación", dataType: "number", group: "basic", width: 160 },
  ASSIGNMENT_DELAY: { en: "Assignment Delay", es: "Retraso de asignación", dataType: "duration", group: "schedule", width: 150 },
  WORK: { en: "Work", es: "Trabajo", dataType: "duration", group: "tracking", width: 110 },
  PERCENT_WORK_COMPLETE: { en: "% Work Complete", es: "% trabajo completado", dataType: "number", group: "tracking", width: 140 },
  PHYSICAL_PERCENT_COMPLETE: { en: "Physical % Complete", es: "% físico completado", dataType: "number", group: "tracking", width: 150 },
  CV_PERCENT: { en: "CV%", es: "CV%", dataType: "number", group: "tracking", width: 90 },
  SV_PERCENT: { en: "SV%", es: "SV%", dataType: "number", group: "tracking", width: 90 },
};

const FAMILY_LABELS: Array<{
  regex: RegExp;
  build: (index: string) => FieldLabelDefinition;
}> = [
  { regex: /^TEXT_?(\d+)$/, build: (i) => ({ en: `Text ${i}`, es: `Texto ${i}`, dataType: "string", group: "custom", width: 140 }) },
  { regex: /^NUMBER_?(\d+)$/, build: (i) => ({ en: `Number ${i}`, es: `Número ${i}`, dataType: "number", group: "custom", width: 120 }) },
  { regex: /^DATE_?(\d+)$/, build: (i) => ({ en: `Date ${i}`, es: `Fecha ${i}`, dataType: "date", group: "custom", width: 120 }) },
  { regex: /^FLAG_?(\d+)$/, build: (i) => ({ en: `Flag ${i}`, es: `Indicador ${i}`, dataType: "boolean", group: "custom", width: 120 }) },
  { regex: /^COST_?(\d+)$/, build: (i) => ({ en: `Cost ${i}`, es: `Costo ${i}`, dataType: "currency", group: "custom", width: 120 }) },
  { regex: /^DURATION_?(\d+)$/, build: (i) => ({ en: `Duration ${i}`, es: `Duración ${i}`, dataType: "duration", group: "custom", width: 130 }) },
  { regex: /^START_?(\d+)$/, build: (i) => ({ en: `Start ${i}`, es: `Comienzo ${i}`, dataType: "date", group: "custom", width: 130 }) },
  { regex: /^FINISH_?(\d+)$/, build: (i) => ({ en: `Finish ${i}`, es: `Fin ${i}`, dataType: "date", group: "custom", width: 120 }) },
  { regex: /^OUTLINE_CODE_?(\d+)$/, build: (i) => ({ en: `Outline Code ${i}`, es: `Código de esquema ${i}`, dataType: "string", group: "custom", width: 160 }) },
];

function resolveKnownFieldDefinition(canonical: string): FieldLabelDefinition | undefined {
  const direct = MS_PROJECT_TASK_FIELD_LABELS[canonical];
  if (direct) return direct;

  for (const family of FAMILY_LABELS) {
    const match = canonical.match(family.regex);
    if (match) return family.build(match[1]);
  }

  return undefined;
}

export function normalizeMppFieldId(sourceKey: string): string {
  const normalized = sourceKey
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  const familyNormalized = normalized.replace(
    /^(TEXT|NUMBER|DATE|FLAG|COST|DURATION|START|FINISH|OUTLINE_CODE|BASELINE|ENTERPRISE_COST|ENTERPRISE_DATE|ENTERPRISE_DURATION|ENTERPRISE_FLAG|ENTERPRISE_NUMBER|ENTERPRISE_TEXT|ENTERPRISE_TASK_OUTLINE_CODE|ENTERPRISE_RESOURCE_OUTLINE_CODE)(\d+)$/,
    "$1_$2",
  );
  return FIELD_ID_ALIASES[familyNormalized] ?? familyNormalized;
}

function titleCaseField(fieldId: string): string {
  return fieldId
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackSpanishLabel(label: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\bActual\b/g, "Real"],
    [/\bBaseline\b/g, "Línea base"],
    [/\bBudget\b/g, "Presupuesto"],
    [/\bCumulative\b/g, "Acumulado"],
    [/\bRemaining\b/g, "Restante"],
    [/\bOvertime\b/g, "Horas extra"],
    [/\bRegular\b/g, "Regular"],
    [/\bWork\b/g, "Trabajo"],
    [/\bCost\b/g, "Costo"],
    [/\bDuration\b/g, "Duración"],
    [/\bFinish\b/g, "Fin"],
    [/\bStart\b/g, "Comienzo"],
    [/\bDate\b/g, "Fecha"],
    [/\bDelay\b/g, "Retraso"],
    [/\bUnits\b/g, "Unidades"],
    [/\bResource\b/g, "Recurso"],
    [/\bResources\b/g, "Recursos"],
    [/\bAssignment\b/g, "Asignación"],
    [/\bTask\b/g, "Tarea"],
    [/\bName\b/g, "Nombre"],
    [/\bNames\b/g, "Nombres"],
    [/\bGroup\b/g, "Grupo"],
    [/\bType\b/g, "Tipo"],
    [/\bCalendar\b/g, "Calendario"],
    [/\bUnique ID\b/g, "Id. único"],
    [/\bID\b/g, "Id."],
    [/\bLevel\b/g, "Nivel"],
    [/\bOutline\b/g, "Esquema"],
    [/\bCode\b/g, "Código"],
    [/\bFlag\b/g, "Indicador"],
    [/\bNumber\b/g, "Número"],
    [/\bText\b/g, "Texto"],
    [/\bComplete\b/g, "Completado"],
    [/\bPercent\b/g, "%"],
    [/\bCritical\b/g, "Crítica"],
    [/\bMilestone\b/g, "Hito"],
    [/\bSummary\b/g, "Resumen"],
    [/\bPredecessors\b/g, "Predecesoras"],
    [/\bSuccessors\b/g, "Sucesoras"],
    [/\bSlack\b/g, "Margen"],
    [/\bVariance\b/g, "Varianza"],
    [/\bPriority\b/g, "Prioridad"],
    [/\bNotes\b/g, "Notas"],
    [/\bCreated\b/g, "Creado"],
    [/\bHyperlink\b/g, "Hipervínculo"],
    [/\bAddress\b/g, "Dirección"],
    [/\bWarning\b/g, "Advertencia"],
    [/\bStatus\b/g, "Estado"],
    [/\bProject\b/g, "Proyecto"],
    [/\bTimephased\b/g, "por fases temporales"],
  ];

  return replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    label,
  );
}

export function resolveMppFieldDefinition(
  fieldId: string,
  fallbackLabel?: string,
  alias?: string,
): FieldLabelDefinition {
  const canonical = normalizeMppFieldId(fieldId);
  if (alias?.trim()) {
    return {
      en: alias.trim(),
      es: alias.trim(),
      dataType: MS_PROJECT_TASK_FIELD_LABELS[canonical]?.dataType ?? "string",
      group: "custom",
      width: MS_PROJECT_TASK_FIELD_LABELS[canonical]?.width ?? 140,
    };
  }

  const direct = resolveKnownFieldDefinition(canonical);
  if (direct) return direct;

  if (canonical.startsWith("TIMEPHASED_")) {
    const baseDefinition = resolveKnownFieldDefinition(normalizeMppFieldId(canonical.replace(/^TIMEPHASED_/, "")));
    if (baseDefinition) return baseDefinition;
  }

  const label = fallbackLabel?.trim() || titleCaseField(canonical);
  return {
    en: label,
    es: fallbackSpanishLabel(label),
    dataType: "string",
    group: "other",
    width: 140,
  };
}

export function getMppColumnLabel(
  column: Pick<MppTaskColumn, "labelEn" | "labelEs">,
  locale: UILocale,
): string {
  return locale === "en" ? column.labelEn : column.labelEs;
}

export function inferMppDataType(value: unknown, fieldId: string): MppColumnDataType {
  const definition = resolveMppFieldDefinition(fieldId);
  if (definition.dataType !== "string") return definition.dataType;
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value && typeof value === "object") return "object";
  return "string";
}
