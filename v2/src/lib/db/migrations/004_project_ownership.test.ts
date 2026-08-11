import { migration004ProjectOwnership } from "./004_project_ownership";
import { ALL_MIGRATIONS } from "./index";

function clienteEspia(rows: Record<string, unknown>[] = []) {
  const sql: string[] = [];
  return {
    sql,
    client: {
      query: async (text: string) => {
        sql.push(text);
        return { rows };
      },
    },
  };
}

describe("004_project_ownership (los proyectos que ya existen necesitan dueño)", () => {
  test("está registrada y va la última", () => {
    const ids = ALL_MIGRATIONS.map((m) => m.id);

    expect(ids).toContain("004_project_ownership");
    expect(ids.indexOf("004_project_ownership")).toBe(ids.length - 1);
  });

  test("asigna los proyectos existentes al admin más antiguo", async () => {
    const { sql, client } = clienteEspia([{ id: "admin-1" }]);

    await migration004ProjectOwnership.up(client);

    const todo = sql.join("\n");
    expect(todo).toContain("INSERT INTO project_members");
    // El repositorio no guarda quién creó cada proyecto, así que cualquier otra
    // asignación sería inventarse un dueño.
    expect(todo).toContain("user_roles");
    expect(todo).toContain("ORDER BY");
  });

  test("no pisa una pertenencia que ya exista", async () => {
    const { sql, client } = clienteEspia([{ id: "admin-1" }]);

    await migration004ProjectOwnership.up(client);

    expect(sql.join("\n")).toContain("ON CONFLICT");
  });

  test("sin ningún admin no inventa dueño ni revienta", async () => {
    const { sql, client } = clienteEspia([]);

    await expect(
      migration004ProjectOwnership.up(client),
    ).resolves.toBeUndefined();

    expect(sql.join("\n")).not.toContain("INSERT INTO project_members");
  });

  test("se puede deshacer, y solo quita lo que puso", async () => {
    const { sql, client } = clienteEspia([{ id: "admin-1" }]);

    await migration004ProjectOwnership.down(client);

    const todo = sql.join("\n");
    expect(todo).toContain("DELETE FROM project_members");
    // Deshacer no puede llevarse proyectos ni usuarios por delante.
    expect(todo).not.toContain("DROP TABLE");
    expect(todo).not.toContain("DELETE FROM projects");
  });
});
