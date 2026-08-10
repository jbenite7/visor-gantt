import type { Migration, MigrationClient } from "@/lib/db/migrator";

/**
 * Las líneas base que ya viven dentro del blob se copian a la tabla de fotos
 * **conservando su id**. No se borran del blob: si este despliegue se revierte,
 * la app anterior las sigue encontrando donde siempre estuvieron.
 *
 * Como la identidad se conserva, la misma foto no puede aparecer dos veces: la
 * clave primaria `(project_id, id)` lo impide y el lector fusiona por id.
 *
 * Una línea base sin `id` o con `createdAt` inválido se salta (no tumba el
 * resto de la migración) y queda registrada con `console.warn`: sin `id` no
 * hay clave primaria posible, y sin una fecha válida `captured_at` no puede
 * rellenarse con algo confiable. Saltarla en silencio sería perder trabajo del
 * usuario sin que nadie se entere. La ausencia de `tasks` sí se tolera con
 * normalidad: se copia como una foto sin tareas. La ausencia de `name` se
 * rellena con un texto legible en vez de perder la fila.
 *
 * Solo se lee `project_data->'baselines'`, no el blob completo: son proyectos
 * con tareas, recursos, presupuesto y matriz, y esta migración no necesita
 * nada de eso.
 *
 * `down()` no borra por `origin = 'baseline'` a secas: desde que existen
 * fotos creadas por el usuario con ese mismo origen (líneas base guardadas
 * después de esta migración), ese filtro borraría también las suyas. En vez
 * de eso, vuelve a derivar exactamente los `(project_id, id)` que `up()`
 * habría insertado —leyendo el mismo blob, que sigue intacto— y borra solo
 * esos.
 */

interface BlobBaselineTask {
  taskId: string | number;
  baselineStart: string;
  baselineFinish: string;
  baselineDuration: number;
}

interface BlobBaseline {
  id?: string;
  name?: string;
  createdAt?: string;
  tasks?: BlobBaselineTask[];
}

interface FilaFoto {
  projectId: string;
  id: string;
  name: string;
  capturedAt: string;
  tasksJson: string;
}

/**
 * Recorre las líneas base del blob y devuelve una fila por cada una que
 * pueda convertirse en foto. Las que no puedan (sin `id`, fecha inválida,
 * lista de baselines corrupta) se descartan con un aviso, no rompen nada.
 */
async function deriveFilas(client: MigrationClient): Promise<FilaFoto[]> {
  const result = await client.query(
    "SELECT id, project_data->'baselines' AS baselines FROM projects",
  );

  const filas: FilaFoto[] = [];

  for (const row of result.rows) {
    const projectId = String(row.id);
    const baselines = row.baselines as unknown;

    if (!Array.isArray(baselines)) continue;

    baselines.forEach((baseline: BlobBaseline, index: number) => {
      const referencia = baseline?.id ?? `índice ${index}`;

      if (!baseline?.id) {
        console.warn(
          `[002_baselines_as_snapshots] proyecto ${projectId}, línea base ${referencia}: sin id, se salta`,
        );
        return;
      }

      const capturedAt = baseline.createdAt ? new Date(baseline.createdAt) : null;
      if (!capturedAt || Number.isNaN(capturedAt.getTime())) {
        console.warn(
          `[002_baselines_as_snapshots] proyecto ${projectId}, línea base ${referencia}: createdAt inválido ("${baseline.createdAt}"), se salta`,
        );
        return;
      }

      const tasks = (baseline.tasks ?? []).map((task) => ({
        taskId: task.taskId,
        start: task.baselineStart,
        finish: task.baselineFinish,
        duration: task.baselineDuration,
      }));

      filas.push({
        projectId,
        id: baseline.id,
        name: baseline.name ?? "Línea base sin nombre",
        capturedAt: baseline.createdAt as string,
        tasksJson: JSON.stringify(tasks),
      });
    });
  }

  return filas;
}

export const migration002BaselinesAsSnapshots: Migration = {
  id: "002_baselines_as_snapshots",

  async up(client) {
    const filas = await deriveFilas(client);

    for (const fila of filas) {
      await client.query(
        `INSERT INTO project_snapshots (project_id, id, name, origin, captured_at, tasks)
         VALUES ($1, $2, $3, 'baseline', $4, $5)
         ON CONFLICT (project_id, id) DO NOTHING`,
        [fila.projectId, fila.id, fila.name, fila.capturedAt, fila.tasksJson],
      );
    }
  },

  async down(client) {
    const filas = await deriveFilas(client);

    for (const fila of filas) {
      await client.query(
        `DELETE FROM project_snapshots WHERE project_id = $1 AND id = $2 AND origin = 'baseline'`,
        [fila.projectId, fila.id],
      );
    }
  },
};
