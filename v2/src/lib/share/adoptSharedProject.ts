import pool from "@/lib/db";

/**
 * Un temporal pasa a ser un proyecto normal, con dueño.
 *
 * Es el motivo de negocio de E51: la persona prueba con su obra y se queda.
 * Pedirle que suba el archivo otra vez sería pedir esfuerzo en el peor momento.
 *
 * **Las dos escrituras van juntas.** Quitar `share_token` cierra el enlace
 * público y quitar `expires_at` impide que la limpieza se lo lleve; pero desde
 * que un proyecto tiene dueño, eso solo no basta: **sin fila en
 * `project_members` el usuario adopta su cronograma y lo pierde de vista** — no
 * sale en su home, no lo puede abrir y no lo puede guardar. Sería el peor final
 * posible para este flujo, así que o las dos o ninguna.
 *
 * `userId` sale de la sesión, nunca del cliente: si viniera del cliente,
 * cualquiera podría adoptar en nombre de otro.
 */
export async function adoptSharedProject(
  token: string,
  userId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const res = await client.query(
        `UPDATE projects
         SET share_token = NULL, expires_at = NULL, updated_at = NOW()
         WHERE share_token = $1 AND expires_at > NOW()
         RETURNING id`,
        [token],
      );

      const id = res.rows[0]?.id as string | number | undefined;
      if (id === undefined) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Ese enlace ya no está disponible." };
      }

      await client.query(
        `INSERT INTO project_members (project_id, user_id, role_id)
         VALUES ($1, $2, 'admin')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [String(id), userId],
      );

      await client.query("COMMIT");
      return { ok: true, id: String(id) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (err) {
    console.error("adoptSharedProject error:", err);
    return { ok: false, error: "No pudimos quedarnos el cronograma." };
  } finally {
    client.release();
  }
}
