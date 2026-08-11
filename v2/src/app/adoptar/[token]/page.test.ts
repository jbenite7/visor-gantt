/**
 * @jest-environment node
 */
const getCurrentUser = jest.fn();
jest.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const adoptSharedProject = jest.fn();
jest.mock("@/lib/share/adoptSharedProject", () => ({
  adoptSharedProject: (...a: unknown[]) => adoptSharedProject(...a),
}));

const redirect = jest.fn((destino: string) => {
  throw new Error(`REDIRECT:${destino}`);
});
jest.mock("next/navigation", () => ({ redirect: (d: string) => redirect(d) }));

import Page from "./page";

beforeEach(() => {
  jest.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user-7", roles: ["member"] });
  adoptSharedProject.mockResolvedValue({ ok: true, id: "42" });
});

/**
 * Quedarse el cronograma que se abrió sin cuenta.
 *
 * Esta ruta existe porque `SharedProjectView` enlaza a ella. Un enlace a una
 * ruta que no existe es un botón que promete lo que no hace, que es el patrón
 * que este trabajo lleva semanas eliminando.
 */
describe("GET /adoptar/<token>", () => {
  test("sin sesión manda al login, y guarda a dónde volvía", async () => {
    getCurrentUser.mockResolvedValue(null);

    await Page({ params: Promise.resolve({ token: "tok-9" }) }).catch(() => {});

    expect(redirect).toHaveBeenCalledWith(
      expect.stringContaining("/login?next="),
    );
    expect(redirect.mock.calls[0][0]).toContain("tok-9");
    // Sin sesión no se intenta adoptar: no hay a nombre de quién.
    expect(adoptSharedProject).not.toHaveBeenCalled();
  });

  test("con sesión, adopta a nombre del usuario de la sesión", async () => {
    await Page({ params: Promise.resolve({ token: "tok-9" }) }).catch(() => {});

    expect(adoptSharedProject).toHaveBeenCalledWith("tok-9", "user-7");
  });

  test("al adoptar, lleva al proyecto ya suyo", async () => {
    await Page({ params: Promise.resolve({ token: "tok-9" }) }).catch(() => {});

    expect(redirect).toHaveBeenCalledWith("/project/42");
  });

  test("si el enlace ya no vale, lo dice en vez de dejar una pantalla en blanco", async () => {
    adoptSharedProject.mockResolvedValue({
      ok: false,
      error: "Ese enlace ya no está disponible.",
    });

    const salida = await Page({
      params: Promise.resolve({ token: "caducado" }),
    });

    expect(salida).toBeTruthy();
    expect(redirect).not.toHaveBeenCalledWith("/project/42");
  });
});
