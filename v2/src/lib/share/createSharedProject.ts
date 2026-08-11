import pool from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensureSchema";
import {
  serializeProjectData,
  type ProjectData,
} from "@/lib/project/projectSerialization";
import { createShareToken, shareExpiryFrom } from "./shareToken";

/**
 * Da de alta un cronograma que se verá sin cuenta.
 *
 * **No pasa por `saveProject` a propósito**: aquello exige sesión y permiso de
 * proyecto, y aquí no hay ninguna de las dos — ese es justamente el punto de
 * E51.
 *
 * Y **no crea fila en `project_members`**, también a propósito. Un temporal no
 * es de nadie, y eso es lo que lo vuelve de solo lectura sin que nadie tenga
 * que acordarse: desde que un proyecto tiene dueño, `saveProject`,
 * `loadProject`, `listProjects` y `deleteProject` rechazan lo que no tiene
 * pertenencia. La única puerta que lo abre es el token, y solo para leer.
 *
 * Llama a `ensureSchema` porque esta ruta puede ser la **primera visita** de
 * una instalación: las columnas `share_token` y `expires_at` las crea la
 * migración 003, y hasta E51 las migraciones solo se disparaban al abrir la
 * Curva S.
 */
export async function createSharedProject(
  data: ProjectData,
): Promise<{ ok: true; token: string; id: string } | { ok: false; error: string }> {
  const token = createShareToken();
  const caduca = shareExpiryFrom(new Date());
  const serialized = serializeProjectData(data);

  const client = await pool.connect();
  try {
    await ensureSchema();
    const res = await client.query(
      `INSERT INTO projects (name, project_data, share_token, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        serialized.name,
        JSON.stringify(serialized),
        token,
        caduca.toISOString(),
      ],
    );

    return { ok: true, token, id: String(res.rows[0].id) };
  } catch (err) {
    console.error("createSharedProject error:", err);
    return { ok: false, error: "No pudimos guardar el cronograma." };
  } finally {
    client.release();
  }
}
