import pool from "@/lib/db";
import {
  deserializeProjectData,
  type ProjectData,
  type SerializedProjectData,
} from "@/lib/project/projectSerialization";
import { isShareExpired } from "./shareToken";

export interface SharedProject {
  id: string;
  name: string;
  data: ProjectData;
  expiresAt: Date;
}

/**
 * La única puerta del acceso compartido, y solo abre para leer.
 *
 * No pregunta por la sesión a propósito: quien llega por `/ver/<token>` no
 * tiene ninguna, y no se le fabrica. El token **es** la autorización.
 *
 * Que de aquí no se pueda escribir no depende de que nadie se acuerde de
 * comprobarlo: un proyecto temporal no tiene fila en `project_members`, así que
 * `saveProject`, `loadProject`, `listProjects` y `deleteProject` lo rechazan
 * por sí solos desde que un proyecto tiene dueño. Sin sesión **y** sin
 * pertenencia: dos cerraduras, y ninguna es una lista que alguien deba ampliar
 * cuando aparezca una tabla nueva.
 *
 * Busca por `share_token` y **nunca por `id`**: si buscara por id, conocer el
 * número de un proyecto ajeno bastaría para leerlo.
 */
export async function loadSharedProject(
  token: string,
): Promise<SharedProject | null> {
  if (!token) return null;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, name, project_data, expires_at
         FROM projects
        WHERE share_token = $1`,
      [token],
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0] as {
      id: string | number;
      name: string;
      project_data: SerializedProjectData;
      expires_at: string | null;
    };

    // Sin caducidad no es un temporal: es el proyecto de alguien con cuenta, y
    // por esta puerta no se entrega ni por accidente.
    if (!row.expires_at) return null;
    if (isShareExpired(row.expires_at, new Date())) return null;

    return {
      id: String(row.id),
      name: row.name,
      data: deserializeProjectData(String(row.id), row),
      expiresAt: new Date(row.expires_at),
    };
  } catch (err) {
    console.error("loadSharedProject error:", err);
    return null;
  } finally {
    client.release();
  }
}
