"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Command as CommandIcon, HelpCircle, Search, SlidersHorizontal, X } from "lucide-react";
import type { GanttScale, GanttTask } from "@/components/gantt/types";
import type { PlanningAuditEvent } from "@/types/audit";
import type { Observation } from "@/lib/observations/observations";
import dynamic from "next/dynamic";

/**
 * Las vistas distintas del Gantt se cargan al abrirlas. Antes las 14 viajaban en
 * el bundle inicial y montaban de golpe: cambiar de vista costaba ~584 ms de INP.
 */
const ViewLoading = () => (
  <div className="gantt-view-loading" role="status">Cargando vista…</div>
);

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
const ProblemsView = dynamic(() => import("@/components/views/ProblemsView"), { loading: ViewLoading });
const CalendarView = dynamic(() => import("@/components/views/CalendarView"), { loading: ViewLoading });
const MatrixEditorView = dynamic(() => import("@/components/views/MatrixEditorView"), { loading: ViewLoading });
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
import {
  DEFAULT_UI_SETTINGS,
  type UISettings,
  type UILocale,
} from "@/types/ui";
import {
  buildMppAssignmentColumnsFromAssignments,
  buildMppResourceColumnsFromResources,
  buildMppTaskColumnsFromTasks,
  normalizeTaskColumnSettings,
  normalizeAssignmentColumnSettings,
  normalizeResourceColumnSettings,
} from "@/lib/mpp/taskColumns";
import { calculateMppFields } from "@/lib/mpp/mppCalculationEngine";
import { ProjectProvider, useProject } from "@/lib/state/ProjectContext";
import { insertAt, removeWhere } from "@/lib/state/undoableCollections";
import { useDragBar } from "@/components/gantt/interaction/useDragBar";
import { useResizeBar } from "@/components/gantt/interaction/useResizeBar";
import {
  ProjectToolbar,
  type ViewType,
} from "@/components/gantt/toolbar";
import ViewSidebar from "@/components/gantt/toolbar/ViewSidebar";
import { saveProject, type ProjectData } from "@/app/actions/project";
import { generateAutomaticLOBFromTasks } from "@/lib/scheduling/lob";
import { detectBottlenecks } from "@/lib/scheduling/bottlenecks";
import {
  applyMatrixUpdate,
  syncMatrixPlanFromTasks,
} from "@/lib/matrix/matrixSync";
import { buildPlanningRecommendations } from "@/lib/gantt/planningRecommendations";
import {
  applyRoleViewPreset,
  findRoleViewPreset,
  ROLE_VIEW_PRESETS,
  roleViewPresetDescription,
  roleViewPresetLabel,
} from "@/lib/gantt/roleViewPresets";
import { normalizeTaskStructure } from "@/lib/gantt/taskStructure";
import { buildExecutivePlanningSummary } from "@/lib/gantt/executiveDashboard";

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
  tasks: GanttTask[];
  calendar?: ProjectCalendar;
  resources?: Resource[];
  assignments?: Assignment[];
  budgetItems?: BudgetItem[];
  budgetMappings?: BudgetMappingType[];
  baselines?: Baseline[];
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
  onTaskClick?: (task: GanttTask) => void;
}

function GanttViewInner({
  initialProjectId,
  initialProjectName,
  initialStatusDate,
  initialResources,
  initialAssignments,
  initialBudgetItems,
  initialBudgetMappings,
  initialBaselines,
  initialMatrixPlan,
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
  initialResources: Resource[];
  initialAssignments: Assignment[];
  initialBudgetItems: BudgetItem[];
  initialBudgetMappings: BudgetMappingType[];
  initialBaselines: Baseline[];
  initialMatrixPlan?: MatrixPlan;
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
  const [activeView, setActiveView] = useState<ViewType>(
    initialRoleViewPreset?.view ?? "gantt",
  );
  const [resources, setResources] = useState<Resource[]>(initialResources);
  // Tarea cuyo panel de observaciones está abierto (null = cerrado).
  const [observationPanelTaskId, setObservationPanelTaskId] = useState<
    string | number | null
  >(null);
  const [assignments] = useState<Assignment[]>(initialAssignments);
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
  const interactionMode = uiSettings.interactionMode ?? "advanced";
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
    () => (matrixPlan ? syncMatrixPlanFromTasks(matrixPlan, tasks) : undefined),
    [matrixPlan, tasks],
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [projectName] = useState<string>(initialProjectName ?? "Sin título");
  const [showStructurePreview, setShowStructurePreview] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const isDirtyRef = useRef(false);
  const didMountSaveStateRef = useRef(false);
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
  const mppTaskColumns = calculatedMpp.mppTaskColumns;
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
    () => generateAutomaticLOBFromTasks(calculatedTasks, syncedMatrixPlan),
    [calculatedTasks, syncedMatrixPlan],
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
      }),
    [bottlenecks, budgetItems, budgetMappings, calculatedTasks, scheduleIssues],
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
  const handleSaveBaseline = useCallback(() => {
    const baselineNumber = baselines.length + 1;
    const newBaseline: Baseline = {
      id: `bl-${Date.now()}`,
      name: `Baseline ${baselineNumber}`,
      createdAt: new Date(),
      tasks: calculatedTasks.map((t) => ({
        taskId: t.id,
        baselineStart: new Date(t.start),
        baselineFinish: new Date(t.finish),
        baselineDuration: t.duration,
        baselineCost: t.cost,
      })),
    };
    setBaselines((prev) => [...prev, newBaseline]);
    setActiveBaselineId(newBaseline.id);
  }, [baselines.length, calculatedTasks]);

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

  const handleEditResource = useCallback((resource: Resource) => {
    setResources((prev) => prev.map((r) => (r.uid === resource.uid ? resource : r)));
  }, []);

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

  const handleUpdateBudgetItem = useCallback((item: BudgetItem) => {
    setBudgetItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }, []);

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

  const handleApplyMatrixPlan = useCallback(
    (nextPlan: MatrixPlan) => {
      const result = applyMatrixUpdate({
        tasks,
        currentPlan: syncedMatrixPlan ?? nextPlan,
        nextPlan,
      });

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
    [matrixPlan, runUndoable, setTasks, syncedMatrixPlan, tasks],
  );

  const handleSyncMatrixFromGantt = useCallback(() => {
    if (!syncedMatrixPlan) return;
    setMatrixPlan(syncedMatrixPlan);
  }, [syncedMatrixPlan]);

  const doSave = useCallback(async () => {
    if (!isDirtyRef.current) return;

    isDirtyRef.current = false;
    setSaveStatus("saving");

    try {
      const data: ProjectData = {
        id: projectId,
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
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [projectId, projectName, initialStatusDate, calculatedTasks, calculatedResources, calculatedAssignments, budgetItems, budgetMappings, baselines, calendar, syncedMatrixPlan, mppTaskColumns, mppResourceColumns, mppAssignmentColumns, calculatedMpp.customFieldDefinitions, calculatedMpp.engineVersion, calculatedMpp.calculatedAt, taskColumnSettings, resourceColumnSettings, assignmentColumnSettings, uiSettings, planningAuditEvents, observations]);

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
    [setScale, taskColumnSettings, uiSettings],
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
        label: locale === "en" ? "Open Conflicts" : "Abrir Conflictos",
        hint: locale === "en" ? "Review dependency violations" : "Revisa violaciones de dependencias",
        keywords: "conflicts conflictos violaciones dependencias",
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
        keywords: "unidad tipica típica niveles productividad repetitivo",
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
        id: "zoom-quarter",
        label: locale === "en" ? "Zoom by quarter" : "Zoom por trimestre",
        hint: locale === "en" ? "Set timeline scale to quarters" : "Cambia la escala a trimestres",
        keywords: "zoom quarter trimestre escala",
      },
    ],
    [canRedo, canUndo, locale],
  );

  const filteredCommands = useMemo(() => {
    const normalizedQuery = commandQuery.trim().toLowerCase();
    if (!normalizedQuery) return commandActions;
    return commandActions.filter((command) => {
      const haystack = `${command.label} ${command.hint} ${command.keywords}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
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
  }, [handleAddTask, handleManualSave, redo, setScale, undo]);

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
    taskColumnSettings,
    resourceColumnSettings,
    assignmentColumnSettings,
    uiSettings,
    projectName,
  ]);

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
          locale={locale}
        />
        {saveStatus !== "idle" && (
          <span
            className="gantt-save-status"
            data-status={saveStatus}
          >
            {saveStatus === "saving" && "Guardando..."}
            {saveStatus === "saved" && "Guardado"}
            {saveStatus === "error" && "Error al guardar"}
          </span>
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

      {helpOpen && (
        <ViewHelpPanel view={activeView} onClose={() => setHelpOpen(false)} />
      )}

      {observationPanelTask && (
        <ObservationPanel
          taskId={observationPanelTask.id}
          taskName={observationPanelTask.name}
          observations={observations}
          onAdd={(text) => addObservation(observationPanelTask.id, text)}
          onToggle={toggleObservation}
          onDelete={deleteObservation}
          onClose={() => setObservationPanelTaskId(null)}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Sidebar de navegación de vistas */}
        <ViewSidebar activeView={activeView} onViewChange={setActiveView} locale={locale} />

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
                      mppTaskColumns={mppTaskColumns}
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
                  }
                  right={
                    <GanttChart
                      tasks={calculatedTasks}
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
              mppTaskColumns={mppTaskColumns}
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
            <ExecutivePlanningDashboard summary={executiveSummary} />
          )}

          {activeView === "tracking" && (
            <TrackingGanttView
              tasks={calculatedTasks}
              scale={scale}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={handleTaskSelect}
              onTaskClick={onTaskClick}
            />
          )}

          {activeView === "network" && (
            <NetworkDiagramView tasks={calculatedTasks} onTaskClick={onTaskClick} />
          )}

          {activeView === "resources" && (
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
            <div className="min-h-0 min-w-0 flex-1">
              <LineOfBalance
                activities={automaticLOB.activities}
                units={automaticLOB.units}
                scale={scale}
                onScaleChange={setScale}
              />
            </div>
          )}

          {activeView === "matrix" && (
            <MatrixEditorView
              key={matrixEditorKey}
              matrixPlan={syncedMatrixPlan}
              tasks={calculatedTasks}
              onApplyMatrixPlan={handleApplyMatrixPlan}
              onSyncFromGantt={handleSyncMatrixFromGantt}
            />
          )}

          {activeView === "scurve" && (
            <SCurveView
              tasks={calculatedTasks}
              budgetMappings={budgetMappings}
              budgetItems={budgetItems}
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
  tasks,
  calendar = DEFAULT_PROJECT_CALENDAR,
  resources = [],
  assignments = [],
  budgetItems = [],
  budgetMappings = [],
  baselines = [],
  matrixPlan,
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
        initialResources={resources}
        initialAssignments={assignments}
        initialBudgetItems={budgetItems}
        initialBudgetMappings={budgetMappings}
        initialBaselines={baselines}
        initialMatrixPlan={matrixPlan}
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
