import type { Migration } from "@/lib/db/migrator";

/**
 * Las líneas base que ya viven dentro del blob se copian a la tabla de fotos
 * **conservando su id**. No se borran del blob: si este despliegue se revierte,
 * la app anterior las sigue encontrando donde siempre estuvieron.
 *
 * Como la identidad se conserva, la misma foto no puede aparecer dos veces: la
 * clave primaria `(project_id, id)` lo impide y el lector fusiona por id.
 *
 * Una línea base sin `id` o con `createdAt` inválido se salta (no tumba el
 * resto de la migración): sin `id` no hay clave primaria posible, y sin una
 * fecha válida `captured_at` no puede rellenarse con algo confiable. La
 * ausencia de `tasks` sí se tolera con normalidad: se copia como una foto sin
 * tareas, igual que ya ocurre con líneas base recién creadas.
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

export const migration002BaselinesAsSnapshots: Migration = {
  id: "002_baselines_as_snapshots",

  async up(client) {
    const result = await client.query("SELECT id, project_data FROM projects");

    for (const row of result.rows) {
      const projectId = String(row.id);
      const projectData = row.project_data as { baselines?: BlobBaseline[] } | null;

      for (const baseline of projectData?.baselines ?? []) {
        if (!baseline.id) continue;

        const capturedAt = baseline.createdAt ? new Date(baseline.createdAt) : null;
        if (!capturedAt || Number.isNaN(capturedAt.getTime())) continue;

        const tasks = (baseline.tasks ?? []).map((task) => ({
          taskId: task.taskId,
          start: task.baselineStart,
          finish: task.baselineFinish,
          duration: task.baselineDuration,
        }));

        await client.query(
          `INSERT INTO project_snapshots (project_id, id, name, origin, captured_at, tasks)
           VALUES ($1, $2, $3, 'baseline', $4, $5)
           ON CONFLICT (project_id, id) DO NOTHING`,
          [
            projectId,
            baseline.id,
            baseline.name ?? "",
            baseline.createdAt,
            JSON.stringify(tasks),
          ],
        );
      }
    }
  },

  async down(client) {
    await client.query(`DELETE FROM project_snapshots WHERE origin = 'baseline'`);
  },
};
