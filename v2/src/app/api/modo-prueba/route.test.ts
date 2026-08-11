/**
 * @jest-environment node
 */
const query = jest.fn(async (..._a: unknown[]) => ({
  rows: [{ id: "usuario-de-prueba" }],
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...a: unknown[]) => query(...a) },
}));

jest.mock("@/lib/auth/rbac", () => ({
  ensureAuthTables: jest.fn(async () => {}),
}));

const createSessionForUser = jest.fn(async (..._a: unknown[]) => {});
jest.mock("@/lib/auth/session", () => ({
  createSessionForUser: (...a: unknown[]) => createSessionForUser(...a),
}));

import { GET } from "./route";

function peticion(url = "http://127.0.0.1:3000/api/modo-prueba") {
  return { nextUrl: new URL(url) } as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/modo-prueba", () => {
  const entornoOriginal = process.env.VISOR_TEST_MODE;

  afterEach(() => {
    if (entornoOriginal === undefined) delete process.env.VISOR_TEST_MODE;
    else process.env.VISOR_TEST_MODE = entornoOriginal;
    query.mockClear();
    createSessionForUser.mockClear();
  });

  test("sin la variable de entorno responde 404 y no abre ninguna sesión", async () => {
    delete process.env.VISOR_TEST_MODE;

    const respuesta = await GET(peticion());

    expect(respuesta.status).toBe(404);
    // Lo que de verdad importa no es el código: es que no llegó a tocar la base
    // ni a firmar una cookie.
    expect(createSessionForUser).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  test("con un valor que no es exactamente 1, sigue apagada", async () => {
    process.env.VISOR_TEST_MODE = "true";

    const respuesta = await GET(peticion());

    expect(respuesta.status).toBe(404);
    expect(createSessionForUser).not.toHaveBeenCalled();
  });

  test("encendida, abre la sesión y redirige a la app", async () => {
    process.env.VISOR_TEST_MODE = "1";

    const respuesta = await GET(peticion());

    expect(createSessionForUser).toHaveBeenCalledWith("usuario-de-prueba");
    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("http://127.0.0.1:3000/");
  });

  test("un destino externo no se obedece: esto no es un redirector abierto", async () => {
    process.env.VISOR_TEST_MODE = "1";

    const respuesta = await GET(
      peticion("http://127.0.0.1:3000/api/modo-prueba?destino=https://malo.example/x"),
    );

    expect(respuesta.headers.get("location")).toBe("http://127.0.0.1:3000/");
  });

  test("un destino interno sí, para caer directo en la vista que se revisa", async () => {
    process.env.VISOR_TEST_MODE = "1";

    const respuesta = await GET(
      peticion("http://127.0.0.1:3000/api/modo-prueba?destino=/project/485"),
    );

    expect(respuesta.headers.get("location")).toBe("http://127.0.0.1:3000/project/485");
  });
});
