import type { Migration } from "@/lib/db/migrator";

/**
 * Los proyectos que ya existían pasan a tener dueño.
 *
 * Hasta el 2026-08-10 un proyecto no era de nadie: `authorizeProjectAction`
 * comprobaba el permiso global del rol y nunca la propiedad, así que cualquier
 * usuario con rol `member` podía abrir y sobrescribir el proyecto de otro.
 * Al cerrar eso, los proyectos ya guardados se quedarían sin ningún miembro:
 * nadie podría abrirlos, ni siquiera quien los creó.
 *
 * **Se asignan al admin más antiguo**, por decisión del usuario. El repositorio
 * no guarda quién creó cada proyecto —`projects` nunca tuvo columna de dueño—,
 * así que cualquier otra asignación sería inventarse un dueño. El admin puede
 * repartirlos después.
 *
 * `project_members` ya existía en el esquema desde el principio y ningún lector
 * la consultaba; esto la pone en uso en vez de inventar otra tabla.
 */
export const migration004ProjectOwnership: Migration = {
  id: "004_project_ownership",

  async up(client) {
    // En una base recién creada `users` todavía no existe: la crean
    // `ensureAuthTables` (rbac.ts), no las migraciones, y nada garantiza el
    // orden entre las dos cosas. Sin esta comprobación, aplicar el esquema en
    // una instalación nueva moría con `relation "users" does not exist`.
    //
    // Y no hace falta más: sin usuarios no hay a quién asignar proyectos. La
    // primera persona que entre creará los suyos, y esos ya nacen con dueño.
    const hayUsuarios = await client.query(
      `SELECT to_regclass('users') AS existe`,
    );
    if (!hayUsuarios.rows[0]?.existe) return;

    const admin = await client.query(
      `SELECT u.id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
        WHERE ur.role_id = 'admin'
        ORDER BY u.created_at ASC
        LIMIT 1`,
    );

    // Una instalación sin admin todavía no tiene a quién asignárselos. No se
    // inventa un dueño: la migración queda aplicada y sin efecto.
    if (admin.rows.length === 0) return;

    const adminId = String(admin.rows[0].id);

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role_id)
       SELECT p.id::text, $1, 'admin' FROM projects p
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [adminId],
    );
  },

  async down(client) {
    // Solo las pertenencias que puso esta migración: las que se crearon después
    // al guardar un proyecto nuevo llevan el mismo formato, así que se retiran
    // todas las del admin. Ni proyectos ni usuarios se tocan.
    const admin = await client.query(
      `SELECT u.id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
        WHERE ur.role_id = 'admin'
        ORDER BY u.created_at ASC
        LIMIT 1`,
    );
    if (admin.rows.length === 0) return;

    await client.query(
      `DELETE FROM project_members WHERE user_id = $1 AND role_id = 'admin'`,
      [String(admin.rows[0].id)],
    );
  },
};
