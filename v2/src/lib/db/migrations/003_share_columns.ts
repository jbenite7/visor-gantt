import type { Migration } from "@/lib/db/migrator";

/**
 * `projects` admite proyectos **temporales**: los que se ven sin cuenta.
 *
 * Un proyecto con `expires_at IS NOT NULL` es temporal, y `share_token` es su
 * enlace. Adoptarlo —crear cuenta y quedárselo— es poner las dos a `NULL`.
 *
 * Va por migración y no por `db.ts`. El plan original decía escribirlas en
 * `ensureProjectsTable`, y al ir a mirar resultó que **esa función no la llama
 * nadie** en todo el repositorio: las columnas no se habrían creado nunca, y
 * los tests del plan habrían pasado igual porque solo leían el texto del
 * archivo. Aquí, en cambio, hay un registro de lo aplicado y un `down`.
 *
 * Y por `ALTER`, no cambiando el `CREATE TABLE`: ese lleva `IF NOT EXISTS`, así
 * que en cualquier base que ya exista no se vuelve a ejecutar y las columnas
 * nuevas no aparecerían.
 */
export const migration003ShareColumns: Migration = {
  id: "003_share_columns",

  async up(client) {
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
    `);
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    `);
    // La ruta pública busca por token, nunca por id.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_share_token
        ON projects (share_token);
    `);
  },

  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_projects_share_token;`);
    // Solo las columnas. Deshacer esto no puede llevarse por delante los
    // proyectos de nadie.
    await client.query(`
      ALTER TABLE projects DROP COLUMN IF EXISTS expires_at;
    `);
    await client.query(`
      ALTER TABLE projects DROP COLUMN IF EXISTS share_token;
    `);
  },
};
