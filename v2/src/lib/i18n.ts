import type { UILocale } from "@/types/ui";

type TranslationKey =
  | "columns"
  | "all"
  | "none"
  | "reset"
  | "language"
  | "toggleColumns"
  | "expand"
  | "zoom"
  | "sort"
  | "filterByName"
  | "allTasks"
  | "critical"
  | "nonCritical"
  | "milestones"
  | "summaries"
  | "tasks"
  | "task"
  | "unnamedProject"
  | "noDates"
  | "addTask"
  | "deleteSelectedTasks"
  | "undo"
  | "redo"
  | "saveBaseline"
  | "selectBaseline"
  | "saved"
  | "saving"
  | "saveError"
  | "yes";

const TRANSLATIONS: Record<UILocale, Record<TranslationKey, string>> = {
  es: {
    columns: "Columnas",
    all: "Todas",
    none: "Ninguna",
    reset: "Restablecer",
    language: "Idioma",
    toggleColumns: "Mostrar u ocultar columnas",
    expand: "Expandir",
    zoom: "Zoom",
    sort: "Ordenar",
    filterByName: "Filtrar por nombre...",
    allTasks: "Todas",
    critical: "Críticas",
    nonCritical: "No críticas",
    milestones: "Hitos",
    summaries: "Resumen",
    tasks: "tareas",
    task: "tarea",
    unnamedProject: "Proyecto sin nombre",
    noDates: "Sin fechas",
    addTask: "Agregar tarea",
    deleteSelectedTasks: "Eliminar tarea(s) seleccionada(s)",
    undo: "Deshacer",
    redo: "Rehacer",
    saveBaseline: "Guardar línea base",
    selectBaseline: "Seleccionar línea base activa",
    saved: "Guardado",
    saving: "Guardando...",
    saveError: "Error al guardar",
    yes: "Sí",
  },
  en: {
    columns: "Columns",
    all: "All",
    none: "None",
    reset: "Reset",
    language: "Language",
    toggleColumns: "Show or hide columns",
    expand: "Expand",
    zoom: "Zoom",
    sort: "Sort",
    filterByName: "Filter by name...",
    allTasks: "All",
    critical: "Critical",
    nonCritical: "Non-critical",
    milestones: "Milestones",
    summaries: "Summaries",
    tasks: "tasks",
    task: "task",
    unnamedProject: "Unnamed project",
    noDates: "No dates",
    addTask: "Add task",
    deleteSelectedTasks: "Delete selected task(s)",
    undo: "Undo",
    redo: "Redo",
    saveBaseline: "Save baseline",
    selectBaseline: "Select active baseline",
    saved: "Saved",
    saving: "Saving...",
    saveError: "Save error",
    yes: "Yes",
  },
};

export function t(locale: UILocale, key: TranslationKey): string {
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.es[key];
}
