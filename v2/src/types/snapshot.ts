/**
 * Fotos del plan: cada versión del cronograma que pasó por la obra.
 *
 * Viven en la tabla `project_snapshots`, no dentro del blob del proyecto: el
 * autoguardado no debe enterarse de que existen.
 */

/** De dónde salió la foto. `baseline` son las líneas base que ya existían. */
export type SnapshotOrigin = "import" | "manual" | "baseline";

export interface SnapshotTask {
  taskId: string | number;
  name?: string;
  start: Date;
  finish: Date;
  /** Días. */
  duration: number;
  /** 0–100. Ausente en las fotos que vienen de una línea base. */
  progress?: number;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  name: string;
  origin: SnapshotOrigin;
  capturedAt: Date;
  tasks: SnapshotTask[];
}

/** Lo que basta para listar las fotos sin traerse todas las tareas. */
export interface ProjectSnapshotSummary {
  id: string;
  name: string;
  origin: SnapshotOrigin;
  capturedAt: Date;
  taskCount: number;
}
