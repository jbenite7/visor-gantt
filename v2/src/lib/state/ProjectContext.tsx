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
import type { GanttTask, GanttDependency } from "@/components/gantt/types";
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

/* ───────────────────── Context ───────────────────── */

export interface ProjectContextValue {
  tasks: GanttTask[];
  setTasks: (updater: (prev: GanttTask[]) => GanttTask[]) => void;
  selectedTaskIds: (string | number)[];
  setSelectedTaskIds: (ids: (string | number)[]) => void;
  scale: "day" | "week" | "month";
  setScale: (scale: "day" | "week" | "month") => void;
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
  children: ReactNode;
}

export function ProjectProvider({
  initialTasks,
  initialCalendar,
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
  const [scale, setScale] = useState<"day" | "week" | "month">("day");
  const history = useHistory(50);

  const setTasks = useCallback(
    (updater: (prev: GanttTask[]) => GanttTask[]) => {
      const result = recalculateSchedule(updater(tasks), { calendar });
      setScheduleIssues(result.issues);
      if (result.issues.length === 0) {
        setTasksState(result.tasks);
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
      const command: Command = {
        description,
        execute: () => {
          setTasksState(next);
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
      undo: history.undo,
      redo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    }),
    [
      tasks,
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
