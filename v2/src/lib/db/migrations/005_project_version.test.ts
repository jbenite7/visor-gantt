import { migration005ProjectVersion } from "./005_project_version";
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

describe("005_project_version (dos pestañas dejan de pisarse)", () => {
  test("está registrada, y el orden de aplicación es ascendente", () => {
    const ids = ALL_MIGRATIONS.map((m) => m.id);

    expect(ids).toContain("005_project_version");
    // «Va la última» envejece en cuanto alguien añade la siguiente. Lo que de
    // verdad importa es que se apliquen en orden: el migrador ejecuta el array
    // tal cual, así que un id fuera de sitio se aplicaría antes de tiempo.
    expect([...ids].sort()).toEqual(ids);
  });

  test("añade la columna con ALTER y con valor por defecto", async () => {
    const { sql, client } = clienteEspia();

    await migration005ProjectVersion.up(client);

    const todo = sql.join("\n");
    expect(todo).toContain("ALTER TABLE projects");
    expect(todo).toContain("ADD COLUMN IF NOT EXISTS version");
    // Sin DEFAULT, los proyectos que ya existen tendrían NULL y ningún
    // guardado volvería a casar la versión: quedarían inservibles.
    expect(todo).toContain("DEFAULT 1");
    expect(todo).toContain("NOT NULL");
    expect(todo).not.toContain("CREATE TABLE");
  });

  test("se deshace quitando solo la columna", async () => {
    const { sql, client } = clienteEspia();

    await migration005ProjectVersion.down(client);

    const todo = sql.join("\n");
    expect(todo).toContain("DROP COLUMN IF EXISTS version");
    expect(todo).not.toContain("DROP TABLE");
  });
});
