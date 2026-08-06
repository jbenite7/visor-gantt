import type { TaskColumnSettings } from "@/types/mppColumns";
import type { RoleViewPresetId, TaskFilterSettings, UILocale, UISettings } from "@/types/ui";
import type { ViewType } from "@/components/gantt/toolbar/ViewSwitcher";
import type { GanttScale } from "@/components/gantt/types";

export interface RoleViewPreset {
  id: RoleViewPresetId;
  labelEs: string;
  labelEn: string;
  descriptionEs: string;
  descriptionEn: string;
  view: ViewType;
  scale: GanttScale;
  taskFilter: TaskFilterSettings;
  visibleTaskColumns: string[];
}

export interface AppliedRoleViewPreset {
  uiSettings: UISettings;
  taskColumnSettings: TaskColumnSettings;
  activeView: ViewType;
  scale: GanttScale;
}

export const ROLE_VIEW_PRESETS: RoleViewPreset[] = [
  {
    id: "planner",
    labelEs: "Planificador",
    labelEn: "Planner",
    descriptionEs: "Edición completa de EDT, fechas, duración, dependencias, avance y criticidad.",
    descriptionEn: "Full editing for WBS, dates, duration, dependencies, progress and criticality.",
    view: "gantt",
    scale: "week",
    taskFilter: { text: "", type: "all" },
    visibleTaskColumns: [
      "id",
      "uniqueId",
      "wbs",
      "name",
      "summary",
      "duration",
      "start",
      "finish",
      "predecessors",
      "progress",
      "critical",
    ],
  },
  {
    id: "executive",
    labelEs: "Dirección",
    labelEn: "Executive",
    descriptionEs: "Resumen ejecutivo con foco en ruta crítica, avance y costo.",
    descriptionEn: "Executive readout focused on critical path, progress and cost.",
    view: "executive",
    scale: "month",
    taskFilter: { text: "", type: "critical" },
    visibleTaskColumns: [
      "wbs",
      "name",
      "finish",
      "progress",
      "critical",
      "budgetedCost",
      "actualCost",
      "variance",
    ],
  },
  {
    id: "field",
    labelEs: "Obra",
    labelEn: "Field",
    descriptionEs: "Seguimiento operativo de hitos, tareas críticas y avance semanal.",
    descriptionEn: "Operational follow-up for milestones, critical work and weekly progress.",
    view: "taskSheet",
    scale: "week",
    taskFilter: { text: "", type: "all" },
    visibleTaskColumns: [
      "wbs",
      "name",
      "duration",
      "start",
      "finish",
      "predecessors",
      "progress",
      "critical",
    ],
  },
  {
    id: "tracking",
    labelEs: "Seguimiento",
    labelEn: "Tracking",
    descriptionEs: "Compara el plan contra la línea base para ver qué se atrasó.",
    descriptionEn: "Compare the plan against the baseline to see what slipped.",
    view: "tracking",
    scale: "week",
    taskFilter: { text: "", type: "all" },
    visibleTaskColumns: ["id", "wbs", "name", "start", "finish", "duration", "progress"],
  },
  {
    id: "taskSheet",
    labelEs: "Hoja de Tareas",
    labelEn: "Task Sheet",
    descriptionEs: "Listado completo de actividades para revisar datos en tabla.",
    descriptionEn: "Full activity list for reviewing data as a table.",
    view: "taskSheet",
    scale: "week",
    taskFilter: { text: "", type: "all" },
    visibleTaskColumns: ["id", "wbs", "name", "start", "finish", "duration", "progress"],
  },
];

export function roleViewPresetLabel(preset: RoleViewPreset, locale: UILocale): string {
  return locale === "en" ? preset.labelEn : preset.labelEs;
}

export function roleViewPresetDescription(preset: RoleViewPreset, locale: UILocale): string {
  return locale === "en" ? preset.descriptionEn : preset.descriptionEs;
}

export function findRoleViewPreset(id: RoleViewPresetId): RoleViewPreset {
  return ROLE_VIEW_PRESETS.find((preset) => preset.id === id) ?? ROLE_VIEW_PRESETS[0];
}

export function applyRoleViewPreset(
  currentUISettings: UISettings,
  currentTaskColumnSettings: TaskColumnSettings,
  presetId: RoleViewPresetId,
): AppliedRoleViewPreset {
  const preset = findRoleViewPreset(presetId);
  return {
    uiSettings: {
      ...currentUISettings,
      roleViewPreset: preset.id,
      taskFilter: preset.taskFilter,
    },
    taskColumnSettings: {
      ...currentTaskColumnSettings,
      visible: preset.visibleTaskColumns,
    },
    activeView: preset.view,
    scale: preset.scale,
  };
}
