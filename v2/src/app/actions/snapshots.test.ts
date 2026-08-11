import type { ProjectSnapshot } from "@/types/snapshot";
import { createProjectDate } from "@/lib/date/projectDate";

const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect },
}));

const getCurrentUser = jest.fn(async () => ({
  id: "user-1",
  email: "aia@example.com",
}));
const userHasPermission = jest.fn(async () => true);

jest.mock("@/lib/auth/session", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));
jest.mock("@/lib/auth/rbac", () => ({
  userHasPermission: (...args: unknown[]) => userHasPermission(...args),
}));

import {
  listProjectSnapshots,
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "./snapshots";

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [] });
  getCurrentUser.mockResolvedValue({ id: "user-1", email: "aia@example.com" });
  userHasPermission.mockResolvedValue(true);
});

/** Todo el SQL que la acción ejecutó, en un solo texto. */
function sqlEjecutado(): string {
  return query.mock.calls.map((call) => String(call[0])).join("\n");
}

describe("listProjectSnapshots", () => {
  test("devuelve los resúmenes ordenados de la foto más nueva a la más vieja", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("SELECT id, name, origin, captured_at")) {
        return {
          rows: [
            {
              id: "foto-2",
              name: "Corte de febrero",
              origin: "import",
              captured_at: "2026-02-05T00:00:00.000Z",
              task_count: "12",
            },
            {
              id: "foto-1",
              name: "Contractual",
              origin: "baseline",
              captured_at: "2026-01-05T00:00:00.000Z",
              task_count: "9",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const fotos = await listProjectSnapshots("p1");

    expect(fotos).toHaveLength(2);
    expect(fotos[0]).toEqual({
      id: "foto-2",
      name: "Corte de febrero",
      origin: "import",
      capturedAt: new Date("2026-02-05T00:00:00.000Z"),
      taskCount: 12,
    });
    expect(sqlEjecutado()).toContain("ORDER BY captured_at DESC");
  });

  test("aplica las migraciones antes de leer, para que la tabla exista", async () => {
    await listProjectSnapshots("p1");

    expect(sqlEjecutado()).toContain("CREATE TABLE IF NOT EXISTS schema_migrations");
  });

  test("suelta el cliente aunque la consulta falle", async () => {
    query.mockRejectedValue(new Error("sin conexión"));

    await expect(listProjectSnapshots("p1")).resolves.toEqual([]);
    expect(release).toHaveBeenCalled();
  });
});

describe("loadProjectSnapshot", () => {
  test("reconstruye las fechas de la foto", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("SELECT id, name, origin, captured_at, tasks")) {
        return {
          rows: [
            {
              id: "foto-1",
              name: "Contractual",
              origin: "baseline",
              captured_at: "2026-01-05T00:00:00.000Z",
              tasks: [
                {
                  taskId: 7,
                  start: "2026-01-01T00:00:00.000Z",
                  finish: "2026-01-08T00:00:00.000Z",
                  duration: 8,
                },
              ],
            },
          ],
        };
      }
      return { rows: [] };
    });

    const foto = await loadProjectSnapshot("p1", "foto-1");

    expect(foto).not.toBeNull();
    expect(foto!.capturedAt).toEqual(new Date("2026-01-05T00:00:00.000Z"));
    expect(foto!.tasks[0].start).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(foto!.tasks[0].duration).toBe(8);
  });

  test("una foto que no existe devuelve null, no un error", async () => {
    await expect(loadProjectSnapshot("p1", "no-existe")).resolves.toBeNull();
  });
});

describe("saveProjectSnapshot", () => {
  const foto: ProjectSnapshot = {
    id: "foto-1",
    projectId: "p1",
    name: "Corte de enero",
    origin: "manual",
    capturedAt: createProjectDate("2026-01-20"),
    tasks: [
      {
        taskId: 7,
        name: "Excavación",
        start: createProjectDate("2026-01-01"),
        finish: createProjectDate("2026-01-10"),
        duration: 10,
        progress: 40,
      },
    ],
  };

  test("inserta la foto sin pisar una ya existente con el mismo id", async () => {
    const resultado = await saveProjectSnapshot(foto);

    expect(resultado).toEqual({ success: true });
    expect(sqlEjecutado()).toContain("INSERT INTO project_snapshots");
    expect(sqlEjecutado()).toContain("ON CONFLICT (project_id, id) DO NOTHING");
  });

  test("un fallo de base de datos se informa, no se traga", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("INSERT INTO project_snapshots")) {
        throw new Error("disco lleno");
      }
      return { rows: [] };
    });

    const resultado = await saveProjectSnapshot(foto);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toContain("disco lleno");
    expect(release).toHaveBeenCalled();
  });
});

/**
 * Estas tres acciones no comprobaban nada: ni sesión, ni permiso.
 *
 * No hay `middleware.ts` en el proyecto —la protección es página por página y
 * acción por acción—, así que se habían quedado fuera de las dos redes.
 * Mientras todo vivía detrás del login importaba poco; E51 abre una ruta
 * pública, y entonces «escribir una foto en el proyecto de otro» deja de pedir
 * nada más que saber su identificador.
 */
describe("las fotos exigen sesión y permiso", () => {
  const foto = {
    projectId: "p1",
    id: "foto-1",
    name: "Corte",
    origin: "manual" as const,
    capturedAt: createProjectDate("2026-02-05"),
    tasks: [],
  } satisfies ProjectSnapshot;

  test("sin sesión no se escribe una foto, y no se llega a tocar la base", async () => {
    getCurrentUser.mockResolvedValue(null as never);

    const resultado = await saveProjectSnapshot(foto);

    expect(resultado.success).toBe(false);
    expect(sqlEjecutado()).not.toContain("INSERT INTO project_snapshots");
  });

  test("con sesión pero sin permiso de edición, tampoco", async () => {
    userHasPermission.mockResolvedValue(false);

    const resultado = await saveProjectSnapshot(foto);

    expect(resultado.success).toBe(false);
    expect(sqlEjecutado()).not.toContain("INSERT INTO project_snapshots");
  });

  test("sin sesión no se listan ni se leen las fotos de un proyecto ajeno", async () => {
    getCurrentUser.mockResolvedValue(null as never);

    await expect(listProjectSnapshots("p1")).resolves.toEqual([]);
    await expect(loadProjectSnapshot("p1", "foto-1")).resolves.toBeNull();
    expect(sqlEjecutado()).not.toContain("FROM project_snapshots");
  });
});
