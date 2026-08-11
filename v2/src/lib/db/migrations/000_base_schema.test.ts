import { migration000BaseSchema } from "./000_base_schema";
import { ALL_MIGRATIONS } from "./index";

function clienteEspia() {
  const sql: string[] = [];
  return {
    sql,
    client: {
      query: async (text: string) => {
        sql.push(text);
        return { rows: [] };
      },
    },
  };
}

/**
 * La tabla que ninguna migración creaba, y que por eso hacía imposible levantar
 * una instalación nueva.
 *
 * Medido sobre una base virgen: de las seis migraciones, **cuatro fallaban** con
 * `relation "projects" does not exist`. Las tablas de sesión y pertenencia las
 * crea `ensureAuthTables` cuando alguien toca la sesión, pero `projects` no la
 * creaba nadie: `ensureProjectsTable` existe y **no la llama ningún sitio** —y
 * de haberla llamado, la habría creado con `id UUID` cuando la real es
 * `integer`.
 *
 * En la base que ya está en uso esto no cambia nada: la tabla existe y el
 * `IF NOT EXISTS` se salta. Lo que arregla es el arranque desde cero.
 *
 * **Las columnas que llegaron después no van aquí**: `share_token` y
 * `expires_at` los pone 003, y `version` la pone 005. Adelantarlas rompería el
 * sentido de esas migraciones y dejaría dos verdades sobre la misma columna.
 */
describe("000_base_schema", () => {
  test("va la primera, que es de lo que depende todo lo demás", () => {
    const ids = ALL_MIGRATIONS.map((m) => m.id);

    expect(ids[0]).toBe("000_base_schema");
    expect([...ids].sort()).toEqual(ids);
  });

  test("crea projects con `id` entero, como la base real", async () => {
    const { sql, client } = clienteEspia();

    await migration000BaseSchema.up(client);

    const todo = sql.join("\n");
    expect(todo).toContain("CREATE TABLE IF NOT EXISTS projects");
    // El tipo es el hallazgo, no un detalle: `ensureProjectsTable` la creaba
    // con UUID y el resto del código trata los ids como enteros.
    expect(todo).toMatch(/id\s+SERIAL PRIMARY KEY/);
    expect(todo).not.toContain("UUID");
  });

  test("no se adelanta a las columnas que añaden 003 y 005", async () => {
    const { sql, client } = clienteEspia();

    await migration000BaseSchema.up(client);

    const todo = sql.join("\n");
    expect(todo).not.toContain("share_token");
    expect(todo).not.toContain("expires_at");
    expect(todo).not.toContain("version");
  });

  test("deshacerla no borra los proyectos de nadie", async () => {
    const { sql, client } = clienteEspia();

    await migration000BaseSchema.down(client);

    const todo = sql.join("\n");
    // Un `down` que borra la tabla de proyectos es una forma de perder la obra
    // entera por un comando de mantenimiento. Esta migración adopta lo que ya
    // existía, así que deshacerla no puede destruirlo.
    expect(todo).not.toContain("DROP TABLE");
    expect(todo).not.toContain("DELETE");
  });
});
