const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({ __esModule: true, default: { connect } }));

import { createSharedProject } from "./createSharedProject";
import type { ProjectData } from "@/lib/project/projectSerialization";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";

const datos: ProjectData = {
  name: "Estación 16",
  tasks: [],
  resources: [],
  assignments: [],
  budgetItems: [],
  budgetMappings: [],
  baselines: [],
  calendar: DEFAULT_PROJECT_CALENDAR,
};

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [{ id: 7 }], rowCount: 1 });
});

/**
 * El alta de un temporal no pasa por `saveProject` a propósito: aquello exige
 * sesión y permiso de proyecto, y aquí no hay ninguna de las dos — ese es el
 * punto de E51.
 */
describe("createSharedProject (E51)", () => {
  test("guarda el proyecto y devuelve un token para verlo", async () => {
    const r = await createSharedProject(datos);

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.token.length).toBeGreaterThanOrEqual(32);
  });

  test("nace con caducidad: un temporal sin fecha sería un proyecto eterno de nadie", async () => {
    await createSharedProject(datos);

    const insert = query.mock.calls.find((c) =>
      String(c[0]).includes("INSERT INTO projects"),
    );
    expect(String(insert![0])).toContain("share_token");
    expect(String(insert![0])).toContain("expires_at");
    // El token y la caducidad van como parámetros, no incrustados.
    expect((insert![1] as unknown[]).length).toBeGreaterThanOrEqual(4);
  });

  test("NO deja dueño: un temporal no es de nadie, y eso es lo que lo hace de solo lectura", async () => {
    await createSharedProject(datos);

    const sql = query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).not.toContain("project_members");
  });

  test("dos altas seguidas no comparten token", async () => {
    const a = await createSharedProject(datos);
    const b = await createSharedProject(datos);

    if (a.ok && b.ok) expect(a.token).not.toBe(b.token);
  });

  test("si la base falla, se informa y se suelta el cliente", async () => {
    query.mockRejectedValue(new Error("disco lleno"));

    const r = await createSharedProject(datos);

    expect(r.ok).toBe(false);
    expect(release).toHaveBeenCalled();
  });
});
