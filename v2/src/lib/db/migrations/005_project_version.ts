import type { Migration } from "@/lib/db/migrator";

/**
 * Un contador de versión por proyecto, para que dos pestañas dejen de pisarse.
 *
 * Sin él, la pestaña B reescribía el blob entero con su copia antigua y borraba
 * el trabajo de la A. Ninguna se enteraba: las dos decían «Guardado». El
 * `UPDATE` de `saveProject` ahora exige que la versión case, así que el segundo
 * guardado no toca ninguna fila y se puede avisar en vez de perder trabajo.
 *
 * `DEFAULT 1 NOT NULL` importa: sin valor por defecto los proyectos que ya
 * existen quedarían con `NULL`, ninguna comparación casaría y se volverían
 * inservibles: cada guardado diría que otra pestaña se adelantó.
 */
export const migration005ProjectVersion: Migration = {
  id: "005_project_version",

  async up(client) {
    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    `);
  },

  async down(client) {
    await client.query(`
      ALTER TABLE projects DROP COLUMN IF EXISTS version;
    `);
  },
};
