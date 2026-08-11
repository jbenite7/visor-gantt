/**
 * @jest-environment node
 */
const createSharedProject = jest.fn(async () => ({
  ok: true as const,
  token: "un-token-largo-de-verdad-0123456789",
  id: "7",
}));
jest.mock("@/lib/share/createSharedProject", () => ({
  createSharedProject: (...a: unknown[]) => createSharedProject(...a),
}));

const checkUploadAllowance = jest.fn(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}));
jest.mock("@/lib/share/uploadThrottle", () => ({
  checkUploadAllowance: (...a: unknown[]) => checkUploadAllowance(...a),
}));

jest.mock("@/lib/import/mpp-project", () => ({
  buildProjectDataFromMpp: () => ({ name: "Estación 16", tasks: [] }),
}));

import { POST } from "./route";

function peticion(file: File | null, ip = "1.2.3.4") {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return {
    formData: async () => formData,
    headers: new Headers({ "x-forwarded-for": ip }),
  } as unknown as Parameters<typeof POST>[0];
}

const mpp = () =>
  new File([new Uint8Array([1, 2, 3])], "obra.mpp", {
    type: "application/octet-stream",
  });

beforeEach(() => {
  jest.clearAllMocks();
  checkUploadAllowance.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  createSharedProject.mockResolvedValue({
    ok: true,
    token: "un-token-largo-de-verdad-0123456789",
    id: "7",
  });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ tasks: [] }),
  })) as unknown as typeof fetch;
});

/**
 * La puerta de entrada de E51: subir un `.mpp` **sin cuenta**.
 *
 * La ruta con sesión (`/api/import-mpp`) no se toca: su guard es correcto para
 * lo que hace. Esta es su hermana pública, y por eso lleva freno.
 */
describe("POST /api/ver-mpp", () => {
  test("devuelve un token cuando todo va bien", async () => {
    const res = await POST(peticion(mpp()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      token: expect.any(String),
    });
  });

  test("nunca exige sesión: es el punto de esta ruta", async () => {
    const res = await POST(peticion(mpp()));

    expect(res.status).not.toBe(401);
  });

  test("frena al sexto intento de la misma conexión y dice cuándo volver", async () => {
    checkUploadAllowance.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const res = await POST(peticion(mpp()));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  test("el freno se comprueba ANTES de analizar el archivo", async () => {
    checkUploadAllowance.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    await POST(peticion(mpp()));

    // Si se analizara igualmente, el freno no protegería al analizador, que es
    // justo lo que hay que proteger: tarda hasta tres minutos.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createSharedProject).not.toHaveBeenCalled();
  });

  test("rechaza lo que no es un .mpp", async () => {
    const res = await POST(
      peticion(new File(["x"], "hoja.xlsx", { type: "text/plain" })),
    );

    expect(res.status).toBe(400);
  });

  test("rechaza lo que pasa de 50 MB, sin materializarlo en memoria", async () => {
    const grande = mpp();
    Object.defineProperty(grande, "size", { value: 51 * 1024 * 1024 });

    const res = await POST(peticion(grande));

    expect(res.status).toBe(413);
  });

  test("sin archivo, lo dice", async () => {
    const res = await POST(peticion(null));

    expect(res.status).toBe(400);
  });
});
