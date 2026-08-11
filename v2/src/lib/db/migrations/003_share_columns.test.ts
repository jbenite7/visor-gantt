import { migration003ShareColumns } from "./003_share_columns";
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

describe("003_share_columns (E51: la tabla admite proyectos temporales)", () => {
  test("está registrada, y después de las dos que ya había", () => {
    const ids = ALL_MIGRATIONS.map((m) => m.id);

    expect(ids).toContain("003_share_columns");
    expect(ids.indexOf("003_share_columns")).toBe(ids.length - 1);
  });

  test("añade el enlace con ALTER, no tocando el CREATE TABLE", async () => {
    const { sql, client } = clienteEspia();

    await migration003ShareColumns.up(client);

    const todo = sql.join("\n");
    // Un `CREATE TABLE IF NOT EXISTS` no se reejecuta en bases ya creadas: si
    // las columnas fueran allí, en cualquier base existente no aparecerían.
    expect(todo).toContain("ALTER TABLE projects");
    expect(todo).toContain("ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE");
    expect(todo).not.toContain("CREATE TABLE");
  });

  test("añade la caducidad", async () => {
    const { sql, client } = clienteEspia();

    await migration003ShareColumns.up(client);

    expect(sql.join("\n")).toContain(
      "ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
    );
  });

  test("se busca por token, así que hay índice", async () => {
    const { sql, client } = clienteEspia();

    await migration003ShareColumns.up(client);

    expect(sql.join("\n")).toContain("idx_projects_share_token");
  });

  test("se puede deshacer, y no se lleva la tabla por delante", async () => {
    const { sql, client } = clienteEspia();

    await migration003ShareColumns.down(client);

    const todo = sql.join("\n");
    expect(todo).toContain("DROP COLUMN IF EXISTS share_token");
    expect(todo).toContain("DROP COLUMN IF EXISTS expires_at");
    // Deshacer esta migración no puede borrar los proyectos de nadie.
    expect(todo).not.toContain("DROP TABLE");
  });
});
