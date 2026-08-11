const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({ __esModule: true, default: { connect } }));

import { adoptSharedProject } from "./adoptSharedProject";

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [{ id: 42 }], rowCount: 1 });
});

function sqlEjecutado(): string {
  return query.mock.calls.map((c) => String(c[0])).join("\n");
}

/**
 * Quedarse un cronograma que se abrió sin cuenta.
 *
 * Es el motivo de negocio de E51: la persona prueba con su obra y se queda.
 * Pedirle que suba el archivo otra vez sería pedir esfuerzo en el peor momento.
 */
describe("adoptSharedProject (E51)", () => {
  test("deja al usuario como dueño: si no, se queda un proyecto invisible", async () => {
    await adoptSharedProject("un-token", "user-7");

    // Sin esta fila el usuario adopta su cronograma y LO PIERDE DE VISTA: desde
    // que un proyecto tiene dueño, sin pertenencia no sale en su home, no lo
    // puede abrir y no lo puede guardar.
    expect(sqlEjecutado()).toContain("INSERT INTO project_members");
  });

  test("las dos escrituras van en la misma transacción", async () => {
    await adoptSharedProject("un-token", "user-7");

    const sql = sqlEjecutado();
    expect(sql).toContain("BEGIN");
    expect(sql).toContain("COMMIT");
  });

  test("adoptar retira el enlace público y la caducidad", async () => {
    await adoptSharedProject("un-token", "user-7");

    const sql = sqlEjecutado();
    expect(sql).toContain("share_token = NULL");
    expect(sql).toContain("expires_at = NULL");
  });

  test("si el enlace ya no vale, no deja pertenencias sueltas", async () => {
    query.mockImplementation(async (text: string) => {
      if (String(text).includes("UPDATE projects")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const r = await adoptSharedProject("caducado", "user-7");

    expect(r.ok).toBe(false);
    const sql = sqlEjecutado();
    expect(sql).toContain("ROLLBACK");
    expect(sql).not.toContain("INSERT INTO project_members");
  });

  test("un caducado no se puede adoptar: la consulta lo excluye", async () => {
    await adoptSharedProject("un-token", "user-7");

    expect(sqlEjecutado()).toContain("expires_at > NOW()");
  });

  test("suelta el cliente aunque falle", async () => {
    query.mockRejectedValue(new Error("base caída"));

    const r = await adoptSharedProject("t", "user-7");

    expect(r.ok).toBe(false);
    expect(release).toHaveBeenCalled();
  });
});
