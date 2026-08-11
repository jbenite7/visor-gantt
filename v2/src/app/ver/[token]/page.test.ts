/**
 * @jest-environment node
 */
const loadSharedProject = jest.fn();
jest.mock("@/lib/share/loadSharedProject", () => ({
  loadSharedProject: (...a: unknown[]) => loadSharedProject(...a),
}));

const notFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
jest.mock("next/navigation", () => ({ notFound: () => notFound() }));

jest.mock("./SharedProjectView", () => ({
  __esModule: true,
  default: () => null,
}));

import Page from "./page";

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * La ruta pública. No exige sesión — ese es el punto de E51 — y por eso todo lo
 * que decide quién ve qué está en `loadSharedProject`, que autoriza por token.
 */
describe("GET /ver/<token>", () => {
  test("un enlace vivo enseña el cronograma", async () => {
    loadSharedProject.mockResolvedValue({
      id: "7",
      name: "Estación 16",
      data: { name: "Estación 16", tasks: [], calendar: undefined },
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });

    await expect(
      Page({ params: Promise.resolve({ token: "vivo" }) }),
    ).resolves.toBeTruthy();
  });

  test("un enlace que no existe responde como si nunca hubiera existido", async () => {
    loadSharedProject.mockResolvedValue(null);

    await expect(
      Page({ params: Promise.resolve({ token: "no-existe" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  test("un caducado tampoco se distingue de uno inexistente", async () => {
    // `loadSharedProject` ya devuelve null en los dos casos, y es deliberado:
    // distinguirlos le diría a un desconocido que ese enlace existió.
    loadSharedProject.mockResolvedValue(null);

    await expect(
      Page({ params: Promise.resolve({ token: "caducado" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("pide el proyecto por el token de la URL, no por otra cosa", async () => {
    loadSharedProject.mockResolvedValue(null);

    await Page({ params: Promise.resolve({ token: "tok-abc" }) }).catch(
      () => {},
    );

    expect(loadSharedProject).toHaveBeenCalledWith("tok-abc");
  });
});
