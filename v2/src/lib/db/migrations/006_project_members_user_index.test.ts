import { migration006ProjectMembersUserIndex } from "./006_project_members_user_index";
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
 * La home filtra los proyectos por `user_id`, que es la **segunda** columna de
 * la clave primaria `(project_id, user_id)`. Un índice compuesto no sirve para
 * buscar por su segunda columna, así que Postgres hacía recorrido secuencial.
 *
 * Comprobado con `EXPLAIN` sobre la base real:
 *
 *     Seq Scan on project_members
 *       Filter: (user_id = '...'::uuid)
 *
 * Con 308 filas esto no cuesta nada, y conviene decirlo. Importa porque crece
 * con proyectos × miembros, y corre en la pantalla que más se abre.
 */
describe("006_project_members_user_index", () => {
  test("está registrada y el orden de aplicación es ascendente", () => {
    const ids = ALL_MIGRATIONS.map((m) => m.id);

    expect(ids).toContain("006_project_members_user_index");
    expect([...ids].sort()).toEqual(ids);
  });

  test("crea el índice por usuario", async () => {
    const { sql, client } = clienteEspia();

    await migration006ProjectMembersUserIndex.up(client);

    const todo = sql.join("\n");
    expect(todo).toContain("CREATE INDEX IF NOT EXISTS");
    expect(todo).toContain("project_members (user_id)");
  });

  test("deshacerla solo quita el índice", async () => {
    const { sql, client } = clienteEspia();

    await migration006ProjectMembersUserIndex.down(client);

    const todo = sql.join("\n");
    expect(todo).toContain("DROP INDEX IF EXISTS");
    expect(todo).not.toContain("DROP TABLE");
    expect(todo).not.toContain("DELETE");
  });
});
