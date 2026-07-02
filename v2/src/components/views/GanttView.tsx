"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import SplitPane from "@/components/gantt/SplitPane";
import GanttTable from "@/components/gantt/table/GanttTable";
import GanttChart from "@/components/gantt/GanttChart";
import TaskSheetView from "@/components/views/TaskSheetView";
import TrackingGanttView from "@/components/views/TrackingGanttView";
import NetworkDiagramView from "@/components/views/NetworkDiagramView";
import ResourceSheetView from "@/components/views/ResourceSheetView";
import ResourceUsageView from "@/components/views/ResourceUsageView";
import AssignmentSheetView from "@/components/views/AssignmentSheetView";
import BudgetTable from "@/components/budget/BudgetTable";
import BudgetMapping from "@/components/budget/BudgetMapping";
import LineOfBalance from "@/components/charts/LineOfBalance";
import SCurveView from "@/components/views/SCurveView";
import CalendarSettingsView from "@/components/views/CalendarSettingsView";
import BottlenecksView from "@/components/views/BottlenecksView";
import MatrixEditorView from "@/components/views/MatrixEditorView";
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

type SaveStatus = "idle" | "saving" | "saved" | "error";
const AUTOSAVE_DELAY_MS = 750;

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
    setTasks,
    selectedTaskIds,
    setSelectedTaskIds,
    scale,
    setScale,
    updateTask,
    moveTask,
    resizeTask,
    createDependency,
    undo,
    redo,
    canUndo,
    canRedo,
    scheduleIssues,
    calendar,
    updateCalendar,
  } = useProject();

  const [activeView, setActiveView] = useState<ViewType>("gantt");
  const [resources, setResources] = useState<Resource[]>(initialResources);
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
  const isDirtyRef = useRef(false);
  const didMountSaveStateRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        timephasedScale: scale,
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

  /* ── Project info derived from tasks ── */
  const projectInfo = useMemo(() => {
    if (calculatedTasks.length === 0) {
      return { name: undefined, start: undefined, finish: undefined, count: 0 };
    }
    const starts = calculatedTasks.map((t) => t.start.getTime());
    const finishes = calculatedTasks.map((t) => t.finish.getTime());
    return {
      name: undefined,
      start: new Date(Math.min(...starts)),
      finish: new Date(Math.max(...finishes)),
      count: calculatedTasks.length,
    };
  }, [calculatedTasks]);

  const automaticLOB = useMemo(
    () => generateAutomaticLOBFromTasks(calculatedTasks),
    [calculatedTasks],
  );
  const bottlenecks = useMemo(
    () => detectBottlenecks({ tasks: calculatedTasks, resources: calculatedResources, assignments: calculatedAssignments }),
    [calculatedAssignments, calculatedResources, calculatedTasks],
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

  /* ── Add Task handler ── */
  const handleAddTask = useCallback(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);

    const maxId = tasks.reduce((max, t) => {
      const num = typeof t.id === "number" ? t.id : parseInt(String(t.id), 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);

    const newTask: GanttTask = {
      id: maxId + 1,
      name: `Nueva tarea`,
      start: now,
      finish: nextDay,
      duration: 1,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    setTasks((prev) => [...prev, newTask]);
  }, [tasks, setTasks]);

  /* ── Delete Task handler ── */
  const handleDeleteTask = useCallback(() => {
    if (selectedTaskIds.length === 0) return;
    const idsToDelete = new Set(selectedTaskIds);
    setTasks((prev) => prev.filter((t) => !idsToDelete.has(t.id)));
    setSelectedTaskIds([]);
  }, [selectedTaskIds, setTasks, setSelectedTaskIds]);

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
        scale: scale as "day" | "week" | "month",
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
      scale: scale as "day" | "week" | "month",
      columnWidth: scale === "day" ? 40 : scale === "week" ? 280 : 800,
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

  const handleDeleteResource = useCallback((uid: number) => {
    setResources((prev) => prev.filter((r) => r.uid !== uid));
  }, []);

  /* ── Budget handlers ── */
  const handleAddBudgetItem = useCallback((item: BudgetItem) => {
    setBudgetItems((prev) => [...prev, item]);
  }, []);

  const handleUpdateBudgetItem = useCallback((item: BudgetItem) => {
    setBudgetItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }, []);

  const handleDeleteBudgetItem = useCallback((id: string) => {
    setBudgetItems((prev) => prev.filter((i) => i.id !== id));
    setBudgetMappings((prev) => prev.filter((m) => m.budgetItemId !== id));
  }, []);

  const handleImportBudgetCSV = useCallback((items: BudgetItem[]) => {
    setBudgetItems((prev) => [...prev, ...items]);
  }, []);

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

  const handleRemoveBudgetMapping = useCallback((mapping: BudgetMappingType) => {
    setBudgetMappings((prev) =>
      prev.filter(
        (m) =>
          !(m.budgetItemId === mapping.budgetItemId && m.taskId === mapping.taskId),
      ),
    );
    setBudgetItems((prev) =>
      prev.map((item) => {
        if (item.id !== mapping.budgetItemId) return item;
        const stillMapped = budgetMappings.some(
          (m) =>
            m.budgetItemId === mapping.budgetItemId &&
            m.taskId === mapping.taskId &&
            !(m.budgetItemId === mapping.budgetItemId && m.taskId === mapping.taskId),
        );
        if (stillMapped) return item;
        return {
          ...item,
          mappedTaskIds: item.mappedTaskIds.filter((id) => id !== mapping.taskId),
        };
      }),
    );
  }, [budgetMappings]);

  const handleApplyMatrixPlan = useCallback(
    (nextPlan: MatrixPlan) => {
      const result = applyMatrixUpdate({
        tasks,
        currentPlan: syncedMatrixPlan ?? nextPlan,
        nextPlan,
      });

      setMatrixPlan(result.matrixPlan);
      setTasks(() => result.tasks);
    },
    [setTasks, syncedMatrixPlan, tasks],
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
  }, [projectId, projectName, initialStatusDate, calculatedTasks, calculatedResources, calculatedAssignments, budgetItems, budgetMappings, baselines, calendar, syncedMatrixPlan, mppTaskColumns, mppResourceColumns, mppAssignmentColumns, calculatedMpp.customFieldDefinitions, calculatedMpp.engineVersion, calculatedMpp.calculatedAt, taskColumnSettings, resourceColumnSettings, assignmentColumnSettings, uiSettings]);

  // Use a ref to avoid the interval effect depending on doSave's reference
  const doSaveRef = useRef(doSave);

  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

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
    <div data-testid="gantt-view" className="flex flex-col h-screen">
      <div className="flex items-center shrink-0">
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
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          hasSelection={selectedTaskIds.length > 0}
          baselines={baselines}
          activeBaselineId={activeBaselineId}
          onSaveBaseline={handleSaveBaseline}
          onSelectBaseline={handleSelectBaseline}
          locale={locale}
        />
        {saveStatus !== "idle" && (
          <span className="mr-4 text-xs font-medium px-2 py-1 rounded shrink-0"
            style={{
              color: saveStatus === "saving" ? "var(--aia-warn-dark)" : saveStatus === "saved" ? "var(--aia-corp-dark)" : "var(--aia-alert-main)",
              background: saveStatus === "saving" ? "var(--aia-warn-xlight)" : saveStatus === "saved" ? "var(--aia-corp-xlight)" : "var(--aia-alert-xlight)",
            }}
          >
            {saveStatus === "saving" && "Guardando..."}
            {saveStatus === "saved" && "Guardado"}
            {saveStatus === "error" && "Error al guardar"}
          </span>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar de navegación de vistas */}
        <ViewSidebar activeView={activeView} onViewChange={setActiveView} locale={locale} />

        {/* Contenido de la vista activa */}
        <div className="flex-1 min-h-0 min-w-0">
          {activeView === "gantt" && (
            <SplitPane
              defaultSplit={35}
              left={
                <GanttTable
                  tasks={calculatedTasks}
                  selectedTaskIds={selectedTaskIds}
                  onTaskSelect={handleTaskSelect}
                  onUpdateTask={updateTask}
                  mppTaskColumns={mppTaskColumns}
                  customFieldDefinitions={calculatedMpp.customFieldDefinitions}
                  columnSettings={taskColumnSettings}
                  locale={locale}
                  onColumnSettingsChange={setTaskColumnSettings}
                  onLocaleChange={(nextLocale: UILocale) =>
                    setUISettings({ locale: nextLocale })
                  }
                />
              }
              right={
                <GanttChart
                  tasks={calculatedTasks}
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
                setUISettings({ locale: nextLocale })
              }
            />
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
            <div className="flex flex-col h-full">
              <div
                className="flex gap-2 p-2"
                style={{ background: "var(--aia-corp-dark)" }}
              >
                <button
                  onClick={() => setResourceSubView("sheet")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: resourceSubView === "sheet" ? "var(--aia-corp-main)" : "transparent",
                    color: resourceSubView === "sheet" ? "#ffffff" : "var(--aia-corp-light)",
                  }}
                >
                  {resourceViewLabels.sheet}
                </button>
                <button
                  onClick={() => setResourceSubView("usage")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: resourceSubView === "usage" ? "var(--aia-corp-main)" : "transparent",
                    color: resourceSubView === "usage" ? "#ffffff" : "var(--aia-corp-light)",
                  }}
                >
                  {resourceViewLabels.usage}
                </button>
                <button
                  onClick={() => setResourceSubView("assignments")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: resourceSubView === "assignments" ? "var(--aia-corp-main)" : "transparent",
                    color: resourceSubView === "assignments" ? "#ffffff" : "var(--aia-corp-light)",
                  }}
                >
                  {resourceViewLabels.assignments}
                </button>
                <button
                  onClick={() => setResourceSubView("budget")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: resourceSubView === "budget" ? "var(--aia-corp-main)" : "transparent",
                    color: resourceSubView === "budget" ? "#ffffff" : "var(--aia-corp-light)",
                  }}
                >
                  {resourceViewLabels.budget}
                </button>
                <button
                  onClick={() => setResourceSubView("mapping")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-montserrat)",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: resourceSubView === "mapping" ? "var(--aia-corp-main)" : "transparent",
                    color: resourceSubView === "mapping" ? "#ffffff" : "var(--aia-corp-light)",
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
            <div className="flex-1 flex items-center justify-center text-gray-500 h-full">
              {automaticLOB.activities.length > 0 ? (
                <LineOfBalance
                  activities={automaticLOB.activities}
                  units={automaticLOB.units}
                />
              ) : (
                <p className="text-lg opacity-60">
                  No se detectaron actividades repetitivas suficientes para generar Línea de Balance.
                </p>
              )}
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
            <BottlenecksView
              issues={scheduleIssues}
              bottlenecks={bottlenecks}
            />
          )}

          {activeView === "settings" && (
            <CalendarSettingsView
              calendar={calendar}
              onChange={updateCalendar}
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
