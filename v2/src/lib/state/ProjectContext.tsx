"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GanttDependency, GanttScale, GanttTask } from "@/components/gantt/types";
import type { PlanningAuditEvent, PlanningAuditEventKind } from "@/types/audit";
import type { ProjectCalendar } from "@/types/calendar";
import { useHistory } from "@/hooks/useHistory";
import type { Command } from "@/lib/state/history";
import { detectBottlenecks } from "@/lib/scheduling/bottlenecks";
import {
  type CalendarIssue,
  normalizeProjectCalendar,
  validateProjectCalendar,
} from "@/lib/scheduling/projectCalendar";
import {
  recalculateSchedule,
  rewriteSuccessors,
} from "@/lib/scheduling/scheduleEngine";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";
import {
  indentTask as indentTaskStructure,
  insertTask as insertTaskStructure,
  type InsertTaskOptions,
  moveTaskDown as moveTaskDownStructure,
  moveTaskUp as moveTaskUpStructure,
  normalizeTaskStructure,
  outdentTask as outdentTaskStructure,
  reorderTask as reorderTaskStructure,
  type ReorderTaskPosition,
} from "@/lib/gantt/taskStructure";
import { insertTasksFromSmartPaste } from "@/lib/gantt/smartPaste";
import {
  applyStructureTemplate as applyStructureTemplateModel,
  type StructureTemplateId,
} from "@/lib/gantt/structureTemplates";

/* ── Helper: shift a Date by N days (immutable) ── */
function shiftDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/* ── Helper: calculate duration in days between two dates ── */
function durationDays(start: Date, finish: Date): number {
  return Math.max(
    1,
    Math.round((finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
}

/* ── Helper: apply a single field change to a task (immutable) ── */
function applyFieldChange(
  task: GanttTask,
  field: string,
  value: unknown,
): GanttTask {
  if (field.startsWith("mppFields:")) {
    const sourceKey = field.slice("mppFields:".length);
    return {
      ...task,
      mppFields: {
        ...(task.mppFields ?? {}),
        [sourceKey]: value,
      },
    };
  }
  if (field === "progress" || field === "percentComplete") {
    return {
      ...task,
      progress: value as number,
      percentComplete: value as number,
    };
  }
  return { ...task, [field]: value } as GanttTask;
}

function stampGanttEdit(task: GanttTask): GanttTask {
  if (!task.matrixSource) return task;
  return {
    ...task,
    matrixSync: {
      lastEditedAt: new Date().toISOString(),
      lastEditedFrom: "gantt",
    },
  };
}

const MAX_PLANNING_AUDIT_EVENTS = 100;

function auditEventId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferAuditKind(description: string): PlanningAuditEventKind {
  if (description.startsWith("Create") || description.includes("dependenc")) {
    return "dependencyEdit";
  }
  if (
    description.startsWith("Indent") ||
    description.startsWith("Outdent") ||
    description.startsWith("Move task") ||
    description.startsWith("Reorder") ||
    description.startsWith("Insert") ||
    description.startsWith("Apply structure template") ||
    description.startsWith("Normalize")
  ) {
    return "structureEdit";
  }
  if (description.startsWith("Update project calendar")) {
    return "calendarEdit";
  }
  if (description.startsWith("Apply matrix")) {
    return "matrixEdit";
  }
  return "taskEdit";
}

function changedTaskIds(previous: GanttTask[], next: GanttTask[]): (string | number)[] {
  const previousById = new Map(previous.map((task) => [task.id, task]));
  const nextIds = new Set(next.map((task) => task.id));
  const changed = new Set<string | number>();

  next.forEach((task) => {
    const previousTask = previousById.get(task.id);
    if (!previousTask || JSON.stringify(previousTask) !== JSON.stringify(task)) {
      changed.add(task.id);
    }
  });
  previous.forEach((task) => {
    if (!nextIds.has(task.id)) changed.add(task.id);
  });

  return [...changed];
}

function appendAuditEvent(
  events: PlanningAuditEvent[],
  event: PlanningAuditEvent,
): PlanningAuditEvent[] {
  return [...events, event].slice(-MAX_PLANNING_AUDIT_EVENTS);
}

/* ───────────────────── Context ───────────────────── */

export interface ProjectContextValue {
  tasks: GanttTask[];
  planningAuditEvents: PlanningAuditEvent[];
  setTasks: (updater: (prev: GanttTask[]) => GanttTask[]) => void;
  selectedTaskIds: (string | number)[];
  setSelectedTaskIds: (ids: (string | number)[]) => void;
  scale: GanttScale;
  setScale: (scale: GanttScale) => void;
  calendar: ProjectCalendar;
  calendarIssues: CalendarIssue[];
  scheduleIssues: ScheduleIssue[];
  bottlenecks: Bottleneck[];
  updateCalendar: (calendar: ProjectCalendar) => void;
  // Editing actions
  updateTask: (taskId: string | number, field: string, value: unknown) => void;
  moveTask: (taskId: string | number, dayDelta: number) => void;
  resizeTask: (
    taskId: string | number,
    edge: "left" | "right",
    dayDelta: number,
  ) => void;
  createDependency: (
    fromId: string | number,
    toId: string | number,
    type: "FS" | "SS" | "FF" | "SF",
  ) => void;
  indentTask: (taskId: string | number) => void;
  outdentTask: (taskId: string | number) => void;
  moveTaskUp: (taskId: string | number) => void;
  moveTaskDown: (taskId: string | number) => void;
  reorderTask: (
    taskId: string | number,
    targetTaskId: string | number,
    position: ReorderTaskPosition,
  ) => void;
  insertStructuredTask: (options?: InsertTaskOptions) => void;
  applyStructureTemplate: (
    templateId: StructureTemplateId,
    options?: { afterTaskId?: string | number; start?: Date },
  ) => void;
  smartPasteTasks: (
    rawText: string,
    options?: { afterTaskId?: string | number },
  ) => void;
  normalizeStructure: () => void;
  // Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

/* ───────────────────── Provider ───────────────────── */

interface ProjectProviderProps {
  initialTasks: GanttTask[];
  initialCalendar?: ProjectCalendar;
  initialPlanningAuditEvents?: PlanningAuditEvent[];
  children: ReactNode;
}

export function ProjectProvider({
  initialTasks,
  initialCalendar,
  initialPlanningAuditEvents = [],
  children,
}: ProjectProviderProps) {
  const normalizedInitialCalendar = useMemo(
    () => normalizeProjectCalendar(initialCalendar),
    [initialCalendar],
  );
  const initialSchedule = useMemo(
    () =>
      recalculateSchedule(initialTasks, {
        calendar: normalizedInitialCalendar,
      }),
    [initialTasks, normalizedInitialCalendar],
  );
  const [tasks, setTasksState] = useState<GanttTask[]>(initialSchedule.tasks);
  const [planningAuditEvents, setPlanningAuditEvents] =
    useState<PlanningAuditEvent[]>(initialPlanningAuditEvents);
  const [calendar, setCalendarState] = useState<ProjectCalendar>(
    normalizedInitialCalendar,
  );
  const [calendarIssues, setCalendarIssues] = useState<CalendarIssue[]>(
    validateProjectCalendar(normalizedInitialCalendar),
  );
  const [scheduleIssues, setScheduleIssues] = useState<ScheduleIssue[]>(
    initialSchedule.issues,
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<(string | number)[]>(
    [],
  );
  const [scale, setScale] = useState<GanttScale>("day");
  const history = useHistory(50);

  const setTasks = useCallback(
    (updater: (prev: GanttTask[]) => GanttTask[]) => {
      const result = recalculateSchedule(updater(tasks), { calendar });
      setScheduleIssues(result.issues);
      if (result.issues.length === 0) {
        setTasksState(result.tasks);
        setPlanningAuditEvents((prev) =>
          appendAuditEvent(prev, {
            id: auditEventId(),
            kind: "matrixEdit",
            summary: "Apply matrix/task update",
            taskIds: changedTaskIds(tasks, result.tasks),
            createdAt: new Date().toISOString(),
          }),
        );
      }
    },
    [calendar, tasks],
  );

  const commitTaskChange = useCallback(
    (
      description: string,
      updater: (prev: GanttTask[]) => GanttTask[],
    ) => {
      const previous = tasks;
      const result = recalculateSchedule(updater(previous), { calendar });

      if (result.issues.length > 0) {
        setScheduleIssues(result.issues);
        return;
      }

      const next = result.tasks;
      const auditEvent: PlanningAuditEvent = {
        id: auditEventId(),
        kind: inferAuditKind(description),
        summary: description,
        taskIds: changedTaskIds(previous, next),
        createdAt: new Date().toISOString(),
      };
      const command: Command = {
        description,
        execute: () => {
          setTasksState(next);
          setPlanningAuditEvents((prev) => appendAuditEvent(prev, auditEvent));
          setScheduleIssues([]);
          setCalendarIssues([]);
        },
        undo: () => {
          setTasksState(previous);
          setScheduleIssues([]);
          setCalendarIssues([]);
        },
      };

      history.push(command);
    },
    [calendar, history, tasks],
  );

  const updateCalendar = useCallback(
    (nextCalendar: ProjectCalendar) => {
      const normalized = normalizeProjectCalendar(nextCalendar);
      const issues = validateProjectCalendar(normalized);
      if (issues.length > 0) {
        setCalendarIssues(issues);
        return;
      }

      const previousTasks = tasks;
      const previousCalendar = calendar;
      const result = recalculateSchedule(previousTasks, { calendar: normalized });

      if (result.issues.length > 0) {
        setScheduleIssues(result.issues);
        return;
      }

      const command: Command = {
        description: "Update project calendar",
        execute: () => {
          setCalendarState(normalized);
          setTasksState(result.tasks);
          setPlanningAuditEvents((prev) =>
            appendAuditEvent(prev, {
              id: auditEventId(),
              kind: "calendarEdit",
              summary: "Update project calendar",
              taskIds: changedTaskIds(previousTasks, result.tasks),
              createdAt: new Date().toISOString(),
            }),
          );
          setCalendarIssues([]);
          setScheduleIssues([]);
        },
        undo: () => {
          setCalendarState(previousCalendar);
          setTasksState(previousTasks);
          setCalendarIssues([]);
          setScheduleIssues([]);
        },
      };

      history.push(command);
    },
    [calendar, history, tasks],
  );

  const bottlenecks = useMemo(
    () => detectBottlenecks({ tasks, resources: [], assignments: [] }),
    [tasks],
  );

  /* ── updateTask ── */
  const updateTask = useCallback(
    (taskId: string | number, field: string, value: unknown) => {
      commitTaskChange(`Update ${field} on task ${taskId}`, (prev) => {
        if (field === "successors") {
          return rewriteSuccessors(prev, taskId, value as GanttDependency[]);
        }

        return prev.map((t) => {
          if (t.id !== taskId) return t;

          if (field === "dependencies") {
            return stampGanttEdit({
              ...t,
              dependencies: (value as GanttDependency[]).map((dep) => ({
                ...dep,
                to: taskId,
              })),
            });
          }

          if (field === "start" && value instanceof Date) {
            return stampGanttEdit({ ...t, start: value, manualStart: value });
          }

          if (field === "finish" && value instanceof Date) {
            return stampGanttEdit({
              ...t,
              finish: value,
              duration: durationDays(t.start, value),
            });
          }

          return stampGanttEdit(applyFieldChange(t, field, value));
        });
      });
    },
    [commitTaskChange],
  );

  /* ── moveTask ── */
  const moveTask = useCallback(
    (taskId: string | number, dayDelta: number) => {
      if (dayDelta === 0) return;
      commitTaskChange(`Move task ${taskId} by ${dayDelta} days`, (prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const newStart = shiftDate(t.manualStart ?? t.start, dayDelta);
          return stampGanttEdit({ ...t, start: newStart, manualStart: newStart });
        }),
      );
    },
    [commitTaskChange],
  );

  /* ── resizeTask ── */
  const resizeTask = useCallback(
    (
      taskId: string | number,
      edge: "left" | "right",
      dayDelta: number,
    ) => {
      if (dayDelta === 0) return;
      commitTaskChange(
        `Resize task ${taskId} (${edge}) by ${dayDelta} days`,
        (prev) =>
          prev.map((t) => {
            if (t.id !== taskId) return t;
            if (edge === "left") {
              const newStart = shiftDate(t.start, dayDelta);
              return stampGanttEdit({
                ...t,
                start: newStart,
                manualStart: newStart,
                duration: durationDays(newStart, t.finish),
              });
            }
            return stampGanttEdit({
              ...t,
              duration: Math.max(1, t.duration + dayDelta),
            });
          }),
      );
    },
    [commitTaskChange],
  );

  /* ── createDependency ── */
  const createDependency = useCallback(
    (
      fromId: string | number,
      toId: string | number,
      type: "FS" | "SS" | "FF" | "SF",
    ) => {
      // Check if dependency already exists
      const successor = tasks.find((t) => t.id === toId);
      const alreadyExists = successor?.dependencies.some(
        (d) => d.from === fromId && d.to === toId && d.type === type,
      );
      if (alreadyExists) return;

      const newDep: GanttDependency = { from: fromId, to: toId, type };
      commitTaskChange(`Create ${type} dependency ${fromId} to ${toId}`, (prev) =>
        prev.map((t) =>
          t.id === toId
            ? stampGanttEdit({
                ...t,
                dependencies: [...t.dependencies, newDep],
              })
            : t,
        ),
      );
    },
    [commitTaskChange, tasks],
  );

  const indentTask = useCallback(
    (taskId: string | number) => {
      commitTaskChange(`Indent task ${taskId}`, (prev) =>
        indentTaskStructure(prev, taskId),
      );
    },
    [commitTaskChange],
  );

  const outdentTask = useCallback(
    (taskId: string | number) => {
      commitTaskChange(`Outdent task ${taskId}`, (prev) =>
        outdentTaskStructure(prev, taskId),
      );
    },
    [commitTaskChange],
  );

  const moveTaskUp = useCallback(
    (taskId: string | number) => {
      commitTaskChange(`Move task ${taskId} up`, (prev) =>
        moveTaskUpStructure(prev, taskId),
      );
    },
    [commitTaskChange],
  );

  const moveTaskDown = useCallback(
    (taskId: string | number) => {
      commitTaskChange(`Move task ${taskId} down`, (prev) =>
        moveTaskDownStructure(prev, taskId),
      );
    },
    [commitTaskChange],
  );

  const reorderTask = useCallback(
    (
      taskId: string | number,
      targetTaskId: string | number,
      position: ReorderTaskPosition,
    ) => {
      commitTaskChange(`Reorder task ${taskId} ${position} ${targetTaskId}`, (prev) =>
        reorderTaskStructure(prev, taskId, targetTaskId, position),
      );
    },
    [commitTaskChange],
  );

  const insertStructuredTask = useCallback(
    (options: InsertTaskOptions = {}) => {
      commitTaskChange("Insert structured task", (prev) =>
        insertTaskStructure(normalizeTaskStructure(prev), options),
      );
    },
    [commitTaskChange],
  );

  const applyStructureTemplate = useCallback(
    (
      templateId: StructureTemplateId,
      options: { afterTaskId?: string | number; start?: Date } = {},
    ) => {
      commitTaskChange(`Apply structure template ${templateId}`, (prev) =>
        applyStructureTemplateModel(normalizeTaskStructure(prev), templateId, options),
      );
    },
    [commitTaskChange],
  );

  const smartPasteTasks = useCallback(
    (rawText: string, options: { afterTaskId?: string | number } = {}) => {
      commitTaskChange("Smart paste tasks from Excel", (prev) =>
        insertTasksFromSmartPaste(normalizeTaskStructure(prev), rawText, options),
      );
    },
    [commitTaskChange],
  );

  const normalizeStructure = useCallback(() => {
    commitTaskChange("Normalize task structure", (prev) =>
      normalizeTaskStructure(prev),
    );
  }, [commitTaskChange]);

  /* ── Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if editing text
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if (
        (e.key === "z" && e.shiftKey) ||
        e.key === "y"
      ) {
        e.preventDefault();
        history.redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history]);

  /* ── Context value (memoised) ── */
  const value: ProjectContextValue = useMemo(
    () => ({
      tasks,
      planningAuditEvents,
      setTasks,
      selectedTaskIds,
      setSelectedTaskIds,
      scale,
      setScale,
      calendar,
      calendarIssues,
      scheduleIssues,
      bottlenecks,
      updateCalendar,
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
      undo: history.undo,
      redo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    }),
    [
      tasks,
      planningAuditEvents,
      setTasks,
      selectedTaskIds,
      scale,
      calendar,
      calendarIssues,
      scheduleIssues,
      bottlenecks,
      updateCalendar,
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
      history,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

/* ───────────────────── Hook ───────────────────── */

/**
 * Access project editing state and actions.
 * Must be used inside `<ProjectProvider>`.
 */
export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within a <ProjectProvider>");
  }
  return ctx;
}
