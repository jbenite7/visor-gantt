"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Command as CommandIcon, HelpCircle, Search, SlidersHorizontal, X } from "lucide-react";
import type { GanttScale, GanttTask } from "@/components/gantt/types";
import type { PlanningAuditEvent } from "@/types/audit";
import type { Observation } from "@/lib/observations/observations";
import dynamic from "next/dynamic";
import ScheduleSkeleton from "@/components/gantt/ScheduleSkeleton";
import LocationCorrectionPanel from "@/components/lob/LocationCorrectionPanel";

/**
 * Las vistas distintas del Gantt se cargan al abrirlas. Antes las 14 viajaban en
 * el bundle inicial y montaban de golpe: cambiar de vista costaba ~584 ms de INP.
 */
const ViewLoading = () => <ScheduleSkeleton />;

const TaskSheetView = dynamic(() => import("@/components/views/TaskSheetView"), { loading: ViewLoading });
const TrackingGanttView = dynamic(() => import("@/components/views/TrackingGanttView"), { loading: ViewLoading });
const NetworkDiagramView = dynamic(() => import("@/components/views/NetworkDiagramView"), { loading: ViewLoading });
const ResourceSheetView = dynamic(() => import("@/components/views/ResourceSheetView"), { loading: ViewLoading });
const ResourceUsageView = dynamic(() => import("@/components/views/ResourceUsageView"), { loading: ViewLoading });
const AssignmentSheetView = dynamic(() => import("@/components/views/AssignmentSheetView"), { loading: ViewLoading });
const BudgetTable = dynamic(() => import("@/components/budget/BudgetTable"), { loading: ViewLoading });
const BudgetMapping = dynamic(() => import("@/components/budget/BudgetMapping"), { loading: ViewLoading });
const LineOfBalance = dynamic(() => import("@/components/charts/LineOfBalance"), { loading: ViewLoading });
const SCurveView = dynamic(() => import("@/components/views/SCurveView"), { loading: ViewLoading });
const CalendarSettingsView = dynamic(() => import("@/components/views/CalendarSettingsView"), { loading: ViewLoading });
const ResourcesEmptyState = dynamic(() => import("@/components/views/ResourcesEmptyState"), { loading: ViewLoading });
const ProblemsView = dynamic(() => import("@/components/views/ProblemsView"), { loading: ViewLoading });
const ObservationsView = dynamic(() => import("@/components/views/ObservationsView"), { loading: ViewLoading });
const CalendarView = dynamic(() => import("@/components/views/CalendarView"), { loading: ViewLoading });
const MatrixEditorView = dynamic(() => import("@/components/views/MatrixEditorView"), { loading: ViewLoading });
const ConflictChooser = dynamic(() => import("@/components/matrix/ConflictChooser"), { loading: ViewLoading });
const TypicalUnitView = dynamic(() => import("@/components/views/TypicalUnitView"), { loading: ViewLoading });
const ExecutivePlanningDashboard = dynamic(() => import("@/components/reports/ExecutivePlanningDashboard"), { loading: ViewLoading });

import SplitPane from "@/components/gantt/SplitPane";
import UndoToast from "@/components/gantt/UndoToast";
import ViewHelpPanel from "@/components/gantt/ViewHelpPanel";
import RejectionToast from "@/components/gantt/RejectionToast";
import ObservationPanel from "@/components/gantt/observations/ObservationPanel";
import GanttTable from "@/components/gantt/table/GanttTable";
import GanttChart from "@/components/gantt/GanttChart";
import PlanningAssistantPanel from "@/components/gantt/assistant/PlanningAssistantPanel";
import WhatIfScenarioPanel from "@/components/gantt/scenarios/WhatIfScenarioPanel";
import type { Resource, Assignment } from "@/types/resource";
import type { BudgetItem, BudgetMapping as BudgetMappingType } from "@/types/budget";
import type { ProjectCalendar } from "@/types/calendar";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { Baseline } from "@/types/baseline";
import { applyBaselineToTasks, saveBaseline } from "@/lib/scheduling/baseline";
import {
  EMPTY_DETECTION_DICTIONARY,
  rememberCorrection,
  type DetectionDictionary,
} from "@/lib/scheduling/detection/dictionary";
import type {
  ConflictResolution,
  MatrixPlan,
  MatrixSyncConflict,
} from "@/types/matrix";
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
  type UILocale,
} from "@/types/ui";
import {
  buildMppAssignmentColumnsFromAssignments,
  buildMppResourceColumnsFromResources,
  buildMppTaskColumnsFromTasks,
  DEFAULT_ASSIGNMENT_COLUMN_SETTINGS,
  DEFAULT_RESOURCE_COLUMN_SETTINGS,
  DEFAULT_TASK_COLUMN_SETTINGS,
  normalizeTaskColumnSettings,
  normalizeAssignmentColumnSettings,
  normalizeResourceColumnSettings,
} from "@/lib/mpp/taskColumns";
import { calculateMppFields } from "@/lib/mpp/mppCalculationEngine";
import { ProjectProvider, useProject } from "@/lib/state/ProjectContext";
import { insertAt, removeWhere, replaceWhere } from "@/lib/state/undoableCollections";
import { useDragBar } from "@/components/gantt/interaction/useDragBar";
import { useResizeBar } from "@/components/gantt/interaction/useResizeBar";
import {
  ProjectToolbar,
  type ViewType,
} from "@/components/gantt/toolbar";
import { normalizeViewType } from "@/components/gantt/toolbar/viewTypes";
import ViewSidebar from "@/components/gantt/toolbar/ViewSidebar";
import { saveProject, type ProjectData } from "@/app/actions/project";
import { generateAutomaticLOBFromTasks } from "@/lib/scheduling/lob";
import { detectBottlenecks } from "@/lib/scheduling/bottlenecks";
import {
  applyMatrixUpdate,
  syncMatrixPlanFromTasks,
} from "@/lib/matrix/matrixSync";
import {
  removeAreaWithTasks,
  type OrphanTaskPolicy,
} from "@/lib/matrix/removeArea";
import { buildPlanningRecommendations } from "@/lib/gantt/planningRecommendations";
import {
  applyRoleViewPreset,
  findRoleViewPreset,
  ROLE_VIEW_PRESETS,
  roleViewPresetDescription,
  roleViewPresetLabel,
} from "@/lib/gantt/roleViewPresets";
import { normalizeTaskStructure } from "@/lib/gantt/taskStructure";
import { downloadScheduleCsv } from "@/lib/gantt/scheduleExchange";
import { saveStatusLabel } from "@/lib/gantt/saveStatusLabel";
import { shouldStartSave } from "@/lib/gantt/saveGuard";
import { shouldWarnBeforeUnload } from "@/lib/gantt/pendingChanges";
import { removeAt } from "@/lib/state/undoableCollections";
import { detectDeepChanges } from "@/lib/gantt/deepChanges";
import { resolveInteractionMode } from "@/lib/gantt/interactionMode";
import { fuzzyMatches } from "@/lib/gantt/fuzzyMatch";
import { buildExecutivePlanningSummary } from "@/lib/gantt/executiveDashboard";
import { dependenciesAfterRemoval } from "@/lib/gantt/networkDependencyEditing";

type SaveStatus = "idle" | "saving" | "saved" | "error";
const AUTOSAVE_DELAY_MS = 750;

function formatStableDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

interface CommandPaletteAction {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  disabled?: boolean;
}

interface GanttViewProps {
  projectId?: string;
  projectName?: string;
  statusDate?: string;
  version?: number;
  /** Modo mirador de E51: se ve todo, no se toca nada. */
  readOnly?: boolean;
  tasks: GanttTask[];
  calendar?: ProjectCalendar;
  resources?: Resource[];
  assignments?: Assignment[];
  budgetItems?: BudgetItem[];
  budgetMappings?: BudgetMappingType[];
  baselines?: Baseline[];
  matrixPlan?: MatrixPlan;
  /** Lo que el usuario ya corrigió a mano sobre la detección automática. */
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
  onTaskClick?: (task: GanttTask) => void;
}

function GanttViewInner({
  initialProjectId,
  initialProjectName,
  initialStatusDate,
  initialVersion,
  readOnly = false,
  initialResources,
  initialAssignments,
  initialBudgetItems,
  initialBudgetMappings,
  initialBaselines,
  initialMatrixPlan,
  initialDetectionDictionary,
  initialMppTaskColumns,
  initialMppResourceColumns,
  initialMppAssignmentColumns,
  initialCustomFieldDefinitions,
  initialCalculationEngineVersion,
  initialTaskColumnSettings,
  initialResourceColumnSettings,
  initialAssignmentColumnSettings,
  initialUISettings,
  onTaskClick,
}: {
  initialProjectId?: string;
  initialProjectName?: string;
  initialStatusDate?: string;
  initialVersion?: number;
  readOnly?: boolean;
  initialResources: Resource[];
  initialAssignments: Assignment[];
  initialBudgetItems: BudgetItem[];
  initialBudgetMappings: BudgetMappingType[];
  initialBaselines: Baseline[];
  initialMatrixPlan?: MatrixPlan;
  initialDetectionDictionary?: DetectionDictionary;
  initialMppTaskColumns: MppTaskColumn[];
  initialMppResourceColumns: MppResourceColumn[];
  initialMppAssignmentColumns: MppAssignmentColumn[];
  initialCustomFieldDefinitions: MppCustomFieldDefinition[];
  initialCalculationEngineVersion?: string;
  initialTaskColumnSettings?: TaskColumnSettings;
  initialResourceColumnSettings?: ResourceColumnSettings;
  initialAssignmentColumnSettings?: AssignmentColumnSettings;
  initialUISettings: UISettings;
  onTaskClick?: (task: GanttTask) => void;
}) {
  const {
    tasks,
    planningAuditEvents,
    setTasks,
    selectedTaskIds,
    setSelectedTaskIds,
    scale,
    setScale,
    updateTask,
    moveTask,
    resizeTask,
    createDependency,
    indentTask,
    outdentTask,
    moveTaskUp,
    moveTaskDown,
    reorderTask,
    insertStructuredTask,
    applyStructureTemplate,
    smartPasteTasks,
    normalizeStructure,
    addTask,
    deleteTasks,
    lastAction,
    lastRejection,
    lastChange,
    reportInvalidEdit,
    runUndoable,
    observations,
    addObservation,
    toggleObservation,
    deleteObservation,
    undo,
    redo,
    canUndo,
    canRedo,
    scheduleIssues,
    calendar,
    calendarIssues,
    updateCalendar,
  } = useProject();

  const initialRoleViewPreset = useMemo(
    () =>
      initialUISettings.roleViewPreset
        ? findRoleViewPreset(initialUISettings.roleViewPreset)
        : undefined,
    [initialUISettings.roleViewPreset],
  );
  const [activeView, setActiveViewState] = useState<ViewType>(() =>
    // «Conflictos» se fundió en «Problemas» (C2), pero sobrevive en los ajustes
    // de proyectos guardados antes del recorte: sin reenrutarla, esos proyectos
    // abren con la barra pintada y nada debajo.
    normalizeViewType(initialRoleViewPreset?.view ?? "gantt"),
  );
  const [resources, setResources] = useState<Resource[]>(initialResources);
  // Tarea cuyo panel de observaciones está abierto (null = cerrado).
  const [observationPanelTaskId, setObservationPanelTaskId] = useState<
    string | number | null
  >(null);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [resourceSubView, setResourceSubView] = useState<"sheet" | "assignments" | "usage" | "budget" | "mapping">("sheet");
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(initialBudgetItems);
  const [budgetMappings, setBudgetMappings] =
    useState<BudgetMappingType[]>(initialBudgetMappings);
  const [matrixPlan, setMatrixPlan] = useState<MatrixPlan | undefined>(
    initialMatrixPlan,
  );
  const [uiSettings, setUISettings] = useState<UISettings>(initialUISettings);
  const [taskColumnSettings, setTaskColumnSettings] = useState<TaskColumnSettings>(
    normalizeTaskColumnSettings(
      initialTaskColumnSettings,
      initialUISettings.locale,
    ),
  );
  const [resourceColumnSettings, setResourceColumnSettings] = useState<ResourceColumnSettings>(
    normalizeResourceColumnSettings(
      initialResourceColumnSettings,
      initialUISettings.locale,
    ),
  );
  const [assignmentColumnSettings, setAssignmentColumnSettings] = useState<AssignmentColumnSettings>(
    normalizeAssignmentColumnSettings(
      initialAssignmentColumnSettings,
      initialUISettings.locale,
    ),
  );
  const locale = uiSettings.locale;
  /**
   * Simple es la puerta de entrada, no una preferencia permanente: se ofrece en
   * la primera visita y después manda lo que el usuario haya elegido (E36).
   */
  const interactionMode = resolveInteractionMode(uiSettings, {
    isFirstVisit: !initialProjectId,
    hasHistory: planningAuditEvents.length > 0,
  });
  const isAdvancedMode = interactionMode === "advanced";
  const resourceViewLabels =
    locale === "en"
      ? {
          sheet: "Resource Sheet",
          usage: "Resource Usage",
          assignments: "Assignments",
          budget: "Budget",
          mapping: "Mapping",
        }
      : {
          sheet: "Hoja de Recursos",
          usage: "Uso de Recursos",
          assignments: "Asignaciones",
          budget: "Presupuesto",
          mapping: "Mapeo",
        };
  const syncedMatrixPlan = useMemo(
    () =>
      matrixPlan ? syncMatrixPlanFromTasks(matrixPlan, tasks, calendar) : undefined,
    [matrixPlan, tasks, calendar],
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  /** Por qué se rechazó el último guardado, cuando el servidor lo explica. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * Un conflicto no se arregla reintentando: el reintento manda la misma
   * versión vieja y vuelve a chocar. Lo que hace falta es traer lo que hay.
   */
  const esConflictoDeVersion = Boolean(saveError?.includes("Otra pestaña"));
  /**
   * Espejo del estado de guardado para el aviso al cerrar. Va en un ref
   * porque `beforeunload` se registra una sola vez y consulta al dispararse:
   * marcar estado desde el efecto de autoguardado encadenaría renders.
   */
  const saveStatusRef = useRef<SaveStatus>("idle");
  /** Borrador de la matriz sin aplicar: cuenta como trabajo pendiente (M28). */
  const matrixDraftDirtyRef = useRef(false);
  /** Espejo de la vista activa, para consultarla dentro de un `useCallback` estable. */
  const activeViewRef = useRef<ViewType>(activeView);
  activeViewRef.current = activeView;
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [projectName] = useState<string>(initialProjectName ?? "Sin título");
  const [showStructurePreview, setShowStructurePreview] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const isDirtyRef = useRef(false);
  /**
   * Con qué versión se cargó el proyecto, y si hay un guardado viajando.
   *
   * Sin la versión, dos pestañas se pisaban: la segunda reescribía el blob con
   * su copia antigua y las dos decían «Guardado». Sin la guarda de vuelo, el
   * temporizador podía disparar sobre un guardado aún en curso y el usuario
   * acababa chocando consigo mismo.
   */
  const versionRef = useRef<number | undefined>(initialVersion);
  const guardadoEnVueloRef = useRef(false);
  const didMountSaveStateRef = useRef(false);
  const didMountObservationsRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const previousActiveViewRef = useRef<ViewType | null>(null);

  useEffect(() => {
    if (initialRoleViewPreset) {
      setScale(initialRoleViewPreset.scale);
    }
  }, [initialRoleViewPreset, setScale]);

  useEffect(() => {
    const previousActiveView = previousActiveViewRef.current;
    previousActiveViewRef.current = activeView;
    if (activeView === "lob" && previousActiveView !== "lob") {
      setScale("day");
    }
  }, [activeView, setScale]);

  /**
   * El diccionario de correcciones del usuario. P3 dejó el motor listo para
   * consultarlo y nadie podía escribirlo: aquí se cierra el ciclo.
   */
  const [detectionDictionary, setDetectionDictionary] =
    useState<DetectionDictionary>(
      initialDetectionDictionary ?? EMPTY_DETECTION_DICTIONARY,
    );

  const handleCorrectLocation = useCallback(
    (input: { taskName: string; value: string; note: string }) => {
      setDetectionDictionary((current) =>
        rememberCorrection(current, {
          kind: "ubicacion",
          name: input.taskName,
          value: input.value,
          note: input.note,
          recordedAt: new Date().toISOString(),
        }),
      );
    },
    [],
  );

  /**
   * El estado vacío de Recursos es una puerta, no un muro: en cuanto el usuario
   * elige por dónde entrar —crear un recurso o ir al presupuesto— deja de
   * interponerse y aparecen las cinco pestañas de siempre.
   *
   * La segunda salida existe porque **Presupuesto y Mapeo no dependen de
   * recursos**: esconder las cinco pestañas en bloque taparía dos pantallas que
   * funcionan con cero cuadrillas (R9).
   */
  const [resourcesIntroDismissed, setResourcesIntroDismissed] = useState(false);

  /* ── Baselines ── */
  const [baselines, setBaselines] = useState<Baseline[]>(initialBaselines);
  const [activeBaselineId, setActiveBaselineId] = useState<string | undefined>();

  const baseMppTaskColumns = useMemo(
    () =>
      initialMppTaskColumns.length > 0
        ? initialMppTaskColumns
        : buildMppTaskColumnsFromTasks(tasks, undefined, initialMppTaskColumns),
    [tasks, initialMppTaskColumns],
  );
  const baseMppResourceColumns = useMemo(
    () =>
      initialMppResourceColumns.length > 0
        ? initialMppResourceColumns
        : buildMppResourceColumnsFromResources(resources, undefined, initialMppResourceColumns),
    [resources, initialMppResourceColumns],
  );
  const baseMppAssignmentColumns = useMemo(
    () =>
      initialMppAssignmentColumns.length > 0
        ? initialMppAssignmentColumns
        : buildMppAssignmentColumnsFromAssignments(assignments, undefined, initialMppAssignmentColumns),
    [assignments, initialMppAssignmentColumns],
  );
  const hasVisibleMppTaskColumns = useMemo(
    () => taskColumnSettings.visible.some((key) => key.startsWith("mpp:")),
    [taskColumnSettings.visible],
  );
  const shouldCalculateMppFields =
    Boolean(initialCalculationEngineVersion) &&
    (activeView !== "gantt" || hasVisibleMppTaskColumns);
  const calculatedMpp = useMemo(
    () => {
      if (!shouldCalculateMppFields) {
        return {
          tasks,
          resources,
          assignments,
          mppTaskColumns: baseMppTaskColumns,
          mppResourceColumns: baseMppResourceColumns,
          mppAssignmentColumns: baseMppAssignmentColumns,
          customFieldDefinitions: initialCustomFieldDefinitions,
          engineVersion: initialCalculationEngineVersion,
          calculatedAt: undefined,
        };
      }

      return calculateMppFields({
        tasks,
        resources,
        assignments,
        baselines,
        calendar,
        statusDate: initialStatusDate,
        mppTaskColumns: baseMppTaskColumns,
        mppResourceColumns: baseMppResourceColumns,
        mppAssignmentColumns: baseMppAssignmentColumns,
        customFieldDefinitions: initialCustomFieldDefinitions,
        timephasedScale: scale === "quarter" ? "month" : scale,
      });
    },
    [
      assignments,
      baseMppAssignmentColumns,
      baseMppResourceColumns,
      baseMppTaskColumns,
      baselines,
      calendar,
      initialCalculationEngineVersion,
      initialStatusDate,
      initialCustomFieldDefinitions,
      resources,
      scale,
      shouldCalculateMppFields,
      tasks,
    ],
  );
  const calculatedTasks = calculatedMpp.tasks;
  const calculatedResources = calculatedMpp.resources;
  const calculatedAssignments = calculatedMpp.assignments;
  /**
   * Las columnas del `.mpp` tal como vinieron. Esto es lo que se persiste:
   * esconderlas en modo Simple no puede borrarlas del proyecto.
   */
  const mppTaskColumns = calculatedMpp.mppTaskColumns;

  /**
   * Lo que ve la tabla. En modo Simple las columnas importadas no se muestran
   * —son exactamente lo que abruma a quien abre el cronograma por primera
   * vez— y vuelven enteras al pasar a Avanzado (E36).
   */
  const visibleMppTaskColumns = useMemo(
    () => (isAdvancedMode ? mppTaskColumns : []),
    [mppTaskColumns, isAdvancedMode],
  );
  const mppResourceColumns = calculatedMpp.mppResourceColumns;
  const mppAssignmentColumns = calculatedMpp.mppAssignmentColumns;
  const planningRecommendations = useMemo(
    () => buildPlanningRecommendations(calculatedTasks),
    [calculatedTasks],
  );
  const normalizedStructurePreview = useMemo(
    () => normalizeTaskStructure(calculatedTasks),
    [calculatedTasks],
  );
  const structurePreviewSummary = useMemo(() => {
    if (!showStructurePreview) return undefined;
    let changedTaskCount = 0;
    let changedWbsCount = 0;
    let changedSummaryCount = 0;

    for (let index = 0; index < calculatedTasks.length; index += 1) {
      const current = calculatedTasks[index];
      const next = normalizedStructurePreview[index];
      if (!current || !next) continue;

      const wbsChanged = current.wbs !== next.wbs;
      const levelChanged = current.outlineLevel !== next.outlineLevel;
      const summaryChanged = current.isSummary !== next.isSummary;

      if (wbsChanged || levelChanged || summaryChanged) {
        changedTaskCount += 1;
      }
      if (wbsChanged) changedWbsCount += 1;
      if (summaryChanged) changedSummaryCount += 1;
    }

    return { changedTaskCount, changedWbsCount, changedSummaryCount };
  }, [calculatedTasks, normalizedStructurePreview, showStructurePreview]);

  /* ── Project info derived from tasks ── */
  const projectInfo = useMemo(() => {
    if (calculatedTasks.length === 0) {
      return {
        name: undefined,
        start: undefined,
        finish: undefined,
        count: 0,
        durationDays: 0,
        averageProgress: 0,
        dependencyCount: 0,
        maxOutlineLevel: 1,
      };
    }
    const starts = calculatedTasks.map((t) => t.start.getTime());
    const finishes = calculatedTasks.map((t) => t.finish.getTime());
    const start = new Date(Math.min(...starts));
    const finish = new Date(Math.max(...finishes));
    const durationDays = Math.max(
      1,
      Math.floor((finish.getTime() - start.getTime()) / 86400000) + 1,
    );
    const editableTasks = calculatedTasks.filter((task) => !task.isSummary);
    const averageProgress =
      editableTasks.length > 0
        ? editableTasks.reduce(
            (sum, task) => sum + (task.percentComplete ?? task.progress ?? 0),
            0,
          ) / editableTasks.length
        : 0;
    return {
      name: undefined,
      start,
      finish,
      count: calculatedTasks.length,
      durationDays,
      averageProgress,
      dependencyCount: calculatedTasks.reduce(
        (sum, task) => sum + task.dependencies.length,
        0,
      ),
      maxOutlineLevel: Math.max(
        1,
        ...calculatedTasks.map((task) => task.outlineLevel || 1),
      ),
    };
  }, [calculatedTasks]);

  const automaticLOB = useMemo(
    () =>
      generateAutomaticLOBFromTasks(
        calculatedTasks,
        syncedMatrixPlan,
        detectionDictionary,
      ),
    [calculatedTasks, detectionDictionary, syncedMatrixPlan],
  );
  const bottlenecks = useMemo(
    () => detectBottlenecks({ tasks: calculatedTasks, resources: calculatedResources, assignments: calculatedAssignments }),
    [calculatedAssignments, calculatedResources, calculatedTasks],
  );
  const executiveSummary = useMemo(
    () =>
      buildExecutivePlanningSummary({
        tasks: calculatedTasks,
        budgetItems,
        budgetMappings,
        scheduleIssues,
        bottlenecks,
        statusDate: initialStatusDate,
      }),
    [
      bottlenecks,
      budgetItems,
      budgetMappings,
      calculatedTasks,
      scheduleIssues,
      initialStatusDate,
    ],
  );
  const matrixEditorKey = useMemo(
    () =>
      matrixPlan
        ? JSON.stringify({
            id: syncedMatrixPlan?.id,
            cells: syncedMatrixPlan?.cells.map((cell) => ({
              id: cell.id,
              active: cell.active,
              quantity: cell.quantity,
              activityOverrides: cell.activityOverrides,
              generatedTaskIds: cell.generatedTaskIds,
              syncedTaskIds: cell.syncedTaskIds,
              lastEditedAt: cell.lastEditedAt,
              lastEditedFrom: cell.lastEditedFrom,
              feedback: cell.feedback,
            })),
          })
        : "no-matrix",
    [matrixPlan, syncedMatrixPlan],
  );

  const observationPanelTask = useMemo(
    () =>
      observationPanelTaskId === null
        ? null
        : calculatedTasks.find((t) => t.id === observationPanelTaskId) ?? null,
    [calculatedTasks, observationPanelTaskId],
  );

  /* ── Add / Delete Task handlers (pasan por el historial: son deshacibles) ── */
  const handleAddTask = useCallback(() => {
    addTask();
  }, [addTask]);

  const handleDeleteTask = useCallback(() => {
    deleteTasks(selectedTaskIds);
  }, [deleteTasks, selectedTaskIds]);

  /* ── Save Baseline handler ── */
  const handleSaveBaseline = useCallback(
    (name: string) => {
      const nueva = saveBaseline(calculatedTasks, name);
      setBaselines((prev) => [...prev, nueva]);
      setActiveBaselineId(nueva.id);
    },
    [calculatedTasks],
  );

  /**
   * Borrar una línea base pasa por el historial, como el resto de lo
   * destructivo desde E24: una foto del plan aprobado no se pierde por un clic.
   */
  const handleDeleteBaseline = useCallback(
    (id: string) => {
      const index = baselines.findIndex((b) => b.id === id);
      if (index === -1) return;
      const removed = baselines[index];
      const wasActive = activeBaselineId === id;

      runUndoable({
        description: `Línea base «${removed.name}» eliminada`,
        execute: () => {
          setBaselines((prev) => prev.filter((b) => b.id !== id));
          if (wasActive) setActiveBaselineId(undefined);
        },
        undo: () => {
          setBaselines((prev) => {
            const next = [...prev];
            next.splice(index, 0, removed);
            return next;
          });
          if (wasActive) setActiveBaselineId(id);
        },
      });
    },
    [activeBaselineId, baselines, runUndoable],
  );

  /**
   * Foto de las tareas antes del último recálculo, para poder decir si se
   * movió el fin de obra o cambió la ruta crítica.
   */
  const previousTasksRef = useRef(calculatedTasks);
  const deepChange = useMemo(() => {
    const anterior = previousTasksRef.current;
    if (!lastChange) return null;
    return detectDeepChanges(anterior, calculatedTasks);
    // Se recalcula solo cuando hay una edición nueva: `lastChange.token` cambia
    // una vez por edición aceptada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChange?.token]);

  useEffect(() => {
    previousTasksRef.current = calculatedTasks;
  }, [calculatedTasks]);

  const activeBaseline = useMemo(
    () => baselines.find((b) => b.id === activeBaselineId) ?? null,
    [baselines, activeBaselineId],
  );

  /**
   * El botón «Línea base» está en la barra principal: la comparación tiene que
   * verse aquí, no solo dentro de Seguimiento (M13).
   *
   * Solo para dibujar: los campos baseline* son derivados y no se persisten
   * dentro de cada tarea.
   */
  const tasksForChart = useMemo(
    () =>
      activeBaseline
        ? applyBaselineToTasks(calculatedTasks, activeBaseline)
        : calculatedTasks,
    [activeBaseline, calculatedTasks],
  );

  /* ── Select Baseline handler ── */
  const handleSelectBaseline = useCallback((id: string) => {
    setActiveBaselineId(id);
  }, []);

  const handleTaskSelect = useCallback(
    (taskId: string | number, ctrlKey: boolean) => {
      setSelectedTaskIds(
        ctrlKey
          ? selectedTaskIds.includes(taskId)
            ? selectedTaskIds.filter((id) => id !== taskId)
            : [...selectedTaskIds, taskId]
          : [taskId],
      );
    },
    [selectedTaskIds, setSelectedTaskIds],
  );

  const viewport = useMemo(() => {
    if (calculatedTasks.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 30 * 86400000),
        scale: scale as GanttScale,
        columnWidth: 40,
      };
    }
    const starts = calculatedTasks.map((t) => t.start.getTime());
    const finishes = calculatedTasks.map((t) => t.finish.getTime());
    const minDate = new Date(Math.min(...starts));
    const maxDate = new Date(Math.max(...finishes));
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 2);
    return {
      startDate: minDate,
      endDate: maxDate,
      scale: scale as GanttScale,
      columnWidth: scale === "day" ? 40 : scale === "week" ? 280 : scale === "month" ? 800 : 1200,
    };
  }, [calculatedTasks, scale]);

  const { dragState, onDragStart } = useDragBar({
    viewport,
    onMove: moveTask,
  });
  const { resizeState, onResizeStart } = useResizeBar({
    viewport,
    onResize: resizeTask,
  });

  const handleAddResource = useCallback((resource: Resource) => {
    setResources((prev) => [...prev, resource]);
  }, []);

  const handleEditResource = useCallback(
    (resource: Resource) => {
      const previous = resources.find((r) => r.uid === resource.uid);
      if (!previous) return;

      runUndoable({
        description: `Recurso «${resource.name ?? resource.uid}» editado`,
        execute: () =>
          setResources((prev) => replaceWhere(prev, (r) => r.uid === resource.uid, resource)),
        undo: () =>
          setResources((prev) => replaceWhere(prev, (r) => r.uid === resource.uid, previous)),
      });
    },
    [resources, runUndoable],
  );

  const handleDeleteResource = useCallback(
    (uid: number) => {
      const index = resources.findIndex((r) => r.uid === uid);
      if (index === -1) return;
      const removed = resources[index];

      runUndoable({
        description: `Recurso «${removed.name ?? uid}» eliminado`,
        execute: () =>
          setResources((prev) => removeWhere(prev, (r) => r.uid === uid)),
        undo: () => setResources((prev) => insertAt(prev, index, removed)),
      });
    },
    [resources, runUndoable],
  );

  /* ── Budget handlers ── */
  const handleAddBudgetItem = useCallback((item: BudgetItem) => {
    setBudgetItems((prev) => [...prev, item]);
  }, []);

  const handleUpdateBudgetItem = useCallback(
    (item: BudgetItem) => {
      const previous = budgetItems.find((i) => i.id === item.id);
      if (!previous) return;

      runUndoable({
        description: `Partida «${item.subcategory ?? item.category}» editada`,
        execute: () =>
          setBudgetItems((prev) => replaceWhere(prev, (i) => i.id === item.id, item)),
        undo: () =>
          setBudgetItems((prev) => replaceWhere(prev, (i) => i.id === item.id, previous)),
      });
    },
    [budgetItems, runUndoable],
  );

  const handleDeleteBudgetItem = useCallback(
    (id: string) => {
      const index = budgetItems.findIndex((i) => i.id === id);
      if (index === -1) return;
      const removed = budgetItems[index];
      const removedMappings = budgetMappings.filter((m) => m.budgetItemId === id);

      runUndoable({
        description: `Partida «${removed.subcategory ?? removed.category}» eliminada`,
        execute: () => {
          setBudgetItems((prev) => removeWhere(prev, (i) => i.id === id));
          setBudgetMappings((prev) =>
            removeWhere(prev, (m) => m.budgetItemId === id),
          );
        },
        undo: () => {
          setBudgetItems((prev) => insertAt(prev, index, removed));
          setBudgetMappings((prev) => [...prev, ...removedMappings]);
        },
      });
    },
    [budgetItems, budgetMappings, runUndoable],
  );

  const handleImportBudgetCSV = useCallback(
    (items: BudgetItem[]) => {
      const importedIds = new Set(items.map((item) => item.id));
      runUndoable({
        description:
          items.length === 1
            ? "1 partida importada"
            : `${items.length} partidas importadas`,
        execute: () => setBudgetItems((prev) => [...prev, ...items]),
        undo: () =>
          setBudgetItems((prev) => removeWhere(prev, (i) => importedIds.has(i.id))),
      });
    },
    [runUndoable],
  );

  const handleAddBudgetMapping = useCallback((mapping: BudgetMappingType) => {
    setBudgetMappings((prev) => [...prev, mapping]);
    setBudgetItems((prev) =>
      prev.map((item) =>
        item.id === mapping.budgetItemId
          ? {
              ...item,
              mappedTaskIds: item.mappedTaskIds.includes(mapping.taskId)
                ? item.mappedTaskIds
                : [...item.mappedTaskIds, mapping.taskId],
            }
          : item,
      ),
    );
  }, []);


  const handleRemoveBudgetMapping = useCallback(
    (mapping: BudgetMappingType) => {
      const index = budgetMappings.findIndex(
        (m) =>
          m.budgetItemId === mapping.budgetItemId && m.taskId === mapping.taskId,
      );
      if (index === -1) return;

      runUndoable({
        description: "Vínculo de presupuesto eliminado",
        execute: () => {
          setBudgetMappings((prev) =>
            removeWhere(
              prev,
              (m) =>
                m.budgetItemId === mapping.budgetItemId &&
                m.taskId === mapping.taskId,
            ),
          );
          setBudgetItems((prev) =>
            prev.map((item) =>
              item.id === mapping.budgetItemId
                ? {
                    ...item,
                    mappedTaskIds: item.mappedTaskIds.filter(
                      (id) => id !== mapping.taskId,
                    ),
                  }
                : item,
            ),
          );
        },
        undo: () => {
          setBudgetMappings((prev) => insertAt(prev, index, mapping));
          setBudgetItems((prev) =>
            prev.map((item) =>
              item.id === mapping.budgetItemId &&
              !item.mappedTaskIds.includes(mapping.taskId)
                ? {
                    ...item,
                    mappedTaskIds: [...item.mappedTaskIds, mapping.taskId],
                  }
                : item,
            ),
          );
        },
      });
    },
    [budgetMappings, runUndoable],
  );

  /**
   * Lo que la matriz quiere aplicar mientras el usuario decide los conflictos.
   *
   * Guarda el borrador y los conflictos que se le enseñaron. Entre que pulsa
   * «Aplicar» y decide, el cronograma puede cambiar por debajo —hay un Ctrl+Z
   * escuchando—: si aparecen conflictos que no estaban en la lista, nadie ha
   * decidido sobre ellos y `applyMatrixUpdate` los resolvería a favor de la
   * matriz, pisando en silencio una edición hecha en obra. Por eso se compara
   * antes de aplicar y, si no coinciden, se vuelve a preguntar.
   */
  const [pendingMatrixConflicts, setPendingMatrixConflicts] = useState<
    {
      nextPlan: MatrixPlan;
      conflicts: MatrixSyncConflict[];
      /** El cronograma cambió mientras decidía y hay que avisarlo. */
      changed?: boolean;
    } | null
  >(null);

  /**
   * Cambiar de vista cierra el diálogo de conflictos. Si no, al volver a la
   * matriz reaparecería con un borrador que ya no existe: el editor se
   * remonta por `matrixEditorKey` y el usuario decidiría sobre otra cosa.
   */
  /**
   * Los recursos que un usuario reconocería como tales.
   *
   * Los tres `.mpp` reales del repositorio traen el **recurso nulo de MS
   * Project** —UID 0, nombre vacío—, y DA PORTO tiene 213 asignaciones
   * colgando de él. Contarlo daría «1 recurso» y una fila en blanco sin
   * explicación: un dato fantasma visible, que es peor que ninguno (R9).
   */
  const namedResources = useMemo(
    () => calculatedResources.filter((resource) => (resource.name ?? "").trim()),
    [calculatedResources],
  );

  /** Lo que el menú necesita para decir qué hay dentro de cada puerta (R0). */
  const sidebarBlurbContext = useMemo(
    () => ({
      areaCount: syncedMatrixPlan?.areas.length ?? matrixPlan?.areas.length ?? 0,
      resourceCount: namedResources.length,
    }),
    [matrixPlan, namedResources.length, syncedMatrixPlan],
  );

  const setActiveView = useCallback(
    (next: ViewType) => {
      /**
       * Salir de la Matriz desmonta el editor y con él su borrador, que vive en
       * estado local. El aviso al cerrar la pestaña no cubría esto: cambiar de
       * vista es el gesto mucho más frecuente, y se llevaba el trabajo por
       * delante sin decir nada (M28).
       */
      if (
        activeViewRef.current === "matrix" &&
        next !== "matrix" &&
        matrixDraftDirtyRef.current &&
        !window.confirm(
          "La matriz tiene cambios sin aplicar y se perderán al salir. ¿Seguro que quieres cambiar de vista?",
        )
      ) {
        return;
      }

      setPendingMatrixConflicts(null);
      setActiveViewState(next);
    },
    [],
  );

  /** Aplica un resultado ya calculado: nunca se genera el cronograma dos veces. */
  const commitMatrixResult = useCallback(
    (result: ReturnType<typeof applyMatrixUpdate>) => {
      const previousPlan = matrixPlan;
      const previousTasks = tasks;

      runUndoable({
        description: "Plan matricial aplicado al cronograma",
        execute: () => {
          setMatrixPlan(result.matrixPlan);
          setTasks(() => result.tasks);
        },
        undo: () => {
          setMatrixPlan(previousPlan);
          setTasks(() => previousTasks);
        },
      });
    },
    [matrixPlan, runUndoable, setTasks, tasks],
  );

  const handleApplyMatrixPlan = useCallback(
    (nextPlan: MatrixPlan) => {
      const result = applyMatrixUpdate({
        tasks,
        currentPlan: syncedMatrixPlan ?? nextPlan,
        nextPlan,
        calendar,
      });

      // Con conflictos no se aplica a ciegas: los decide el usuario.
      if (result.conflicts.length > 0) {
        setPendingMatrixConflicts({ nextPlan, conflicts: result.conflicts });
        return;
      }

      commitMatrixResult(result);
    },
    [calendar, commitMatrixResult, syncedMatrixPlan, tasks],
  );

  const handleResolveMatrixConflicts = useCallback(
    (resolutions: Record<string, ConflictResolution>) => {
      const pending = pendingMatrixConflicts;
      if (!pending) return;

      const result = applyMatrixUpdate({
        tasks,
        currentPlan: syncedMatrixPlan ?? pending.nextPlan,
        nextPlan: pending.nextPlan,
        resolutions,
        calendar,
      });

      // Se compara por la misma clave que usan las resoluciones.
      const mostrados = new Set(
        pending.conflicts.map((conflict) => `${conflict.taskId}::${conflict.field}`),
      );
      const ahora = result.conflicts.map(
        (conflict) => `${conflict.taskId}::${conflict.field}`,
      );
      const sonLosMismos =
        ahora.length === mostrados.size && ahora.every((key) => mostrados.has(key));

      if (!sonLosMismos) {
        setPendingMatrixConflicts({
          nextPlan: pending.nextPlan,
          conflicts: result.conflicts,
          changed: true,
        });
        return;
      }

      setPendingMatrixConflicts(null);
      commitMatrixResult(result);
    },
    [calendar, commitMatrixResult, pendingMatrixConflicts, syncedMatrixPlan, tasks],
  );

  /**
   * Borrar una ubicación toca la matriz y el cronograma a la vez, así que va
   * por el deshacer del proyecto, el mismo que el resto de borrados.
   */
  const handleRemoveMatrixArea = useCallback(
    (areaId: string, policy: OrphanTaskPolicy) => {
      const currentPlan = syncedMatrixPlan ?? matrixPlan;
      if (!currentPlan) return;

      const previousPlan = matrixPlan;
      const previousTasks = tasks;
      const result = removeAreaWithTasks(currentPlan, tasks, areaId, policy);

      runUndoable({
        description: `Ubicación «${areaId}» borrada de la matriz`,
        execute: () => {
          setMatrixPlan(result.matrixPlan);
          setTasks(() => result.tasks);
        },
        undo: () => {
          setMatrixPlan(previousPlan);
          setTasks(() => previousTasks);
        },
      });
    },
    [matrixPlan, runUndoable, setTasks, syncedMatrixPlan, tasks],
  );

  const handleSyncMatrixFromGantt = useCallback(() => {
    if (!syncedMatrixPlan) return;
    const previous = matrixPlan;
    const next = syncedMatrixPlan;

    runUndoable({
      description: "Matriz sincronizada desde el cronograma",
      execute: () => setMatrixPlan(next),
      undo: () => setMatrixPlan(previous),
    });
  }, [matrixPlan, runUndoable, syncedMatrixPlan]);

  /* ── Restablecer columnas: borra la configuración del usuario, así que se deshace ── */
  const handleResetTaskColumns = useCallback(() => {
    const previous = taskColumnSettings;
    const next = {
      ...DEFAULT_TASK_COLUMN_SETTINGS,
      labelLocale: previous?.labelLocale ?? locale,
    };

    runUndoable({
      description: "Columnas del cronograma restablecidas",
      execute: () => setTaskColumnSettings(next),
      undo: () => setTaskColumnSettings(previous),
    });
  }, [locale, runUndoable, taskColumnSettings]);

  const handleResetResourceColumns = useCallback(() => {
    const previous = resourceColumnSettings;
    const next = {
      ...DEFAULT_RESOURCE_COLUMN_SETTINGS,
      labelLocale: previous?.labelLocale ?? locale,
    };

    runUndoable({
      description: "Columnas de recursos restablecidas",
      execute: () => setResourceColumnSettings(next),
      undo: () => setResourceColumnSettings(previous),
    });
  }, [locale, resourceColumnSettings, runUndoable]);

  /**
   * Alta y baja de asignaciones, por el historial como el resto de lo
   * destructivo desde E24. Sin esto, quien arma el proyecto en la app no podía
   * asignar a nadie (M14).
   */
  const handleCreateAssignment = useCallback(
    (assignment: Assignment) => {
      runUndoable({
        description: "Recurso asignado a la actividad",
        execute: () => setAssignments((prev) => [...prev, assignment]),
        // Por posición: dos asignaciones del mismo par son indistinguibles por
        // sus campos, y filtrarlas se llevaría también la que ya estaba.
        undo: () => setAssignments((prev) => removeAt(prev, prev.length - 1)),
      });
    },
    [runUndoable],
  );

  const handleDeleteAssignment = useCallback(
    (assignment: Assignment) => {
      const index = assignments.findIndex(
        (a) =>
          a.taskId === assignment.taskId &&
          a.resourceId === assignment.resourceId,
      );
      if (index === -1) return;

      runUndoable({
        description: "Asignación de recurso eliminada",
        execute: () => setAssignments((prev) => removeAt(prev, index)),
        undo: () =>
          setAssignments((prev) => {
            const next = [...prev];
            next.splice(index, 0, assignment);
            return next;
          }),
      });
    },
    [assignments, runUndoable],
  );

  const handleResetAssignmentColumns = useCallback(() => {
    const previous = assignmentColumnSettings;
    const next = {
      ...DEFAULT_ASSIGNMENT_COLUMN_SETTINGS,
      labelLocale: previous?.labelLocale ?? locale,
    };

    runUndoable({
      description: "Columnas de asignaciones restablecidas",
      execute: () => setAssignmentColumnSettings(next),
      undo: () => setAssignmentColumnSettings(previous),
    });
  }, [assignmentColumnSettings, locale, runUndoable]);

  const updateSaveStatus = useCallback((status: SaveStatus) => {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }, []);

  const doSave = useCallback(async () => {
    // En modo mirador no se guarda nunca. Es redundante -el servidor rechaza
    // igual, porque no hay sesión ni pertenencia- y esa redundancia es el
    // punto: si algún control se escapara, aquí se para antes de viajar.
    if (readOnly) return;

    if (!shouldStartSave({
      hasPendingChanges: isDirtyRef.current,
      saveInFlight: guardadoEnVueloRef.current,
    })) {
      return;
    }

    isDirtyRef.current = false;
    guardadoEnVueloRef.current = true;
    setSaveError(null);
    updateSaveStatus("saving");

    try {
      const data: ProjectData = {
        id: projectId,
        version: versionRef.current,
        name: projectName,
        statusDate: initialStatusDate,
        tasks: calculatedTasks,
        resources: calculatedResources,
        assignments: calculatedAssignments,
        budgetItems,
        budgetMappings,
        baselines,
        calendar,
        matrixPlan: syncedMatrixPlan,
        detectionDictionary,
        mppTaskColumns,
        mppResourceColumns,
        mppAssignmentColumns,
        customFieldDefinitions: calculatedMpp.customFieldDefinitions,
        calculationEngineVersion: calculatedMpp.engineVersion,
        calculatedAt: calculatedMpp.calculatedAt,
        taskColumnSettings,
        resourceColumnSettings,
        assignmentColumnSettings,
        uiSettings,
        planningAuditEvents,
        observations,
      };
      const result = await saveProject(data);
      if (result.success) {
        setProjectId(result.id);
        // La versión nueva, para que el siguiente guardado no choque con este.
        versionRef.current = result.version;
        updateSaveStatus("saved");
        setLastSavedAt(new Date());
        setTimeout(() => updateSaveStatus("idle"), 2000);
      } else {
        // Lo que no llegó al servidor sigue pendiente: si no se vuelve a marcar
        // sucio, el aviso al cerrar deja pasar un trabajo que se va a perder.
        isDirtyRef.current = true;
        // El rechazo por versión no es un fallo de red: hay que decirlo, porque
        // recargar sin saberlo tiraría el trabajo del usuario.
        setSaveError(result.error ?? null);
        updateSaveStatus("error");
        setTimeout(() => updateSaveStatus("idle"), 3000);
      }
    } catch {
      isDirtyRef.current = true;
      updateSaveStatus("error");
      setTimeout(() => updateSaveStatus("idle"), 3000);
    } finally {
      guardadoEnVueloRef.current = false;
    }
  }, [projectId, projectName, initialStatusDate, calculatedTasks, calculatedResources, calculatedAssignments, budgetItems, budgetMappings, baselines, calendar, syncedMatrixPlan, mppTaskColumns, mppResourceColumns, mppAssignmentColumns, calculatedMpp.customFieldDefinitions, calculatedMpp.engineVersion, calculatedMpp.calculatedAt, taskColumnSettings, resourceColumnSettings, assignmentColumnSettings, uiSettings, planningAuditEvents, observations, detectionDictionary, updateSaveStatus]);

  // Use a ref to avoid the interval effect depending on doSave's reference
  const doSaveRef = useRef(doSave);

  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    isDirtyRef.current = true;
    void doSaveRef.current();
  }, []);

  const handleRoleViewPresetChange = useCallback(
    (presetId: NonNullable<UISettings["roleViewPreset"]>) => {
      const next = applyRoleViewPreset(uiSettings, taskColumnSettings, presetId);
      setUISettings(next.uiSettings);
      setTaskColumnSettings(next.taskColumnSettings);
      setActiveView(next.activeView);
      setScale(next.scale);
    },
    [setActiveView, setScale, taskColumnSettings, uiSettings],
  );

  const handleInteractionModeChange = useCallback(
    (mode: NonNullable<UISettings["interactionMode"]>) => {
      setUISettings((current) => ({
        ...current,
        interactionMode: mode,
      }));
    },
    [],
  );

  const commandActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: "add-task",
        label: locale === "en" ? "Add task" : "Agregar tarea",
        hint: locale === "en" ? "Create a new task at the end" : "Crea una tarea al final",
        keywords: "new nueva task tarea crear agregar insert",
      },
      {
        id: "save-now",
        label: locale === "en" ? "Save now" : "Guardar ahora",
        hint: locale === "en" ? "Persist the current project" : "Persiste el proyecto actual",
        keywords: "save guardar persistir autosave",
      },
      {
        id: "undo",
        label: locale === "en" ? "Undo" : "Deshacer",
        hint: locale === "en" ? "Revert the last planning edit" : "Revierte la última edición",
        keywords: "undo deshacer revertir",
        disabled: !canUndo,
      },
      {
        id: "redo",
        label: locale === "en" ? "Redo" : "Rehacer",
        hint: locale === "en" ? "Restore the reverted edit" : "Restaura la edición revertida",
        keywords: "redo rehacer restaurar",
        disabled: !canRedo,
      },
      {
        id: "view-gantt",
        label: locale === "en" ? "Open Gantt" : "Abrir Gantt",
        hint: locale === "en" ? "Return to the main planning view" : "Vuelve a la vista principal",
        keywords: "gantt cronograma chart",
      },
      {
        id: "view-task-sheet",
        label: locale === "en" ? "Open Task Sheet" : "Abrir Hoja de Tareas",
        hint: locale === "en" ? "Edit the task table" : "Edita la tabla de tareas",
        keywords: "task sheet hoja tareas tabla",
      },
      {
        id: "view-matrix",
        label: locale === "en" ? "Open Matrix" : "Abrir Matriz",
        hint: locale === "en" ? "Edit matrix scheduling" : "Edita la programación matricial",
        keywords: "matrix matriz programación matricial ubicaciones disciplinas",
      },
      {
        id: "view-executive",
        label: locale === "en" ? "Open Executive Dashboard" : "Abrir Dashboard Ejecutivo",
        hint: locale === "en" ? "Review cost, scope and schedule health" : "Revisa costo, alcance y cronograma",
        keywords: "executive ejecutivo dashboard pmi triple restriccion",
      },
      {
        id: "view-scurve",
        label: locale === "en" ? "Open S Curve" : "Abrir Curva S",
        hint: locale === "en" ? "Review schedule, budget and earned value" : "Revisa cronograma, presupuesto y valor ganado",
        keywords: "s curve curva valor ganado presupuesto avance",
      },
      {
        id: "view-lob",
        label: locale === "en" ? "Open Line of Balance" : "Abrir Línea de Balance",
        hint: locale === "en" ? "Review repetitive production flow" : "Revisa producción repetitiva por ubicación",
        keywords: "lob línea balance linea produccion ubicacion",
      },
      {
        id: "view-conflictos",
        label: locale === "en" ? "Open Issues" : "Abrir Problemas",
        hint:
          locale === "en"
            ? "Review bottlenecks and dependency conflicts"
            : "Revisa cuellos de botella y conflictos de dependencias",
        keywords: "conflicts conflictos violaciones dependencias problemas cuellos botella bottlenecks",
      },
      {
        id: "view-network",
        label: locale === "en" ? "Open Network Diagram" : "Abrir Diagrama de Red",
        hint: locale === "en" ? "Review task dependencies as a network" : "Revisa el orden de la obra y sus dependencias en red",
        keywords: "network red diagrama dependencias precedencias",
      },
      {
        id: "view-unidad-tipica",
        label: locale === "en" ? "Open Typical Unit" : "Abrir Unidad Típica",
        hint: locale === "en" ? "Review repetitive systems by level" : "Revisa sistemas repetidos por nivel",
        keywords: "unidad tipica típica niveles ritmo repetitivo",
      },
      {
        id: "view-calendario",
        label: locale === "en" ? "Open Calendar" : "Abrir Calendario",
        hint: locale === "en" ? "Review working days and task overlay" : "Revisa días laborales y tareas",
        keywords: "calendar calendario festivos laboral tareas",
      },
      {
        id: "zoom-day",
        label: locale === "en" ? "Zoom by day" : "Zoom por día",
        hint: locale === "en" ? "Set timeline scale to days" : "Cambia la escala a días",
        keywords: "zoom day día dia escala",
      },
      {
        id: "zoom-week",
        label: locale === "en" ? "Zoom by week" : "Zoom por semana",
        hint: locale === "en" ? "Set timeline scale to weeks" : "Cambia la escala a semanas",
        keywords: "zoom week semana escala",
      },
      {
        id: "zoom-month",
        label: locale === "en" ? "Zoom by month" : "Zoom por mes",
        hint: locale === "en" ? "Set timeline scale to months" : "Cambia la escala a meses",
        keywords: "zoom month mes escala",
      },
      {
        id: "export-schedule",
        label: locale === "en" ? "Export the schedule" : "Exportar el cronograma",
        hint:
          locale === "en"
            ? "Download the visible schedule as CSV"
            : "Descarga el cronograma visible en CSV",
        keywords: "export exportar csv excel descargar cronograma",
      },
      {
        id: "view-settings",
        label: locale === "en" ? "Settings" : "Configuración",
        hint:
          locale === "en"
            ? "Project calendar and preferences"
            : "Calendario del proyecto y preferencias",
        keywords: "settings configuracion configuración ajustes calendario",
      },
      {
        id: "zoom-quarter",
        label: locale === "en" ? "Zoom by quarter" : "Zoom por trimestre",
        hint: locale === "en" ? "Set timeline scale to quarters" : "Cambia la escala a trimestres",
        keywords: "zoom quarter trimestre escala",
      },
    ],
    [canRedo, canUndo, locale],
  );

  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim();
    if (!query) return commandActions;
    return commandActions.filter((command) =>
      // Una errata dejaba la paleta vacía justo cuando más falta hace (M36).
      fuzzyMatches(
        `${command.label} ${command.hint} ${command.keywords}`,
        query,
      ),
    );
  }, [commandActions, commandQuery]);

  const runCommand = useCallback((command: CommandPaletteAction) => {
    if (command.disabled) return;

    switch (command.id) {
      case "add-task":
        handleAddTask();
        break;
      case "save-now":
        handleManualSave();
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "view-gantt":
        setActiveView("gantt");
        break;
      case "view-task-sheet":
        setActiveView("taskSheet");
        break;
      case "view-matrix":
        setActiveView("matrix");
        break;
      case "view-settings":
        setActiveView("settings");
        break;
      case "export-schedule":
        // Antes esto solo cambiaba de vista: el comando anunciaba «descarga en
        // CSV» y no descargaba nada. Ahora descarga, con el mismo código que el
        // botón de la tabla.
        downloadScheduleCsv(calculatedTasks, observations);
        break;
      case "view-executive":
        setActiveView("executive");
        break;
      case "view-scurve":
        setActiveView("scurve");
        break;
      case "view-lob":
        setActiveView("lob");
        break;
      case "view-conflictos":
        setActiveView("bottlenecks");
        break;
      case "view-network":
        setActiveView("network");
        break;
      case "view-unidad-tipica":
        setActiveView("unidadTipica");
        break;
      case "view-calendario":
        setActiveView("calendario");
        break;
      case "zoom-day":
        setScale("day");
        break;
      case "zoom-week":
        setScale("week");
        break;
      case "zoom-month":
        setScale("month");
        break;
      case "zoom-quarter":
        setScale("quarter");
        break;
    }

    setCommandPaletteOpen(false);
    setCommandQuery("");
  }, [handleAddTask, handleManualSave, redo, setActiveView, setScale, undo]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const frame = requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [commandPaletteOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const opensPalette =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (opensPalette) {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if (!commandPaletteOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setCommandPaletteOpen(false);
        setCommandQuery("");
        return;
      }

      if (event.key === "Enter") {
        const nextCommand = filteredCommands.find((command) => !command.disabled);
        if (nextCommand) {
          event.preventDefault();
          runCommand(nextCommand);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, filteredCommands, runCommand]);

  useEffect(() => {
    if (!didMountSaveStateRef.current) {
      didMountSaveStateRef.current = true;
      return;
    }

    isDirtyRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      doSaveRef.current();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    tasks,
    resources,
    assignments,
    budgetItems,
    budgetMappings,
    baselines,
    calendar,
    syncedMatrixPlan,
    // Sin esta línea, corregir una ubicación no se guarda: es exactamente el
    // bug que M24 tuvo con las observaciones, y reaparece con cada dato nuevo
    // del proyecto que se olvide aquí.
    detectionDictionary,
    taskColumnSettings,
    resourceColumnSettings,
    assignmentColumnSettings,
    uiSettings,
    projectName,
  ]);

  /**
   * Las observaciones se guardan al instante, sin pasar por el temporizador.
   *
   * Anotar en obra es un acto único: no hay nada que agrupar, y quien anota
   * cierra la pestaña a los dos segundos. Esperar 750 ms era exactamente la
   * ventana en la que se perdía lo escrito (M24).
   */
  useEffect(() => {
    if (!didMountObservationsRef.current) {
      didMountObservationsRef.current = true;
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    isDirtyRef.current = true;
    void doSaveRef.current();
  }, [observations]);

  /**
   * Preguntar antes de cerrar, pero solo si hay algo que perder: un diálogo
   * que sale siempre es un diálogo que nadie lee.
   */
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hayQuePerder = shouldWarnBeforeUnload({
        hasPendingChanges: isDirtyRef.current || matrixDraftDirtyRef.current,
        saveStatus: saveStatusRef.current,
      });
      if (!hayQuePerder) return;

      // El navegador no deja personalizar el texto; solo pedir la confirmación.
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      void doSaveRef.current();
    },
    [],
  );

  return (
    <div data-testid="gantt-view" className="app-shell flex h-full min-w-0 flex-col overflow-hidden">
      <div className="gantt-topbar flex min-w-0 shrink-0 items-center gap-[var(--gantt-topbar-gap)] overflow-hidden">
        <ProjectToolbar
          readOnly={readOnly}
          activeView={activeView}
          onViewChange={setActiveView}
          scale={scale}
          onScaleChange={setScale}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          projectName={projectName}
          projectStart={projectInfo.start}
          projectFinish={projectInfo.finish}
          taskCount={projectInfo.count}
          durationDays={projectInfo.durationDays}
          averageProgress={projectInfo.averageProgress}
          dependencyCount={projectInfo.dependencyCount}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          hasSelection={selectedTaskIds.length > 0}
          onOpenObservations={() =>
            setObservationPanelTaskId(selectedTaskIds[0] ?? null)
          }
          pendingObservationCount={
            observations.filter((o) => o.status === "pending").length
          }
          baselines={baselines}
          activeBaselineId={activeBaselineId}
          onSaveBaseline={handleSaveBaseline}
          onSelectBaseline={handleSelectBaseline}
          onDeleteBaseline={handleDeleteBaseline}
          proposedBaselineName={`Línea base ${baselines.length + 1}`}
          locale={locale}
        />
        <span
          className="gantt-save-status"
          data-status={saveStatus}
          data-testid="save-status"
          role="status"
        >
          {saveStatusLabel(saveStatus, lastSavedAt, { readOnly })}
        </span>
        {saveStatus === "error" && saveError && (
          <span
            data-testid="save-error-message"
            role="alert"
            className="max-w-xs truncate text-[length:var(--gantt-topbar-font-size)] font-semibold text-[var(--aia-warn-main)]"
            title={saveError}
          >
            {saveError}
          </span>
        )}
        {saveStatus === "error" && esConflictoDeVersion && (
          // Reintentar mandaría la misma versión vieja y volvería a chocar
          // siempre: lo que resuelve un conflicto es traer lo que hay.
          <button
            type="button"
            data-testid="save-reload"
            onClick={() => window.location.reload()}
            className="apple-button-secondary inline-flex h-[var(--gantt-topbar-control-height)] shrink-0 items-center rounded-[var(--radius-lg)] px-[var(--gantt-topbar-control-padding-inline)] text-[length:var(--gantt-topbar-font-size)] font-semibold"
          >
            Recargar
          </button>
        )}
        {saveStatus === "error" && !esConflictoDeVersion && (
          <button
            type="button"
            data-testid="save-retry"
            onClick={handleManualSave}
            className="apple-button-secondary inline-flex h-[var(--gantt-topbar-control-height)] shrink-0 items-center rounded-[var(--radius-lg)] px-[var(--gantt-topbar-control-padding-inline)] text-[length:var(--gantt-topbar-font-size)] font-semibold"
          >
            Reintentar
          </button>
        )}
        <label
          className="apple-button-secondary gantt-role-view inline-flex h-[var(--gantt-topbar-control-height)] shrink-0 items-center gap-[var(--gantt-topbar-gap)] rounded-[var(--radius-lg)] px-[var(--gantt-topbar-control-padding-inline)] text-[length:var(--gantt-topbar-font-size)] font-semibold"
          title={
            locale === "en"
              ? "Apply a role-based saved view preset"
              : "Aplicar una vista guardada por rol"
          }
        >
          <SlidersHorizontal className="gantt-topbar__icon" aria-hidden />
          <span>{locale === "en" ? "Role view" : "Vista rol"}</span>
          <select
            data-testid="role-view-preset-select"
            value={uiSettings.roleViewPreset ?? "planner"}
            onChange={(event) =>
              handleRoleViewPresetChange(event.target.value as NonNullable<UISettings["roleViewPreset"]>)
            }
            className="gantt-role-view__select max-w-[var(--gantt-toolbar-info-width)] border-0 bg-[var(--color-transparent)] text-[length:var(--gantt-topbar-font-size)] font-semibold outline-none"
            aria-label={locale === "en" ? "Role view preset" : "Preset de vista por rol"}
          >
            {ROLE_VIEW_PRESETS.map((preset) => (
              <option
                key={preset.id}
                value={preset.id}
                title={roleViewPresetDescription(preset, locale)}
              >
                {roleViewPresetLabel(preset, locale)}
              </option>
            ))}
          </select>
        </label>
        <div
          className="apple-button-secondary gantt-mode-toggle inline-flex h-[var(--gantt-topbar-control-height)] shrink-0 items-center gap-[var(--project-view-sidebar-item-gap)] rounded-[var(--radius-lg)] p-[var(--project-view-sidebar-item-gap)] text-[length:var(--gantt-topbar-font-size)] font-semibold"
          data-testid="interaction-mode-toggle"
          title={
            locale === "en"
              ? "Switch between simple and advanced planning controls"
              : "Cambiar entre controles simples y avanzados"
          }
        >
          {(["simple", "advanced"] as const).map((mode) => {
            const active = interactionMode === mode;
            return (
              <button
                key={mode}
                type="button"
                data-testid={`interaction-mode-${mode}`}
                className={`gantt-mode-toggle__button h-[calc(var(--gantt-topbar-control-height)-(var(--project-view-sidebar-item-gap)*2))] rounded-[var(--radius-md)] border-0 px-[var(--gantt-topbar-control-padding-inline)] ${
                  active
                    ? "bg-[var(--aia-corp-main)] text-[var(--color-text-on-primary)]"
                    : "bg-[var(--color-transparent)] text-[var(--color-text-muted)]"
                }`}
                data-active={active}
                aria-pressed={active}
                onClick={() => handleInteractionModeChange(mode)}
              >
                {mode === "simple"
                  ? locale === "en" ? "Simple" : "Simple"
                  : locale === "en" ? "Advanced" : "Avanzado"}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          data-testid="command-palette-open"
          className="apple-button-secondary gantt-command-button inline-flex h-[var(--gantt-topbar-control-height)] shrink-0 items-center gap-[var(--gantt-topbar-gap)] rounded-[var(--radius-lg)] px-[var(--gantt-topbar-control-padding-inline)] text-[length:var(--gantt-topbar-font-size)] font-semibold"
          onClick={() => setCommandPaletteOpen(true)}
          title={locale === "en" ? "Command palette" : "Paleta de comandos"}
        >
          <CommandIcon className="gantt-topbar__icon" aria-hidden />
          {locale === "en" ? "Commands" : "Comandos"}
          {/* El atajo a la vista: se aprende usando el botón, no leyendo ayuda */}
          <kbd className="gantt-command-button__shortcut">⌘K</kbd>
        </button>
        <button
          type="button"
          data-testid="open-view-help"
          className="apple-button-secondary gantt-command-button inline-flex h-[var(--gantt-topbar-control-height)] shrink-0 items-center gap-[var(--gantt-topbar-gap)] rounded-[var(--radius-lg)] px-[var(--gantt-topbar-control-padding-inline)] text-[length:var(--gantt-topbar-font-size)] font-semibold"
          onClick={() => setHelpOpen((open) => !open)}
          title={locale === "en" ? "What is this view for" : "Qué es esta vista"}
        >
          <HelpCircle className="gantt-topbar__icon" aria-hidden />
          {locale === "en" ? "Help" : "Ayuda"}
        </button>
      </div>

      <div className="gantt-project-meta-strip shrink-0 border-b border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-[var(--gantt-meta-strip-padding-inline)] py-[var(--gantt-meta-strip-padding-block)]">
        <div className="gantt-project-meta-strip__content flex flex-wrap items-center gap-x-[var(--gantt-meta-strip-gap-inline)] gap-y-[var(--gantt-meta-strip-gap-block)] text-[length:var(--gantt-meta-strip-font-size)] text-[var(--color-text-muted)]">
          <span className="gantt-project-meta-strip__name">{projectName}</span>
          <span className="gantt-project-meta-strip__summary">
            Inicio: {projectInfo.start ? formatStableDate(projectInfo.start) : "s/d"} · Fin:{" "}
            {projectInfo.finish ? formatStableDate(projectInfo.finish) : "s/d"} ·{" "}
            {projectInfo.durationDays}d · Avance: {Math.round(projectInfo.averageProgress)}% ·{" "}
            {projectInfo.count} tareas · {projectInfo.dependencyCount} dep.
          </span>
          {activeView === "gantt" && isAdvancedMode && (
            <details
              className="gantt-planning-dropdown"
              data-testid="gantt-planning-dropdown"
            >
              <summary
                className="gantt-planning-dropdown__summary"
                data-testid="gantt-planning-dropdown-summary"
              >
                <SlidersHorizontal className="gantt-planning-dropdown__icon" aria-hidden />
                <span>
                  {locale === "en" ? "Planning" : "Planificación"}
                </span>
                <ChevronDown className="gantt-planning-dropdown__chevron" aria-hidden />
              </summary>
              <div className="gantt-planning-dropdown__menu">
                <PlanningAssistantPanel
                  recommendations={planningRecommendations}
                  locale={locale}
                  structurePreview={structurePreviewSummary}
                  onPreviewStructureNormalization={() => setShowStructurePreview(true)}
                  onCancelStructurePreview={() => setShowStructurePreview(false)}
                  onApplyStructureNormalization={() => {
                    normalizeStructure();
                    setShowStructurePreview(false);
                  }}
                />
                <WhatIfScenarioPanel
                  tasks={calculatedTasks}
                  selectedTaskId={selectedTaskIds[0]}
                  locale={locale}
                  onApplyDuration={(taskId, duration) =>
                    updateTask(taskId, "duration", duration)
                  }
                />
              </div>
            </details>
          )}
        </div>
      </div>

      {commandPaletteOpen && (
        <div
          data-testid="command-palette"
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/20 px-4 pt-24 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={locale === "en" ? "Command palette" : "Paleta de comandos"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCommandPaletteOpen(false);
              setCommandQuery("");
            }
          }}
        >
          <div className="apple-surface w-full max-w-xl overflow-hidden rounded-lg">
            <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] px-3 py-2">
              <Search size={16} className="text-[var(--color-text-muted)]" aria-hidden />
              <input
                ref={commandInputRef}
                data-testid="command-palette-input"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder={
                  locale === "en"
                    ? "Search commands or views"
                    : "Buscar comandos o vistas"
                }
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-[var(--color-text-strong)] outline-none"
              />
              <button
                type="button"
                data-testid="command-palette-close"
                className="apple-icon-button h-8 w-8"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setCommandQuery("");
                }}
                title={locale === "en" ? "Close" : "Cerrar"}
              >
                <X size={15} aria-hidden />
              </button>
            </div>
            <div className="max-h-96 overflow-auto p-2">
              {filteredCommands.length === 0 ? (
                <p className="px-3 py-6 text-sm text-[var(--color-text-muted)]">
                  {locale === "en"
                    ? "No matching commands."
                    : "No hay comandos coincidentes."}
                </p>
              ) : (
                filteredCommands.map((command) => (
                  <button
                    key={command.id}
                    type="button"
                    data-testid={`command-palette-item-${command.id}`}
                    disabled={command.disabled}
                    onClick={() => runCommand(command)}
                    className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--color-bg-surface-secondary)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--color-text-strong)]">
                        {command.label}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {command.hint}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-[0.6875rem] font-semibold text-[var(--color-text-muted)]">
                      {locale === "en" ? "Enter" : "Enter"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <UndoToast action={lastAction} onUndo={undo} locale={locale} />
      <RejectionToast rejection={lastRejection} locale={locale} />

      {lastChange && (
        <div className="gantt-impact-strip" key={lastChange.token}>
          <span data-testid="impact-summary" role="status">
            {lastChange.taskIds.length === 1
              ? "1 actividad se movió"
              : `${lastChange.taskIds.length} actividades se movieron`}
          </span>
          {deepChange?.projectFinishMoved != null && (
            <span data-testid="deep-change-finish" role="status">
              {deepChange.projectFinishMoved > 0
                ? `El fin de obra se corrió ${deepChange.projectFinishMoved} días`
                : `El fin de obra se adelantó ${Math.abs(deepChange.projectFinishMoved)} días`}
            </span>
          )}
          {deepChange?.criticalPathChanged && (
            <span data-testid="deep-change-critical" role="status">
              La ruta crítica cambió de actividades
            </span>
          )}
        </div>
      )}

      {helpOpen && (
        <ViewHelpPanel view={activeView} onClose={() => setHelpOpen(false)} />
      )}

      {observationPanelTask && (
        <ObservationPanel
          taskId={observationPanelTask.id}
          taskName={observationPanelTask.name}
          observations={observations}
          onAdd={(text, responsible) =>
            addObservation(observationPanelTask.id, text, responsible)
          }
          onToggle={toggleObservation}
          onDelete={deleteObservation}
          onClose={() => setObservationPanelTaskId(null)}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Sidebar de navegación de vistas */}
        <ViewSidebar
          activeView={activeView}
          onViewChange={setActiveView}
          locale={locale}
          blurbContext={sidebarBlurbContext}
        />

        {/* Contenido de la vista activa */}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {activeView === "gantt" && (
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              <div
                id="gantt-table-ribbon-host"
                data-testid="gantt-table-ribbon-slot"
                className="gantt-table-ribbon-slot"
              />
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                <SplitPane
                  defaultSplit={44}
                  left={
                    <GanttTable
                      tasks={calculatedTasks}
                      selectedTaskIds={selectedTaskIds}
                      onTaskSelect={handleTaskSelect}
                      onUpdateTask={updateTask}
                      onInvalidEdit={reportInvalidEdit}
                      changedTaskIds={lastChange?.taskIds ?? []}
                      calendar={calendar}
                      observations={observations}
                      mppTaskColumns={visibleMppTaskColumns}
                      customFieldDefinitions={calculatedMpp.customFieldDefinitions}
                      columnSettings={taskColumnSettings}
                      locale={locale}
                      onColumnSettingsChange={setTaskColumnSettings}
                      onResetColumns={handleResetTaskColumns}
                      onLocaleChange={(nextLocale: UILocale) =>
                        setUISettings((current) => ({ ...current, locale: nextLocale }))
                      }
                      taskFilter={uiSettings.taskFilter}
                      onTaskFilterChange={(nextFilter) =>
                        setUISettings((current) => ({
                          ...current,
                          taskFilter: nextFilter,
                        }))
                      }
                      onIndentTask={indentTask}
                      onOutdentTask={outdentTask}
                      onMoveTaskUp={moveTaskUp}
                      onMoveTaskDown={moveTaskDown}
                      onReorderTask={reorderTask}
                      onInsertTask={insertStructuredTask}
                      onApplyStructureTemplate={applyStructureTemplate}
                      onSmartPasteTasks={smartPasteTasks}
                    />
                  }
                  right={
                    <GanttChart
                      tasks={tasksForChart}
                      showBaseline={Boolean(activeBaseline)}
                      observations={observations}
                      calendar={calendar}
                      scale={scale}
                      selectedTaskIds={selectedTaskIds}
                      onTaskSelect={handleTaskSelect}
                      onTaskClick={onTaskClick}
                      onCreateDependency={createDependency}
                      dragState={dragState}
                      onDragStart={onDragStart}
                      resizeState={resizeState}
                      onResizeStart={onResizeStart}
                    />
                  }
                />
              </div>
            </div>
          )}

          {activeView === "taskSheet" && (
            <TaskSheetView
              tasks={calculatedTasks}
              onUpdateTask={updateTask}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={handleTaskSelect}
              mppTaskColumns={visibleMppTaskColumns}
              customFieldDefinitions={calculatedMpp.customFieldDefinitions}
              columnSettings={taskColumnSettings}
              locale={locale}
              onColumnSettingsChange={setTaskColumnSettings}
              onLocaleChange={(nextLocale: UILocale) =>
                setUISettings((current) => ({ ...current, locale: nextLocale }))
              }
              taskFilter={uiSettings.taskFilter}
              onTaskFilterChange={(nextFilter) =>
                setUISettings((current) => ({
                  ...current,
                  taskFilter: nextFilter,
                }))
              }
              onIndentTask={indentTask}
              onOutdentTask={outdentTask}
              onMoveTaskUp={moveTaskUp}
              onMoveTaskDown={moveTaskDown}
              onReorderTask={reorderTask}
              onInsertTask={insertStructuredTask}
              onApplyStructureTemplate={applyStructureTemplate}
              onSmartPasteTasks={smartPasteTasks}
            />
          )}

          {activeView === "executive" && (
            <ExecutivePlanningDashboard
              summary={executiveSummary}
              onNavigate={setActiveView}
            />
          )}

          {activeView === "tracking" && (
            <TrackingGanttView
              tasks={calculatedTasks}
              scale={scale}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={handleTaskSelect}
              onTaskClick={onTaskClick}
              baselines={baselines}
              activeBaselineId={activeBaselineId}
              onSaveBaseline={handleSaveBaseline}
              onSelectBaseline={setActiveBaselineId}
            />
          )}

          {activeView === "network" && (
            <NetworkDiagramView
              tasks={calculatedTasks}
              onTaskClick={onTaskClick}
              onCreateDependency={createDependency}
              onDeleteDependency={(dependency) =>
                updateTask(
                  dependency.to,
                  "dependencies",
                  dependenciesAfterRemoval(calculatedTasks, dependency),
                )
              }
              onRejectEdit={reportInvalidEdit}
              onNavigate={setActiveView}
            />
          )}

          {activeView === "resources" &&
            namedResources.length === 0 &&
            !resourcesIntroDismissed && (
              <ResourcesEmptyState
                locale={locale}
                onCreateResource={() => {
                  setResourceSubView("sheet");
                  setResourcesIntroDismissed(true);
                }}
                onOpenBudget={() => {
                  setResourceSubView("budget");
                  setResourcesIntroDismissed(true);
                }}
              />
            )}

          {activeView === "resources" &&
            (namedResources.length > 0 || resourcesIntroDismissed) && (
            <div className="apple-module flex h-full flex-col">
              <div
                className="apple-subtoolbar"
              >
                <button
                  onClick={() => setResourceSubView("sheet")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "1px solid var(--color-hairline)",
                    cursor: "pointer",
                    background: resourceSubView === "sheet" ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
                    color: resourceSubView === "sheet" ? "#ffffff" : "var(--color-text-muted)",
                  }}
                >
                  {resourceViewLabels.sheet}
                </button>
                <button
                  onClick={() => setResourceSubView("usage")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "1px solid var(--color-hairline)",
                    cursor: "pointer",
                    background: resourceSubView === "usage" ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
                    color: resourceSubView === "usage" ? "#ffffff" : "var(--color-text-muted)",
                  }}
                >
                  {resourceViewLabels.usage}
                </button>
                <button
                  onClick={() => setResourceSubView("assignments")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "1px solid var(--color-hairline)",
                    cursor: "pointer",
                    background: resourceSubView === "assignments" ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
                    color: resourceSubView === "assignments" ? "#ffffff" : "var(--color-text-muted)",
                  }}
                >
                  {resourceViewLabels.assignments}
                </button>
                <button
                  onClick={() => setResourceSubView("budget")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "1px solid var(--color-hairline)",
                    cursor: "pointer",
                    background: resourceSubView === "budget" ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
                    color: resourceSubView === "budget" ? "#ffffff" : "var(--color-text-muted)",
                  }}
                >
                  {resourceViewLabels.budget}
                </button>
                <button
                  onClick={() => setResourceSubView("mapping")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "1px solid var(--color-hairline)",
                    cursor: "pointer",
                    background: resourceSubView === "mapping" ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
                    color: resourceSubView === "mapping" ? "#ffffff" : "var(--color-text-muted)",
                  }}
                >
                  {resourceViewLabels.mapping}
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {resourceSubView === "sheet" && (
                  <ResourceSheetView
                    resources={calculatedResources}
                    onAddResource={handleAddResource}
                    onEditResource={handleEditResource}
                    onDeleteResource={handleDeleteResource}
                    mppResourceColumns={mppResourceColumns}
                    customFieldDefinitions={calculatedMpp.customFieldDefinitions}
                    columnSettings={resourceColumnSettings}
                    locale={locale}
                    onColumnSettingsChange={setResourceColumnSettings}
                    onResetColumns={handleResetResourceColumns}
                    onLocaleChange={(nextLocale: UILocale) =>
                      setUISettings({ locale: nextLocale })
                    }
                  />
                )}
                {resourceSubView === "assignments" && (
                  <AssignmentSheetView
                    assignments={calculatedAssignments}
                    tasks={calculatedTasks}
                    resources={calculatedResources}
                    mppAssignmentColumns={mppAssignmentColumns}
                    customFieldDefinitions={calculatedMpp.customFieldDefinitions}
                    columnSettings={assignmentColumnSettings}
                    locale={locale}
                    onColumnSettingsChange={setAssignmentColumnSettings}
                    onResetColumns={handleResetAssignmentColumns}
                    onCreateAssignment={handleCreateAssignment}
                    onDeleteAssignment={handleDeleteAssignment}
                    onLocaleChange={(nextLocale: UILocale) =>
                      setUISettings({ locale: nextLocale })
                    }
                  />
                )}
                {resourceSubView === "usage" && (
                  <ResourceUsageView
                    resources={calculatedResources}
                    tasks={calculatedTasks}
                    assignments={calculatedAssignments}
                  />
                )}
                {resourceSubView === "budget" && (
                  <BudgetTable
                    items={budgetItems}
                    onAddItem={handleAddBudgetItem}
                    onUpdateItem={handleUpdateBudgetItem}
                    onDeleteItem={handleDeleteBudgetItem}
                    onImportCSV={handleImportBudgetCSV}
                  />
                )}
                {resourceSubView === "mapping" && (
                  <BudgetMapping
                    budgetItems={budgetItems}
                    tasks={calculatedTasks}
                    mappings={budgetMappings}
                    onAddMapping={handleAddBudgetMapping}
                    onRemoveMapping={handleRemoveBudgetMapping}
                  />
                )}
              </div>
            </div>
          )}

          {activeView === "lob" && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto">
              <div className="min-h-0 min-w-0 flex-1">
                <LineOfBalance
                  activities={automaticLOB.activities}
                  units={automaticLOB.units}
                  scale={scale}
                  onScaleChange={setScale}
                />
              </div>
              <LocationCorrectionPanel
                tasks={calculatedTasks}
                dictionary={detectionDictionary}
                onCorrect={handleCorrectLocation}
              />
            </div>
          )}

          {activeView === "matrix" && (
            <>
            {pendingMatrixConflicts && (
              <>
                {pendingMatrixConflicts.changed && (
                  <p
                    data-testid="conflicts-changed"
                    className="px-3 py-2 text-xs font-semibold text-[var(--aia-warn-main)]"
                  >
                    El cronograma cambió mientras decidías, así que no se aplicó
                    nada. Estos son los conflictos de ahora: vuelve a elegir.
                  </p>
                )}
                <ConflictChooser
                  key={pendingMatrixConflicts.conflicts
                    .map((conflict) => `${conflict.taskId}::${conflict.field}`)
                    .join("|")}
                  conflicts={pendingMatrixConflicts.conflicts}
                  onResolve={handleResolveMatrixConflicts}
                  onCancel={() => setPendingMatrixConflicts(null)}
                />
              </>
            )}
            <MatrixEditorView
              key={matrixEditorKey}
              matrixPlan={syncedMatrixPlan}
              tasks={calculatedTasks}
              onApplyMatrixPlan={handleApplyMatrixPlan}
              onSyncFromGantt={handleSyncMatrixFromGantt}
              calendar={calendar}
              onRemoveArea={handleRemoveMatrixArea}
              onDirtyChange={(dirty) => {
                // El borrador de la matriz también es trabajo que se puede
                // perder: entra en el aviso al cerrar (M28).
                matrixDraftDirtyRef.current = dirty;
              }}
            />
            </>
          )}

          {activeView === "scurve" && (
            <SCurveView
              tasks={calculatedTasks}
              budgetMappings={budgetMappings}
              budgetItems={budgetItems}
              statusDate={initialStatusDate}
              projectId={projectId}
              baselines={baselines}
            />
          )}

          {activeView === "observaciones" && (
            <ObservationsView
              observations={observations}
              tasks={calculatedTasks}
              statusDate={initialStatusDate}
              onToggle={toggleObservation}
              onDelete={deleteObservation}
            />
          )}

          {activeView === "bottlenecks" && (
            <ProblemsView
              tasks={calculatedTasks}
              issues={scheduleIssues}
              bottlenecks={bottlenecks}
            />
          )}

          {activeView === "unidadTipica" && (
            <TypicalUnitView tasks={calculatedTasks} />
          )}

          {activeView === "calendario" && (
            <CalendarView tasks={calculatedTasks} calendar={calendar} />
          )}

          {activeView === "settings" && (
            <CalendarSettingsView
              calendar={calendar}
              onChange={updateCalendar}
              issues={calendarIssues}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function GanttView({
  projectId,
  projectName,
  statusDate,
  version,
  readOnly,
  tasks,
  calendar = DEFAULT_PROJECT_CALENDAR,
  resources = [],
  assignments = [],
  budgetItems = [],
  budgetMappings = [],
  baselines = [],
  matrixPlan,
  detectionDictionary,
  mppTaskColumns = [],
  mppResourceColumns = [],
  mppAssignmentColumns = [],
  customFieldDefinitions = [],
  calculationEngineVersion,
  taskColumnSettings,
  resourceColumnSettings,
  assignmentColumnSettings,
  uiSettings = DEFAULT_UI_SETTINGS,
  planningAuditEvents = [],
  observations = [],
  onTaskClick,
}: GanttViewProps) {
  const initialTasksKey = tasks
    .map((task) => `${task.id}:${task.name}:${task.start.getTime()}:${task.finish.getTime()}`)
    .join("|");
  const initialProjectKey = `${projectId ?? "draft"}:${initialTasksKey}`;

  return (
    <ProjectProvider
      key={initialProjectKey}
      initialTasks={tasks}
      initialCalendar={calendar}
      initialPlanningAuditEvents={planningAuditEvents}
      initialObservations={observations}
    >
      <GanttViewInner
        initialProjectId={projectId}
        initialProjectName={projectName}
        initialStatusDate={statusDate}
        initialVersion={version}
        readOnly={readOnly}
        initialResources={resources}
        initialAssignments={assignments}
        initialBudgetItems={budgetItems}
        initialBudgetMappings={budgetMappings}
        initialBaselines={baselines}
        initialMatrixPlan={matrixPlan}
        initialDetectionDictionary={detectionDictionary}
        initialMppTaskColumns={mppTaskColumns}
        initialMppResourceColumns={mppResourceColumns}
        initialMppAssignmentColumns={mppAssignmentColumns}
        initialCustomFieldDefinitions={customFieldDefinitions}
        initialCalculationEngineVersion={calculationEngineVersion}
        initialTaskColumnSettings={taskColumnSettings}
        initialResourceColumnSettings={resourceColumnSettings}
        initialAssignmentColumnSettings={assignmentColumnSettings}
        initialUISettings={uiSettings}
        onTaskClick={onTaskClick}
      />
    </ProjectProvider>
  );
}
