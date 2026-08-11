import { migration004ProjectOwnership } from "./004_project_ownership";
import { ALL_MIGRATIONS } from "./index";

function clienteEspia(rows: Record<string, unknown>[] = []) {
  const sql: string[] = [];
  return {
    sql,
    client: {
      query: async (text: string) => {
        sql.push(text);
        // La migración comprueba primero que la tabla de usuarios exista: en una
        // base recién creada la crea rbac.ts, no las migraciones.
        if (String(text).includes("to_regclass")) {
          return { rows: [{ existe: "users" }] };
        }
        return { rows };
      },
    },
  };
}

describe("004_project_ownership (los proyectos que ya existen necesitan dueño)", () => {
  test("está registrada, y el orden de aplicación es ascendente", () => {
    const ids = ALL_MIGRATIONS.map((m) => m.id);

    expect(ids).toContain("004_project_ownership");
    // «Va la última» envejece en cuanto alguien añade la siguiente. Lo que de
    // verdad importa es que se apliquen en orden: el migrador ejecuta el array
    // tal cual, así que un id fuera de sitio se aplicaría antes de tiempo.
    expect([...ids].sort()).toEqual(ids);
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

/**
 * En una base recién creada, `users` **todavía no existe**: la crean
 * `ensureAuthTables` (rbac.ts), no las migraciones. Este caso apareció al
 * probar contra una base virgen de verdad, y tumbaba el arranque entero con
 * `relation "users" does not exist`.
 *
 * La migración tiene que bastarse sola: si no hay a quién asignar proyectos,
 * no hay nada que hacer, y desde luego no hay que reventar.
 */
describe("sobre una base recién creada", () => {
  test("sin tabla de usuarios no revienta: no hay a quién asignar nada", async () => {
    const sql: string[] = [];
    const client = {
      query: async (text: string) => {
        sql.push(text);
        if (String(text).includes("to_regclass")) {
          return { rows: [{ existe: null }] };
        }
        throw new Error('relation "users" does not exist');
      },
    };

    await expect(
      migration004ProjectOwnership.up(client),
    ).resolves.toBeUndefined();

    // Comprueba que la tabla existe ANTES de consultarla.
    expect(sql[0]).toContain("to_regclass");
    expect(sql.join("\n")).not.toContain("INSERT INTO project_members");
  });
});
