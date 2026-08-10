import type { GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import type {
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SnapshotOrigin,
} from "@/types/snapshot";

export function createSnapshotFromTasks(
  tasks: GanttTask[],
  options: {
    projectId: string;
    name: string;
    origin: SnapshotOrigin;
    capturedAt: Date;
    id?: string;
  },
): ProjectSnapshot {
  return {
    id: options.id ?? crypto.randomUUID(),
    projectId: options.projectId,
    name: options.name,
    origin: options.origin,
    capturedAt: options.capturedAt,
    tasks: tasks.map((task) => ({
      taskId: task.id,
      name: task.name,
      start: task.start,
      finish: task.finish,
      duration: task.duration,
      progress: task.progress,
    })),
  };
}

/**
 * Cada línea base guardada ya es una foto del plan en una fecha. Se conserva
 * su `id` para que la misma foto no aparezca dos veces al fusionar fuentes.
 */
export function baselineToSnapshot(
  baseline: Baseline,
  projectId: string,
): ProjectSnapshot {
  return {
    id: baseline.id,
    projectId,
    name: baseline.name,
    origin: "baseline",
    capturedAt: baseline.createdAt,
    tasks: baseline.tasks.map((task) => ({
      taskId: task.taskId,
      start: task.baselineStart,
      finish: task.baselineFinish,
      duration: task.baselineDuration,
    })),
  };
}

export type SnapshotChangeKind =
  | "atrasada"
  | "adelantada"
  | "sinCambio"
  | "nueva"
  | "eliminada";

export interface SnapshotChange {
  taskId: string | number;
  taskName: string;
  kind: SnapshotChangeKind;
  /** Días que se corrió el inicio: positivo se atrasó, negativo se adelantó. */
  startShiftDays: number;
  /** Días que se corrió el fin: positivo se atrasó, negativo se adelantó. */
  finishShiftDays: number;
}

export interface SnapshotComparison {
  changes: SnapshotChange[];
  delayedCount: number;
  aheadCount: number;
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

function dayShift(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Compara el plan actual contra una foto: qué se movió, cuánto y en qué
 * dirección. Las tareas que ya no existen se listan al final, porque son la
 * parte de la historia que el plan de hoy no puede contar por sí solo.
 */
export function compareSnapshotToTasks(
  snapshot: ProjectSnapshot,
  tasks: GanttTask[],
): SnapshotComparison {
  const snapshotById = new Map(
    snapshot.tasks.map((task) => [String(task.taskId), task]),
  );
  const seen = new Set<string>();
  const changes: SnapshotChange[] = [];

  for (const task of tasks) {
    const key = String(task.id);
    const before = snapshotById.get(key);

    if (!before) {
      changes.push({
        taskId: task.id,
        taskName: task.name,
        kind: "nueva",
        startShiftDays: 0,
        finishShiftDays: 0,
      });
      continue;
    }

    seen.add(key);
    const startShiftDays = dayShift(before.start, task.start);
    const finishShiftDays = dayShift(before.finish, task.finish);
    const kind: SnapshotChangeKind =
      finishShiftDays > 0
        ? "atrasada"
        : finishShiftDays < 0
          ? "adelantada"
          : "sinCambio";

    changes.push({
      taskId: task.id,
      taskName: task.name,
      kind,
      startShiftDays,
      finishShiftDays,
    });
  }

  for (const before of snapshot.tasks) {
    const key = String(before.taskId);
    if (seen.has(key)) continue;
    changes.push({
      taskId: before.taskId,
      taskName: before.name ?? String(before.taskId),
      kind: "eliminada",
      startShiftDays: 0,
      finishShiftDays: 0,
    });
  }

  const count = (kind: SnapshotChangeKind) =>
    changes.filter((change) => change.kind === kind).length;

  return {
    changes,
    delayedCount: count("atrasada"),
    aheadCount: count("adelantada"),
    addedCount: count("nueva"),
    removedCount: count("eliminada"),
    unchangedCount: count("sinCambio"),
  };
}

export function summarizeSnapshot(
  snapshot: ProjectSnapshot,
): ProjectSnapshotSummary {
  return {
    id: snapshot.id,
    name: snapshot.name,
    origin: snapshot.origin,
    capturedAt: snapshot.capturedAt,
    taskCount: snapshot.tasks.length,
  };
}

function summariesDiverge(
  a: ProjectSnapshotSummary,
  b: ProjectSnapshotSummary,
): boolean {
  return (
    a.name !== b.name ||
    a.taskCount !== b.taskCount ||
    a.capturedAt.getTime() !== b.capturedAt.getTime()
  );
}

/**
 * Fusiona las fotos de la tabla con las líneas base que aún viven en el blob.
 *
 * La identidad es el `id`: una línea base copiada a la tabla conserva el
 * suyo, así que la misma foto nunca se lista dos veces. Cuando el id
 * coincide en las dos fuentes gana la fila de la tabla, que es la que se
 * puede leer entera; pero como el guardado es atómico solo sobre el blob,
 * las dos fuentes pueden divergir si un guardado se cayó a medias. Cuando
 * eso pasa no se resuelve en silencio: queda registrado con `console.warn`.
 */
export function mergeSnapshotSources(
  stored: ProjectSnapshotSummary[],
  baselines: Baseline[],
  projectId: string,
): ProjectSnapshotSummary[] {
  const byId = new Map<string, ProjectSnapshotSummary>();

  for (const baseline of baselines) {
    const summary = summarizeSnapshot(baselineToSnapshot(baseline, projectId));
    byId.set(summary.id, summary);
  }
  for (const summary of stored) {
    const fromBlob = byId.get(summary.id);
    if (fromBlob && summariesDiverge(fromBlob, summary)) {
      console.warn(
        `[mergeSnapshotSources] La foto "${summary.id}" difiere entre el blob y la tabla; gana la tabla.`,
      );
    }
    byId.set(summary.id, summary);
  }

  return [...byId.values()].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );
}
