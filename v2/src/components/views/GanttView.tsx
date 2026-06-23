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
import BudgetTable from "@/components/budget/BudgetTable";
import BudgetMapping from "@/components/budget/BudgetMapping";
import LineOfBalance from "@/components/charts/LineOfBalance";
import SCurveView from "@/components/views/SCurveView";
import CalendarSettingsView from "@/components/views/CalendarSettingsView";
import type { Resource, Assignment } from "@/types/resource";
import type { BudgetItem, BudgetMapping as BudgetMappingType } from "@/types/budget";
import type { ProjectCalendar } from "@/types/calendar";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
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

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface GanttViewProps {
  projectId?: string;
  projectName?: string;
  tasks: GanttTask[];
  calendar?: ProjectCalendar;
  onTaskClick?: (task: GanttTask) => void;
}

const VIEW_PLACEHOLDERS: Record<ViewType, string> = {
  gantt: "",
  tracking: "Vista \"Seguimiento\" en desarrollo",
  taskSheet: "Vista \"Hoja Tareas\" en desarrollo",
  network: "Vista \"Diagrama Red\" en desarrollo",
  resources: "Vista \"Recursos\" en desarrollo",
  lob: "Vista \"Línea Balance\" en desarrollo",
  scurve: "Vista \"Curva S\" en desarrollo",
  settings: "Vista \"Configuración\" en desarrollo",
};

/* ── Baseline type (toolbar-level) ── */
interface BaselineEntry {
  id: string;
  name: string;
  snapshot: GanttTask[];
}

function GanttViewInner({
  initialProjectId,
  initialProjectName,
  initialCalendar,
  onTaskClick,
}: {
  initialProjectId?: string;
  initialProjectName?: string;
  initialCalendar: ProjectCalendar;
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
  } = useProject();

  const [activeView, setActiveView] = useState<ViewType>("gantt");
  const [resources, setResources] = useState<Resource[]>([]);
  const [assignments] = useState<Assignment[]>([]);
  const [resourceSubView, setResourceSubView] = useState<"sheet" | "usage" | "budget" | "mapping">("sheet");
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [budgetMappings, setBudgetMappings] = useState<BudgetMappingType[]>([]);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [projectName] = useState<string>(initialProjectName ?? "Sin título");
  const [calendar, setCalendar] = useState<ProjectCalendar>(initialCalendar);
  const isDirtyRef = useRef(false);
  const lastSaveRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Baselines ── */
  const [baselines, setBaselines] = useState<BaselineEntry[]>([]);
  const [activeBaselineId, setActiveBaselineId] = useState<string | undefined>();

  /* ── Project info derived from tasks ── */
  const projectInfo = useMemo(() => {
    if (tasks.length === 0) {
      return { name: undefined, start: undefined, finish: undefined, count: 0 };
    }
    const starts = tasks.map((t) => t.start.getTime());
    const finishes = tasks.map((t) => t.finish.getTime());
    return {
      name: undefined,
      start: new Date(Math.min(...starts)),
      finish: new Date(Math.max(...finishes)),
      count: tasks.length,
    };
  }, [tasks]);

  const automaticLOB = useMemo(
    () => generateAutomaticLOBFromTasks(tasks),
    [tasks],
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
    const newBaseline: BaselineEntry = {
      id: `bl-${Date.now()}`,
      name: `Baseline ${baselineNumber}`,
      snapshot: tasks.map((t) => ({
        ...t,
        baselineStart: new Date(t.start),
        baselineFinish: new Date(t.finish),
        baselineDuration: t.duration,
      })),
    };
    setBaselines((prev) => [...prev, newBaseline]);
    setActiveBaselineId(newBaseline.id);
  }, [baselines.length, tasks]);

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
    if (tasks.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 30 * 86400000),
        scale: scale as "day" | "week" | "month",
        columnWidth: 40,
      };
    }
    const starts = tasks.map((t) => t.start.getTime());
    const finishes = tasks.map((t) => t.finish.getTime());
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
  }, [tasks, scale]);

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

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
  }, []);

  const doSave = useCallback(async () => {
    if (!isDirtyRef.current) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 30_000) return;

    isDirtyRef.current = false;
    lastSaveRef.current = now;
    setSaveStatus("saving");

    try {
      const data: ProjectData = {
        id: projectId,
        name: projectName,
        tasks,
        resources,
        assignments,
        budgetItems,
        budgetMappings,
        baselines: [],
        calendar,
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
  }, [projectId, projectName, tasks, resources, assignments, budgetItems, budgetMappings, calendar]);

  // Use a ref to avoid the interval effect depending on doSave's reference
  const doSaveRef = useRef(doSave);

  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      doSaveRef.current();
    }, 30_000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (tasks.length > 0) markDirty();
  }, [tasks.length, markDirty]);

  useEffect(() => {
    isDirtyRef.current = true;
  }, [resources, budgetItems, budgetMappings, calendar]);

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
          projectName={projectInfo.name}
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
        <ViewSidebar activeView={activeView} onViewChange={setActiveView} />

        {/* Contenido de la vista activa */}
        <div className="flex-1 min-h-0 min-w-0">
          {activeView === "gantt" && (
            <SplitPane
              defaultSplit={35}
              left={
                <GanttTable
                  tasks={tasks}
                  selectedTaskIds={selectedTaskIds}
                  onTaskSelect={handleTaskSelect}
                  onUpdateTask={updateTask}
                />
              }
              right={
                <GanttChart
                  tasks={tasks}
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
              tasks={tasks}
              onUpdateTask={updateTask}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={handleTaskSelect}
            />
          )}

          {activeView === "tracking" && (
            <TrackingGanttView
              tasks={tasks}
              scale={scale}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={handleTaskSelect}
              onTaskClick={onTaskClick}
            />
          )}

          {activeView === "network" && (
            <NetworkDiagramView tasks={tasks} onTaskClick={onTaskClick} />
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
                  Hoja de Recursos
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
                  Uso de Recursos
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
                  Presupuesto
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
                  Mapeo
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {resourceSubView === "sheet" && (
                  <ResourceSheetView
                    resources={resources}
                    onAddResource={handleAddResource}
                    onEditResource={handleEditResource}
                    onDeleteResource={handleDeleteResource}
                  />
                )}
                {resourceSubView === "usage" && (
                  <ResourceUsageView
                    resources={resources}
                    tasks={tasks}
                    assignments={assignments}
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
                    tasks={tasks}
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

          {activeView === "scurve" && (
            <SCurveView
              tasks={tasks}
              budgetMappings={budgetMappings}
              budgetItems={budgetItems}
            />
          )}

          {activeView === "settings" && (
            <CalendarSettingsView
              calendar={calendar}
              onChange={setCalendar}
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
  tasks,
  calendar = DEFAULT_PROJECT_CALENDAR,
  onTaskClick,
}: GanttViewProps) {
  const initialTasksKey = tasks
    .map((task) => `${task.id}:${task.name}:${task.start.getTime()}:${task.finish.getTime()}`)
    .join("|");

  return (
    <ProjectProvider key={initialTasksKey} initialTasks={tasks}>
      <GanttViewInner
        initialProjectId={projectId}
        initialProjectName={projectName}
        initialCalendar={calendar}
        onTaskClick={onTaskClick}
      />
    </ProjectProvider>
  );
}
