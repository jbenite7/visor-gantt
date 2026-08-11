import type { Migration } from "@/lib/db/migrator";

/**
 * La tabla de proyectos, que hasta ahora no creaba nadie.
 *
 * En una base virgen fallaban cuatro de las seis migraciones con
 * `relation "projects" does not exist`: 002, 003, 005 y 006. Las tablas de
 * usuarios y pertenencias las levanta `ensureAuthTables` en cuanto alguien toca
 * la sesión, pero `projects` no la creaba ninguna ruta del arranque. La función
 * que parecía hacerlo, `ensureProjectsTable`, **no la llamaba ningún sitio**, y
 * de haberla llamado habría creado `id UUID` mientras el resto del código trata
 * los identificadores como enteros. Se retiró al escribir esta migración: dos
 * mecanismos para crear las mismas tablas es donde vuelven a divergir.
 *
 * Resultado: la app funcionaba en la base que ya estaba en uso y no se podía
 * instalar en una nueva. Esto lo cierra.
 *
 * **Adopta en vez de imponer.** Todo va con `IF NOT EXISTS`, así que sobre la
 * base que ya existe no cambia una sola fila: se registra como aplicada y sigue.
 * El esquema de aquí está copiado del que la base real tiene hoy —`id` entero
 * con secuencia, `project_data` con su valor por defecto— para que instalar
 * desde cero produzca exactamente lo mismo que hay en marcha.
 *
 * **Lo que a propósito no está aquí:** `share_token` y `expires_at` los añade
 * 003, y `version` la añade 005. Adelantarlas dejaría dos sitios definiendo la
 * misma columna, que es justo la clase de duplicado que este trabajo lleva
 * semanas quitando.
 */
export const migration000BaseSchema: Migration = {
  id: "000_base_schema",

  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        project_data JSONB DEFAULT '{"tasks": [], "baselines": [], "resources": [], "assignments": [], "budgetItems": [], "budgetMappings": []}'::jsonb,
        start_date TIMESTAMP,
        finish_date TIMESTAMP,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS matrix_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_type TEXT,
        template_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  },

  /**
   * No deshace nada, y es deliberado.
   *
   * Esta migración adopta una tabla que en las instalaciones en uso ya existía
   * con los cronogramas dentro. Un `DROP TABLE projects` aquí convertiría un
   * comando de mantenimiento en la pérdida de la obra entera. Si alguien
   * necesita vaciar una base, que lo haga a mano y sabiendo lo que borra.
   */
  async down() {
    // Intencionadamente vacío. Ver el comentario de arriba.
  },
};
