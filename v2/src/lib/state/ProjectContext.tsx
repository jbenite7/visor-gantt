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
  createObservation,
  toggleObservationStatus,
  type Observation,
} from "@/lib/observations/observations";
import { insertAt, removeWhere } from "@/lib/state/undoableCollections";
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
  addTask: () => void;
  deleteTasks: (taskIds: (string | number)[]) => void;
  /**
   * Hace deshacible una acción cuyo estado vive fuera de este contexto
   * (recursos, presupuesto, matriz…). El llamador aporta cómo aplicarla y
   * cómo revertirla; aquí se registra en el mismo historial que las tareas.
   */
  runUndoable: (action: UndoableAction) => void;
  // Observaciones de obra
  observations: Observation[];
  addObservation: (taskId: string | number, text: string) => void;
  toggleObservation: (id: string) => void;
  deleteObservation: (id: string) => void;
  lastAction: LastAction | null;
  lastRejection: LastRejection | null;
  /** Anuncia el motivo por el que una entrada del usuario no se aceptó. */
  reportInvalidEdit: (reason: string) => void;
  // Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Última acción deshacible, para que la UI pueda anunciarla junto a "Deshacer".
 * `token` cambia en cada acción aunque se repita la misma, para que el aviso vuelva a mostrarse.
 */
export interface LastAction {
  kind: "add" | "delete" | "other" | "undone";
  count: number;
  description: string;
  token: number;
}

export interface UndoableAction {
  /** Texto que verá el usuario en el aviso, p. ej. "1 recurso eliminado". */
  description: string;
  execute: () => void;
  undo: () => void;
}

/**
 * Motivo por el que la última edición no se aplicó. Antes estos rechazos eran
 * un `return` mudo: la barra volvía a su sitio y el usuario no sabía por qué.
 */
export interface LastRejection {
  reason: string;
  detail?: string;
  token: number;
}

let actionToken = 0;
function nextActionToken(): number {
  actionToken += 1;
  return actionToken;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

/* ───────────────────── Provider ───────────────────── */

interface ProjectProviderProps {
  initialTasks: GanttTask[];
  initialObservations?: Observation[];
  initialCalendar?: ProjectCalendar;
  initialPlanningAuditEvents?: PlanningAuditEvent[];
  children: ReactNode;
}

export function ProjectProvider({
  initialTasks,
  initialObservations = [],
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
  const [lastRejection, setLastRejection] = useState<LastRejection | null>(null);
  const history = useHistory(50);

  const reportInvalidEdit = useCallback((reason: string) => {
    setLastRejection({ reason, token: nextActionToken() });
  }, []);

  /** Publica el motivo del rechazo para que la UI pueda mostrarlo donde el usuario está mirando. */
  const rejectWith = useCallback(
    (issues: { message?: string }[], fallback: string) => {
      const first = issues.find((issue) => issue.message)?.message;
      setLastRejection({
        reason: first ?? fallback,
        detail:
          issues.length > 1 ? `y ${issues.length - 1} conflicto(s) más` : undefined,
        token: nextActionToken(),
      });
    },
    [],
  );

  const setTasks = useCallback(
    (updater: (prev: GanttTask[]) => GanttTask[]) => {
      const result = recalculateSchedule(updater(tasks), { calendar });
      setScheduleIssues(result.issues);
      if (result.issues.length > 0) {
        rejectWith(result.issues, "El cambio deja el cronograma en conflicto.");
      } else {
        setLastRejection(null);
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
    [calendar, rejectWith, tasks],
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
        rejectWith(result.issues, `No se pudo aplicar: ${description}`);
        return;
      }

      setLastRejection(null);
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
    [calendar, history, rejectWith, tasks],
  );

  const updateCalendar = useCallback(
    (nextCalendar: ProjectCalendar) => {
      const normalized = normalizeProjectCalendar(nextCalendar);
      const issues = validateProjectCalendar(normalized);
      if (issues.length > 0) {
        setCalendarIssues(issues);
        rejectWith(issues, "El calendario no es válido.");
        return;
      }

      const previousTasks = tasks;
      const previousCalendar = calendar;
      const result = recalculateSchedule(previousTasks, { calendar: normalized });

      if (result.issues.length > 0) {
        setScheduleIssues(result.issues);
        rejectWith(
          result.issues,
          "Con ese calendario el cronograma no se puede recalcular.",
        );
        return;
      }

      setLastRejection(null);

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
    [calendar, history, rejectWith, tasks],
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

  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  const addTask = useCallback(() => {
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    const finish = new Date(start);
    finish.setDate(finish.getDate() + 1);

    commitTaskChange("Add task", (prev) => {
      const maxId = prev.reduce((max, t) => {
        const num = typeof t.id === "number" ? t.id : parseInt(String(t.id), 10);
        return Number.isFinite(num) && num > max ? num : max;
      }, 0);

      return [
        ...prev,
        {
          id: maxId + 1,
          name: "Nueva tarea",
          start,
          finish,
          duration: 1,
          progress: 0,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
        },
      ];
    });

    setLastAction({
      kind: "add",
      count: 1,
      description: "Tarea agregada",
      token: nextActionToken(),
    });
  }, [commitTaskChange]);

  const runUndoable = useCallback(
    ({ description, execute, undo }: UndoableAction) => {
      history.push({ description, execute, undo });
      setLastAction({
        kind: "other",
        count: 1,
        description,
        token: nextActionToken(),
      });
    },
    [history],
  );

  const [observations, setObservations] = useState<Observation[]>(initialObservations);

  const addObservation = useCallback(
    (taskId: string | number, text: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const created = createObservation({
        id: `obs-${nextActionToken()}-${taskId}`,
        taskId,
        taskName: task?.name ?? String(taskId),
        wbs: task?.wbs,
        text,
        createdAt: new Date().toISOString(),
      });
      if (!created) return;

      setObservations((prev) => [...prev, created]);
    },
    [tasks],
  );

  const toggleObservation = useCallback((id: string) => {
    setObservations((prev) => toggleObservationStatus(prev, id));
  }, []);

  const deleteObservation = useCallback(
    (id: string) => {
      const index = observations.findIndex((o) => o.id === id);
      if (index === -1) return;
      const removed = observations[index];

      runUndoable({
        description: "Observación eliminada",
        execute: () => setObservations((prev) => removeWhere(prev, (o) => o.id === id)),
        undo: () => setObservations((prev) => insertAt(prev, index, removed)),
      });
    },
    [observations, runUndoable],
  );

  const deleteTasks = useCallback(
    (taskIds: (string | number)[]) => {
      if (taskIds.length === 0) return;

      const doomed = new Set(taskIds);
      const removed = tasks.filter((t) => doomed.has(t.id)).length;
      if (removed === 0) return;

      commitTaskChange(
        removed === 1 ? "Delete task" : `Delete ${removed} tasks`,
        (prev) =>
          prev
            .filter((t) => !doomed.has(t.id))
            // Las dependencias que apuntaban a una tarea borrada dejarían el
            // cronograma con enlaces colgantes: se retiran junto con ella.
            .map((t) =>
              t.dependencies?.some((d) => doomed.has(d.from) || doomed.has(d.to))
                ? {
                    ...t,
                    dependencies: t.dependencies.filter(
                      (d) => !doomed.has(d.from) && !doomed.has(d.to),
                    ),
                  }
                : t,
            ),
      );
      setSelectedTaskIds([]);

      setLastAction({
        kind: "delete",
        count: removed,
        description:
          removed === 1 ? "1 tarea eliminada" : `${removed} tareas eliminadas`,
        token: nextActionToken(),
      });
    },
    [commitTaskChange, tasks],
  );

  const undoWithAnnounce = useCallback(() => {
    const description = history.undo();
    if (!description) return;

    setLastAction({
      kind: "undone",
      count: 1,
      description: `Deshecho: ${description}`,
      token: nextActionToken(),
    });
  }, [history]);

  /**
   * Rehacer devuelve el cambio que se acababa de deshacer, así que el aviso
   * «Deshecho: …» pasa a describir un estado que ya no existe: se retira.
   */
  const redoAndClearUndoNotice = useCallback(() => {
    history.redo();
    setLastAction((current) => (current?.kind === "undone" ? null : current));
  }, [history]);

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
        undoWithAnnounce();
      } else if (
        (e.key === "z" && e.shiftKey) ||
        e.key === "y"
      ) {
        e.preventDefault();
        redoAndClearUndoNotice();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, redoAndClearUndoNotice, undoWithAnnounce]);

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
      addTask,
      deleteTasks,
      runUndoable,
      observations,
      addObservation,
      toggleObservation,
      deleteObservation,
      lastAction,
      lastRejection,
      reportInvalidEdit,
      undo: undoWithAnnounce,
      redo: redoAndClearUndoNotice,
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
      addTask,
      deleteTasks,
      runUndoable,
      observations,
      addObservation,
      toggleObservation,
      deleteObservation,
      lastAction,
      lastRejection,
      reportInvalidEdit,
      redoAndClearUndoNotice,
      history,
      undoWithAnnounce,
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
