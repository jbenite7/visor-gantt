/**
 * Observaciones de obra sobre las tareas del cronograma.
 *
 * Es el loop de trabajo que hacía valioso al visor 1.0: anotar sobre la barra,
 * ver el pendiente encima del plan, atenderlo y compartir el registro con el
 * equipo. Ver docs/DESTILACION-VISOR-V1.md §2.
 */

export type ObservationStatus = "pending" | "done";

export interface Observation {
  id: string;
  taskId: string | number;
  /** Se guarda el nombre y el WBS del momento para que el export sea legible sin recalcular. */
  taskName: string;
  wbs?: string;
  text: string;
  status: ObservationStatus;
  createdAt: string;
}

export interface ObservationBadge {
  kind: ObservationStatus;
  count: number;
}

export function createObservation(input: {
  id: string;
  taskId: string | number;
  taskName: string;
  wbs?: string;
  text: string;
  createdAt: string;
}): Observation | null {
  const text = input.text.trim();
  if (!text) return null;

  return {
    id: input.id,
    taskId: input.taskId,
    taskName: input.taskName,
    wbs: input.wbs,
    text,
    status: "pending",
    createdAt: input.createdAt,
  };
}

/**
 * Estado del distintivo de una tarea. Una sola pendiente manda sobre el resto:
 * el ámbar debe seguir visible mientras quede algo por atender.
 */
export function observationBadgeFor(
  observations: Observation[],
  taskId: string | number,
): ObservationBadge | null {
  const forTask = observations.filter((o) => o.taskId === taskId);
  if (forTask.length === 0) return null;

  return {
    kind: forTask.some((o) => o.status === "pending") ? "pending" : "done",
    count: forTask.length,
  };
}

export function toggleObservationStatus(
  observations: Observation[],
  id: string,
): Observation[] {
  return observations.map((o) =>
    o.id === id
      ? { ...o, status: o.status === "pending" ? "done" : "pending" }
      : o,
  );
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function statusLabel(status: ObservationStatus): string {
  return status === "pending" ? "Pendiente" : "Atendida";
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

export function observationsToCsv(observations: Observation[]): string {
  const rows = observations.map((o) =>
    [
      String(o.taskId),
      o.wbs ?? "",
      o.taskName,
      o.text,
      statusLabel(o.status),
      isoDay(o.createdAt),
    ]
      .map(csvCell)
      .join(","),
  );

  return ["ID Actividad,WBS,Tarea,Observación,Estado,Fecha", ...rows].join("\n");
}

/** Formato del template Last Planner: cada observación pendiente es una restricción. */
export function observationsToLpsCsv(observations: Observation[]): string {
  const rows = observations.map((o) =>
    [o.taskName, o.wbs ?? "", o.text, statusLabel(o.status), "", isoDay(o.createdAt)]
      .map(csvCell)
      .join(","),
  );

  return [
    "Actividad,WBS,Restricción,Estado,Responsable,Fecha compromiso",
    ...rows,
  ].join("\n");
}
