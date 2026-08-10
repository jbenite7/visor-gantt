import type { GanttTask } from "@/components/gantt/types";
import { saveProjectSnapshot } from "@/app/actions/snapshots";
import { createSnapshotFromTasks } from "@/lib/scheduling/snapshots";
import { formatProjectDate } from "@/lib/date/projectDate";

/**
 * Cada versión del cronograma que llega de la obra queda registrada sin que
 * nadie se acuerde de guardarla. Si la foto falla, la importación sigue: el
 * proyecto ya está guardado y perder la foto no puede costar el archivo.
 *
 * No se deduplican fotos con el mismo contenido: cada importación es un
 * hecho que ocurrió, aunque el archivo no haya cambiado. Registrar tres
 * reimportaciones idénticas en una tarde es más honesto que fingir que hubo
 * una sola. Por eso el nombre lleva hora y minuto además del día: sin la
 * hora, dos importaciones del mismo archivo el mismo día producirían dos
 * cortes con el nombre idéntico e indistinguibles en el selector.
 */
export function importSnapshotName(fileName: string, capturedAt: Date): string {
  const base = fileName.replace(/\.mpp$/i, "");
  const fecha = formatProjectDate(capturedAt);
  const hora = formatProjectDate(capturedAt, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `Importación de «${base}» — ${fecha} ${hora}`;
}

export async function captureImportSnapshot({
  projectId,
  tasks,
  fileName,
  capturedAt = new Date(),
}: {
  projectId: string;
  tasks: GanttTask[];
  fileName: string;
  capturedAt?: Date;
}): Promise<{ captured: boolean }> {
  if (tasks.length === 0) return { captured: false };

  try {
    const snapshot = createSnapshotFromTasks(tasks, {
      projectId,
      name: importSnapshotName(fileName, capturedAt),
      origin: "import",
      capturedAt,
    });
    const result = await saveProjectSnapshot(snapshot);
    if (!result.success) {
      console.error("captureImportSnapshot: no se pudo guardar la foto", result.error);
    }
    return { captured: result.success };
  } catch (err) {
    console.error("captureImportSnapshot error:", err);
    return { captured: false };
  }
}
