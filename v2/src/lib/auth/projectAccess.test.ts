const query = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => query(...args) },
}));

import { canAccessProject, projectFilterFor } from "./projectAccess";

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
});

/**
 * Hasta el 2026-08-10 la app comprobaba **permiso global** y nunca propiedad:
 * `authorizeProjectAction` devolvía el `userId` y jamás llegaba a un `WHERE`.
 * Un usuario con rol `member` —el que se lleva todo login de Microsoft salvo
 * el primero— abría el proyecto de otro y el autoguardado le reemplazaba el
 * blob entero: tareas, costes, presupuestos y líneas base. Sin forjar nada.
 */
describe("canAccessProject", () => {
  test("el admin entra a cualquier proyecto, sin consultar la pertenencia", async () => {
    await expect(
      canAccessProject({ userId: "u1", roles: ["admin"] }, "7"),
    ).resolves.toBe(true);

    // Ni siquiera pregunta: el admin puede todo, por decisión del usuario.
    expect(query).not.toHaveBeenCalled();
  });

  test("un miembro entra a su proyecto", async () => {
    query.mockResolvedValue({ rows: [{ uno: 1 }] });

    await expect(
      canAccessProject({ userId: "u1", roles: ["member"] }, "7"),
    ).resolves.toBe(true);
  });

  test("quien no es miembro NO entra, aunque tenga el permiso global", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(
      canAccessProject({ userId: "intruso", roles: ["member"] }, "7"),
    ).resolves.toBe(false);
  });

  test("pregunta por ese usuario y ese proyecto, no por uno de los dos", async () => {
    await canAccessProject({ userId: "u1", roles: ["member"] }, "7");

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("FROM project_members");
    expect(String(sql)).toContain("project_id = $1");
    expect(String(sql)).toContain("user_id = $2");
    expect(params).toEqual(["7", "u1"]);
  });

  test("sin proyecto no hay acceso: no se cuela un id vacío", async () => {
    await expect(
      canAccessProject({ userId: "u1", roles: ["member"] }, ""),
    ).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("projectFilterFor · el listado solo enseña lo tuyo", () => {
  test("el admin ve todos, sin filtro", () => {
    const filtro = projectFilterFor({ userId: "u1", roles: ["admin"] });

    expect(filtro.where).toBe("");
    expect(filtro.params).toEqual([]);
  });

  test("los demás ven solo aquello de lo que son miembros", () => {
    const filtro = projectFilterFor({ userId: "u1", roles: ["member"] });

    expect(filtro.where).toContain("project_members");
    expect(filtro.where).toContain("$1");
    expect(filtro.params).toEqual(["u1"]);
  });
});
