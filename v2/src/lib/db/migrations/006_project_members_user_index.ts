import type { Migration } from "@/lib/db/migrator";

/**
 * Un índice para la consulta que corre en cada carga de la home.
 *
 * `listProjects` filtra con `WHERE user_id = $1` sobre `project_members`, y la
 * clave primaria de esa tabla es `(project_id, user_id)`. Un índice compuesto no
 * sirve para buscar por su segunda columna, así que Postgres recorría la tabla
 * entera. Comprobado con `EXPLAIN` sobre la base real:
 *
 *     Seq Scan on project_members
 *       Filter: (user_id = '...'::uuid)
 *
 * **Con 308 filas esto no cuesta nada**, y conviene decirlo en vez de venderlo
 * como una mejora de rendimiento. Se pone porque el coste crece con proyectos ×
 * miembros y la consulta está en la pantalla que más se abre, no porque hoy se
 * note.
 */
export const migration006ProjectMembersUserIndex: Migration = {
  id: "006_project_members_user_index",

  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_members_user
        ON project_members (user_id);
    `);
  },

  async down(client) {
    // Solo el índice: los datos de pertenencia no se tocan.
    await client.query(`DROP INDEX IF EXISTS idx_project_members_user;`);
  },
};
