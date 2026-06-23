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
import { useHistory } from "@/hooks/useHistory";
import type { Command } from "@/lib/state/history";

/* ── Helper: shift a Date by N days (immutable) ── */
function shiftDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/* ── Helper: calculate duration in days between two dates ── */
function durationDays(start: Date, finish: Date): number {
  return Math.max(1, Math.round((finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/* ── Helper: apply a single field change to a task (immutable) ── */
function applyFieldChange(
  task: GanttTask,
  field: string,
  value: unknown,
): GanttTask {
  return { ...task, [field]: value } as GanttTask;
}

/* ───────────────────── Context ───────────────────── */

export interface ProjectContextValue {
  tasks: GanttTask[];
  setTasks: (updater: (prev: GanttTask[]) => GanttTask[]) => void;
  selectedTaskIds: (string | number)[];
  setSelectedTaskIds: (ids: (string | number)[]) => void;
  scale: "day" | "week" | "month";
  setScale: (scale: "day" | "week" | "month") => void;
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
  children: ReactNode;
}

export function ProjectProvider({
  initialTasks,
  children,
}: ProjectProviderProps) {
  const [tasks, setTasks] = useState<GanttTask[]>(initialTasks);
  const [selectedTaskIds, setSelectedTaskIds] = useState<(string | number)[]>(
    [],
  );
  const [scale, setScale] = useState<"day" | "week" | "month">("day");
  const history = useHistory(50);

  /* ── updateTask ── */
  const updateTask = useCallback(
    (taskId: string | number, field: string, value: unknown) => {
      const command: Command = {
        description: `Update ${field} on task ${taskId}`,
        execute: () => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? applyFieldChange(t, field, value) : t,
            ),
          );
        },
        undo: () => {
          // Snapshot the old value at command creation time
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? applyFieldChange(t, field, oldValue) : t,
            ),
          );
        },
      };

      // Capture the old value for undo
      let oldValue: unknown;
      setTasks((prev) => {
        const task = prev.find((t) => t.id === taskId);
        if (task) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oldValue = (task as any)[field];
        }
        return prev;
      });

      history.push(command);
    },
    [history],
  );

  /* ── moveTask ── */
  const moveTask = useCallback(
    (taskId: string | number, dayDelta: number) => {
      if (dayDelta === 0) return;

      // Snapshot old dates before creating the command
      let oldStart: Date;
      let oldFinish: Date;
      setTasks((prev) => {
        const task = prev.find((t) => t.id === taskId);
        if (task) {
          oldStart = new Date(task.start);
          oldFinish = new Date(task.finish);
        }
        return prev;
      });

      const command: Command = {
        description: `Move task ${taskId} by ${dayDelta} days`,
        execute: () => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              const newStart = shiftDate(t.start, dayDelta);
              const newFinish = shiftDate(t.finish, dayDelta);
              return {
                ...t,
                start: newStart,
                finish: newFinish,
                baselineStart: t.baselineStart
                  ? shiftDate(t.baselineStart, dayDelta)
                  : undefined,
                baselineFinish: t.baselineFinish
                  ? shiftDate(t.baselineFinish, dayDelta)
                  : undefined,
              };
            }),
          );
        },
        undo: () => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              return {
                ...t,
                start: oldStart,
                finish: oldFinish,
                baselineStart: t.baselineStart
                  ? shiftDate(t.baselineStart, -dayDelta)
                  : undefined,
                baselineFinish: t.baselineFinish
                  ? shiftDate(t.baselineFinish, -dayDelta)
                  : undefined,
              };
            }),
          );
        },
      };

      history.push(command);
    },
    [history],
  );

  /* ── resizeTask ── */
  const resizeTask = useCallback(
    (
      taskId: string | number,
      edge: "left" | "right",
      dayDelta: number,
    ) => {
      if (dayDelta === 0) return;

      let oldStart: Date;
      let oldFinish: Date;
      let oldDuration: number;
      setTasks((prev) => {
        const task = prev.find((t) => t.id === taskId);
        if (task) {
          oldStart = new Date(task.start);
          oldFinish = new Date(task.finish);
          oldDuration = task.duration;
        }
        return prev;
      });

      const command: Command = {
        description: `Resize task ${taskId} (${edge}) by ${dayDelta} days`,
        execute: () => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              if (edge === "left") {
                const newStart = shiftDate(t.start, dayDelta);
                return {
                  ...t,
                  start: newStart,
                  duration: durationDays(newStart, t.finish),
                };
              } else {
                const newFinish = shiftDate(t.finish, dayDelta);
                return {
                  ...t,
                  finish: newFinish,
                  duration: durationDays(t.start, newFinish),
                };
              }
            }),
          );
        },
        undo: () => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              return {
                ...t,
                start: oldStart,
                finish: oldFinish,
                duration: oldDuration,
              };
            }),
          );
        },
      };

      history.push(command);
    },
    [history],
  );

  /* ── createDependency ── */
  const createDependency = useCallback(
    (
      fromId: string | number,
      toId: string | number,
      type: "FS" | "SS" | "FF" | "SF",
    ) => {
      // Check if dependency already exists
      let alreadyExists = false;
      setTasks((prev) => {
        const task = prev.find((t) => t.id === fromId);
        if (task) {
          alreadyExists = task.dependencies.some(
            (d) => d.to === toId && d.type === type,
          );
        }
        return prev;
      });
      if (alreadyExists) return;

      const newDep: GanttDependency = { from: fromId, to: toId, type };

      const command: Command = {
        description: `Create ${type} dependency ${fromId} → ${toId}`,
        execute: () => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === fromId
                ? { ...t, dependencies: [...t.dependencies, newDep] }
                : t,
            ),
          );
        },
        undo: () => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === fromId
                ? {
                    ...t,
                    dependencies: t.dependencies.filter(
                      (d) => !(d.to === toId && d.type === type),
                    ),
                  }
                : t,
            ),
          );
        },
      };

      history.push(command);
    },
    [history],
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
      selectedTaskIds,
      scale,
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
