import fs from "fs";
import { Client } from "pg";
import { MARCA_DE_ARRANQUE } from "./global-setup";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://visoruser:visorpass@localhost:5432/visormpp";

/**
 * Borra los proyectos que creó **esta** corrida, y solo esos.
 *
 * El criterio es la ventana de tiempo: nada anterior al arranque se toca. Los
 * proyectos que ya estaban en la base antes de correr —incluidos los 268 que la
 * suite dejó acumulados hasta el 2026-08-10— sobreviven: limpiarlos es una
 * decisión del dueño de la base, no de un teardown.
 *
 * Si la limpieza falla, se avisa pero no se tumba la corrida: un borrado que no
 * se pudo hacer no invalida unos tests que ya pasaron.
 */
export default async function globalTeardown() {
  if (process.env.E2E_CONSERVAR_DATOS === "1") {
    console.log("[limpieza] E2E_CONSERVAR_DATOS=1: no se borra nada.");
    return;
  }

  let arranque: string;
  try {
    arranque = JSON.parse(fs.readFileSync(MARCA_DE_ARRANQUE, "utf8")).arranque;
  } catch {
    console.warn("[limpieza] Sin marca de arranque: no se borra nada.");
    return;
  }

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    // `tasks`, `dependencies` y `resources` caen solas: tienen clave foránea con
    // ON DELETE CASCADE. `project_snapshots` no la tiene —su `project_id` es
    // TEXT y el tipo de `projects.id` es ambiguo entre las fuentes del esquema—,
    // así que se borra a mano, igual que hace `deleteProject` en la app. Sin
    // esto la limpieza dejaría fotos huérfanas, que es cambiar una fuga por otra.
    await client.query("BEGIN");
    try {
      const { rows } = await client.query(
        "SELECT id FROM projects WHERE created_at >= $1",
        [arranque],
      );
      const ids = rows.map((row) => String(row.id));
      if (ids.length > 0) {
        await client.query(
          "DELETE FROM project_snapshots WHERE project_id = ANY($1::text[])",
          [ids],
        );
        // `projects.id` es integer aquí; `project_snapshots.project_id` es text.
        await client.query("DELETE FROM projects WHERE id = ANY($1::int[])", [ids]);
      }
      await client.query("COMMIT");
      console.log(
        `[limpieza] Borrados ${ids.length} proyectos creados por esta corrida (desde ${arranque}).`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.warn(`[limpieza] No se pudo limpiar la base: ${String(error)}`);
  } finally {
    await client.end().catch(() => {});
  }
}
