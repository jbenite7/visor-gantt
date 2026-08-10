import type { Migration } from "@/lib/db/migrator";

/**
 * Las fotos del plan (líneas base) salen del blob `project_data` y pasan a
 * tener su propia tabla.
 *
 * Hoy viven como JSONB dentro de `project_data`, y `serializeProjectData`
 * reescribe el objeto entero en cada guardado: tareas, recursos, presupuesto,
 * matriz y todas las fotos acumuladas, todo junto. Cada foto nueva engorda
 * ese blob y con él el camino del autoguardado. Sacarlas a `project_snapshots`
 * quita ese crecimiento de en medio; el guardado del proyecto sigue siendo un
 * solo blob, pero uno que ya no carga el historial de fotos.
 */
export const migration001ProjectSnapshots: Migration = {
  id: "001_project_snapshots",

  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_snapshots (
        project_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        -- La unión de TypeScript (SnapshotOrigin, en src/types/snapshot.ts)
        -- no llega a la base: cualquier escritura fuera del código tipado
        -- (script de mantenimiento, migración de datos, consulta a mano)
        -- podría colar un cuarto valor. Este CHECK es lo que impide que el
        -- tipo y la base se desincronicen; si se añade un origen nuevo, hay
        -- que actualizar los dos sitios, en el mismo orden.
        origin TEXT NOT NULL CHECK (origin IN ('import', 'manual', 'baseline')),
        captured_at TIMESTAMPTZ NOT NULL,
        tasks JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_snapshots_project
        ON project_snapshots (project_id, captured_at DESC);
    `);
  },

  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_project_snapshots_project;`);
    await client.query(`DROP TABLE IF EXISTS project_snapshots;`);
  },
};
