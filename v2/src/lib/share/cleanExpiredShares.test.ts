const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({ __esModule: true, default: { connect } }));

import { cleanExpiredShares, MAX_POR_BARRIDO } from "./cleanExpiredShares";

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });
});

function sqlEjecutado(): string {
  return query.mock.calls.map((c) => String(c[0])).join("\n");
}

/**
 * El borrado de los temporales caducados, **con quien lo dispare**.
 *
 * La spec lo dejó exigido: un script sin llamador no borra nada. Es el patrón
 * de `scripts/init-schema.sql`, escrito y jamás ejecutado por la aplicación, y
 * el de la suite E2E que acumuló 268 proyectos por no limpiar lo que creaba.
 *
 * El caso mayoritario es justo el que un borrado «al abrir» no cubre: alguien
 * prueba la app, cierra la pestaña y no vuelve nunca.
 */
describe("cleanExpiredShares", () => {
  test("borra los temporales cuya fecha ya pasó", async () => {
    const borrados = await cleanExpiredShares();

    expect(borrados).toBe(2);
    const sql = sqlEjecutado();
    expect(sql).toContain("DELETE FROM projects");
    expect(sql).toContain("expires_at < NOW()");
  });

  test("nunca toca un proyecto con dueño: solo los que tienen caducidad", async () => {
    await cleanExpiredShares();

    // Sin esta condición, un fallo en la fecha se llevaría por delante los
    // proyectos de gente con cuenta.
    expect(sqlEjecutado()).toContain("expires_at IS NOT NULL");
  });

  test("tiene tope por barrido: limpiar no puede encarecer una subida", async () => {
    await cleanExpiredShares();

    expect(MAX_POR_BARRIDO).toBeGreaterThan(0);
    expect(sqlEjecutado()).toContain("LIMIT");
  });

  test("se lleva también las fotos, que no caen en cascada", async () => {
    await cleanExpiredShares();

    // `project_snapshots.project_id` no tiene clave foránea -su tipo es TEXT y
    // el de `projects.id` es ambiguo entre las fuentes del esquema-, así que
    // sin esto la limpieza cambiaria una fuga por otra.
    expect(sqlEjecutado()).toContain("project_snapshots");
  });

  test("si no hay nada que borrar, no se inventa trabajo", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(cleanExpiredShares()).resolves.toBe(0);
    expect(sqlEjecutado()).not.toContain("project_snapshots");
  });

  test("un fallo no tumba a quien la llamó: limpiar es higiene, no la tarea", async () => {
    query.mockRejectedValue(new Error("base caída"));

    await expect(cleanExpiredShares()).resolves.toBe(0);
    expect(release).toHaveBeenCalled();
  });
});
