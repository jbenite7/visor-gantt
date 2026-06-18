import { parseMPP } from "../mpp-client";
import type { ProjectData } from "@/lib/parser/mpp-parser";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockValidResponse: ProjectData = {
  name: "Proyecto de prueba",
  startDate: "2025-01-01",
  finishDate: "2025-12-31",
  tasks: [
    {
      UID: 1,
      ID: 1,
      Name: "Tarea 1",
      Start: "2025-01-01",
      Finish: "2025-01-15",
      Duration: "PT10D",
      DurationFormat: 7,
      PercentComplete: 50,
      Summary: false,
      Milestone: false,
      OutlineLevel: 1,
      WBS: "1",
    },
  ],
  resources: [
    { UID: 1, Name: "Recurso A", Type: 0 },
  ],
};

const mockFile = new File(["dummy mpp content"], "proyecto.mpp", {
  type: "application/octet-stream",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(response: Partial<Response>): jest.SpyInstance {
  return jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response as Response);
}

function mockFetchRejected(error: Error): jest.SpyInstance {
  return jest.spyOn(globalThis, "fetch").mockRejectedValue(error);
}

const okJsonResponse = (body: unknown): Partial<Response> => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

const errorResponse = (status: number, body: string): Partial<Response> => ({
  ok: false,
  status,
  text: () => Promise.resolve(body),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  jest.restoreAllMocks();
});

describe("parseMPP", () => {
  // --- Happy path ----------------------------------------------------------

  test("parses a valid .mpp file and returns ProjectData", async () => {
    mockFetch(okJsonResponse(mockValidResponse));

    const result = await parseMPP(mockFile);

    expect(result).toEqual(mockValidResponse);
    expect(result.name).toBe("Proyecto de prueba");
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].Name).toBe("Tarea 1");
    expect(result.resources).toHaveLength(1);
  });

  test("sends the file as FormData via POST", async () => {
    const fetchSpy = mockFetch(okJsonResponse(mockValidResponse));

    await parseMPP(mockFile);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/parse-mpp");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
  });

  // --- Network error -------------------------------------------------------

  test("throws on network failure", async () => {
    mockFetchRejected(new Error("Failed to fetch"));

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "Error de conexión con el servicio de parseo",
    );
  });

  test("throws on network failure with TypeError", async () => {
    mockFetchRejected(new TypeError("net::ERR_CONNECTION_REFUSED"));

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "net::ERR_CONNECTION_REFUSED",
    );
  });

  // --- Server errors -------------------------------------------------------

  test("throws on 400 Bad Request", async () => {
    mockFetch(errorResponse(400, "Invalid file format"));

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "El servicio de parseo respondió con error 400: Invalid file format",
    );
  });

  test("throws on 500 Internal Server Error", async () => {
    mockFetch(errorResponse(500, "Internal error"));

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "El servicio de parseo respondió con error 500: Internal error",
    );
  });

  test("handles error response without detail text", async () => {
    const response: Partial<Response> = {
      ok: false,
      status: 422,
      text: () => Promise.reject(new Error("stream error")),
    };
    jest.spyOn(globalThis, "fetch").mockResolvedValue(response as Response);

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "El servicio de parseo respondió con error 422: Sin detalles",
    );
  });

  // --- Invalid JSON --------------------------------------------------------

  test("throws when response is not valid JSON", async () => {
    const response: Partial<Response> = {
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    };
    jest.spyOn(globalThis, "fetch").mockResolvedValue(response as Response);

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "Respuesta inválida del servicio de parseo: no se pudo decodificar JSON",
    );
  });

  // --- Missing expected shape ----------------------------------------------

  test("throws when response lacks 'tasks' array", async () => {
    mockFetch(okJsonResponse({ name: "no tasks" }));

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "Respuesta inválida del servicio de parseo: falta la estructura esperada (tasks)",
    );
  });

  test("throws when response is null", async () => {
    mockFetch(okJsonResponse(null));

    await expect(parseMPP(mockFile)).rejects.toThrow(
      "Respuesta inválida del servicio de parseo: falta la estructura esperada (tasks)",
    );
  });

  // --- Environment variable for parser URL ---------------------------------

  test("uses NEXT_PUBLIC_MPP_PARSER_URL when set", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_MPP_PARSER_URL;
    process.env.NEXT_PUBLIC_MPP_PARSER_URL = "http://custom:9000";

    const fetchSpy = mockFetch(okJsonResponse(mockValidResponse));
    await parseMPP(mockFile);

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe("http://custom:9000/api/parse-mpp");

    process.env.NEXT_PUBLIC_MPP_PARSER_URL = originalUrl;
  });
});
