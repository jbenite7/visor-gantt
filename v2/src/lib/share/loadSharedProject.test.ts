const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({ __esModule: true, default: { connect } }));

import { loadSharedProject } from "./loadSharedProject";

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [] });
});

const filaViva = {
  id: 7,
  name: "Torre 3",
  project_data: { name: "Torre 3", tasks: [], resources: [], assignments: [], budgetItems: [], budgetMappings: [], baselines: [] },
  expires_at: "2099-01-01T00:00:00.000Z",
};

/**
 * La única puerta del acceso compartido, y solo abre para leer.
 *
 * No pregunta por la sesión a propósito: quien llega por `/ver/<token>` no
 * tiene ninguna. El token **es** la autorización, y solo autoriza a leer.
 */
describe("loadSharedProject (E51: el token es la llave, y solo abre para leer)", () => {
  test("un token vivo devuelve el proyecto", async () => {
    query.mockResolvedValue({ rows: [filaViva] });

    const compartido = await loadSharedProject("un-token-valido");

    expect(compartido?.name).toBe("Torre 3");
  });

  test("busca por share_token, nunca por id: el id no abre nada", async () => {
    query.mockResolvedValue({ rows: [filaViva] });

    await loadSharedProject("un-token-valido");

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("share_token = $1");
    expect(sql).not.toMatch(/WHERE\s+id\s*=/i);
  });

  test("un token caducado no devuelve nada, aunque la fila siga en la base", async () => {
    query.mockResolvedValue({
      rows: [{ ...filaViva, expires_at: "2020-01-01T00:00:00.000Z" }],
    });

    await expect(loadSharedProject("un-token-viejo")).resolves.toBeNull();
  });

  test("un proyecto normal no se abre por esta puerta ni por accidente", async () => {
    // Sin `expires_at` no es temporal: es el proyecto de alguien con cuenta.
    query.mockResolvedValue({ rows: [{ ...filaViva, expires_at: null }] });

    await expect(loadSharedProject("lo-que-sea")).resolves.toBeNull();
  });

  test("un token que no existe devuelve null, no un error", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(loadSharedProject("no-existe")).resolves.toBeNull();
  });

  test("suelta el cliente aunque la consulta falle", async () => {
    query.mockRejectedValue(new Error("base caída"));

    await expect(loadSharedProject("t")).resolves.toBeNull();
    expect(release).toHaveBeenCalled();
  });
});
