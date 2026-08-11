import pool from "@/lib/db";

/**
 * Quién puede tocar qué proyecto.
 *
 * Hasta el 2026-08-10 esto no existía, y la consecuencia era grave:
 * `authorizeProjectAction` comprobaba el permiso **global** del rol, devolvía
 * el `userId` y **nunca lo usaba en un `WHERE`**. El `UPDATE` de `saveProject`
 * filtraba solo por el id que mandaba el cliente. Un usuario con rol `member`
 * —el que se lleva todo login de Microsoft salvo el primero— abría
 * `/project/<id>` ajeno y el autoguardado reemplazaba el blob entero del otro:
 * tareas, costes, presupuestos y líneas base. Sin forjar nada y sin rastro.
 *
 * El permiso dice **qué clase de cosas** puede hacer alguien; la pertenencia
 * dice **sobre qué proyectos**. Hacen falta las dos, y por eso esto vive
 * aparte de `userHasPermission` en vez de mezclarse con él.
 *
 * Se apoya en `project_members`, que ya existía en el esquema desde el
 * principio y a la que **ningún lector consultaba**.
 */
export interface ActorDeProyecto {
  userId: string;
  roles: string[];
}

/** Por decisión del usuario, el admin ve y edita cualquier proyecto. */
function esAdmin(actor: ActorDeProyecto): boolean {
  return actor.roles.includes("admin");
}

export async function canAccessProject(
  actor: ActorDeProyecto,
  projectId: string,
): Promise<boolean> {
  if (esAdmin(actor)) return true;
  // Un id vacío no puede resolverse a «cualquier proyecto».
  if (!projectId) return false;

  const result = await pool.query(
    `SELECT 1
       FROM project_members
      WHERE project_id = $1 AND user_id = $2
      LIMIT 1`,
    [projectId, actor.userId],
  );

  return result.rows.length > 0;
}

/**
 * El trozo de `WHERE` que deja ver solo lo propio en el listado.
 *
 * Devuelve texto y parámetros en vez de ejecutar, porque el listado ya tiene
 * su consulta y lo único que le falta es el filtro.
 */
export function projectFilterFor(actor: ActorDeProyecto): {
  where: string;
  params: string[];
} {
  if (esAdmin(actor)) return { where: "", params: [] };

  return {
    where: `WHERE id::text IN (
              SELECT project_id FROM project_members WHERE user_id = $1
            )`,
    params: [actor.userId],
  };
}
