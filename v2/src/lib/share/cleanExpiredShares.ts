import pool from "@/lib/db";

/**
 * Cuántos se borran como mucho en cada barrido.
 *
 * Hay tope porque el barrido cuelga de la subida: limpiar no puede encarecer la
 * acción del usuario que pasaba por ahí. Si quedan más, se los lleva el
 * siguiente.
 */
export const MAX_POR_BARRIDO = 50;

/**
 * Borra los cronogramas temporales que ya caducaron.
 *
 * **Tiene quien la llame**, y ese era el requisito: la spec dejó exigido que un
 * script sin disparador no borra nada. Es el patrón de `init-schema.sql`,
 * escrito y jamás ejecutado por la aplicación, y el de la suite E2E que acumuló
 * 268 proyectos por no limpiar lo que creaba.
 *
 * El disparador es `POST /api/ver-mpp`: antes de crear un temporal nuevo se
 * barren los viejos. Se autolimpia con el propio uso, no necesita
 * infraestructura, y quien crea temporales es exactamente quien los acumula.
 * Un borrado «al abrir el enlace» no cubriría el caso mayoritario —alguien
 * prueba la app, cierra la pestaña y no vuelve—, que es justo el que acumula.
 *
 * Nunca puede alcanzar un proyecto con dueño: exige `expires_at IS NOT NULL`,
 * y esa columna solo la tienen los temporales.
 */
export async function cleanExpiredShares(): Promise<number> {
  const client = await pool.connect();
  try {
    const caducados = await client.query(
      `DELETE FROM projects
        WHERE id IN (
          SELECT id FROM projects
           WHERE expires_at IS NOT NULL AND expires_at < NOW()
           LIMIT ${MAX_POR_BARRIDO}
        )
        RETURNING id`,
    );

    const ids = caducados.rows.map((row) => String(row.id));
    if (ids.length === 0) return 0;

    // Las fotos no caen en cascada: `project_snapshots.project_id` es TEXT y no
    // tiene clave foránea, porque el tipo de `projects.id` es ambiguo entre las
    // fuentes del esquema. Sin esto, la limpieza cambiaría una fuga por otra.
    await client.query(
      `DELETE FROM project_snapshots WHERE project_id = ANY($1::text[])`,
      [ids],
    );

    return ids.length;
  } catch (err) {
    // Limpiar es higiene, no la tarea de quien llamó: si falla, su subida sigue.
    console.error("cleanExpiredShares error:", err);
    return 0;
  } finally {
    client.release();
  }
}
