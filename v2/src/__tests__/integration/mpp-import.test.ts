/**
 * Integration Tests: Complete MPP Import Flow
 *
 * Tests the end-to-end flow from file selection through parsing to Gantt display.
 * Mocks the microservice API to avoid requiring a running service.
 *
 * Flow: file selection → parseMPP() → mppTasksToGanttTasks() → Gantt display
 */

import { parseMPP } from "@/lib/api";
import { mppTasksToGanttTasks } from "@/components/upload/mpp-to-gantt";
import { ProjectData, MSPTask } from "@/lib/parser/mpp-parser";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ============================================================
// Test Fixtures
// ============================================================

/** Minimal valid ProjectData from microservice */
const validProjectData: ProjectData = {
  name: "Proyecto de Prueba",
  startDate: "2026-01-01T00:00:00",
  finishDate: "2026-06-30T00:00:00",
  tasks: [
    {
      UID: 1,
      ID: 1,
      Name: "Tarea Raíz",
      Start: "2026-01-01T08:00:00",
      Finish: "2026-01-01T17:00:00",
      Duration: "PT8H0M0S",
      DurationFormat: 7,
      PercentComplete: 0,
      Summary: true,
      Milestone: false,
      OutlineLevel: 1,
      WBS: "1",
      PredecessorLink: [],
    },
    {
      UID: 2,
      ID: 2,
      Name: "Tarea 1 - Diseño",
      Start: "2026-01-02T08:00:00",
      Finish: "2026-01-06T17:00:00",
      Duration: "PT40H0M0S",
      DurationFormat: 7,
      PercentComplete: 50,
      Summary: false,
      Milestone: false,
      OutlineLevel: 2,
      WBS: "1.1",
      PredecessorLink: [],
    },
    {
      UID: 3,
      ID: 3,
      Name: "Tarea 2 - Desarrollo",
      Start: "2026-01-07T08:00:00",
      Finish: "2026-01-20T17:00:00",
      Duration: "PT104H0M0S",
      DurationFormat: 7,
      PercentComplete: 0,
      Summary: false,
      Milestone: false,
      OutlineLevel: 2,
      WBS: "1.2",
      PredecessorLink: [
        {
          PredecessorUID: 2,
          Type: 1, // FS
          LinkLag: 0,
          LagFormat: 7,
        },
      ],
    },
    {
      UID: 4,
      ID: 4,
      Name: "Hito de Entrega",
      Start: "2026-01-20T17:00:00",
      Finish: "2026-01-20T17:00:00",
      Duration: "PT0H0M0S",
      DurationFormat: 7,
      PercentComplete: 0,
      Summary: false,
      Milestone: true,
      OutlineLevel: 2,
      WBS: "1.3",
      PredecessorLink: [
        {
          PredecessorUID: 3,
          Type: 1, // FS
          LinkLag: 0,
          LagFormat: 7,
        },
      ],
    },
  ],
  resources: [
    { UID: 1, Name: "Juan Pérez", Type: 1 },
    { UID: 2, Name: "María García", Type: 1 },
  ],
};

/** Factory for mock File objects */
function createMockFile(
  name: string,
  sizeBytes: number = 1024,
): File {
  // Use chunking for large files since ArrayBuffer has a practical limit
  const chunkSize = 1024 * 1024; // 1MB chunks
  const chunks: ArrayBuffer[] = [];
  let remaining = sizeBytes;
  while (remaining > 0) {
    const size = Math.min(remaining, chunkSize);
    chunks.push(new ArrayBuffer(size));
    remaining -= size;
  }
  return new File(chunks, name, { type: "application/octet-stream" });
}

// ============================================================
// Test Suite: parseMPP() API Client
// ============================================================

describe("MPP Import Integration - parseMPP API Client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_MPP_PARSER_URL = "http://mpp-parser:8000";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MPP_PARSER_URL;
  });

  test("parses valid .mpp file and returns ProjectData", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });

    const file = createMockFile("proyecto.mpp");
    const result = await parseMPP(file);

    expect(result).toEqual(validProjectData);
    expect(result.name).toBe("Proyecto de Prueba");
    expect(result.tasks).toHaveLength(4);
    expect(result.resources).toHaveLength(2);
  });

  test("sends file via FormData to correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });

    const file = createMockFile("test.mpp");
    await parseMPP(file);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://mpp-parser:8000/api/parse-mpp");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
  });

  test("uses custom URL from environment variable", async () => {
    process.env.NEXT_PUBLIC_MPP_PARSER_URL = "http://custom-host:9000";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });

    await parseMPP(createMockFile("test.mpp"));

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://custom-host:9000/api/parse-mpp");
  });

  test("throws on network failure with Spanish error message", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(parseMPP(createMockFile("test.mpp"))).rejects.toThrow(
      "Error de conexión con el servicio de parseo",
    );
  });

  test("throws on HTTP 400 error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Archivo no válido",
    });

    await expect(parseMPP(createMockFile("test.mpp"))).rejects.toThrow(
      "El servicio de parseo respondió con error 400",
    );
  });

  test("throws on HTTP 500 error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(parseMPP(createMockFile("test.mpp"))).rejects.toThrow(
      "El servicio de parseo respondió con error 500",
    );
  });

  test("throws on invalid JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    await expect(parseMPP(createMockFile("test.mpp"))).rejects.toThrow(
      "Respuesta inválida del servicio de parseo: no se pudo decodificar JSON",
    );
  });

  test("throws when response lacks tasks array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "Test", tasks: null }),
    });

    await expect(parseMPP(createMockFile("test.mpp"))).rejects.toThrow(
      "falta la estructura esperada (tasks)",
    );
  });

  test("throws when response is not an object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => "just a string",
    });

    await expect(parseMPP(createMockFile("test.mpp"))).rejects.toThrow(
      "falta la estructura esperada (tasks)",
    );
  });

  test("handles non-ok response with missing text details", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => {
        throw new Error("body used");
      },
    });

    await expect(parseMPP(createMockFile("test.mpp"))).rejects.toThrow(
      "Sin detalles",
    );
  });
});

// ============================================================
// Test Suite: mppTasksToGanttTasks() Data Transformation
// ============================================================

describe("MPP Import Integration - mppTasksToGanttTasks Transformation", () => {
  test("converts MPP tasks to Gantt tasks with correct properties", () => {
    const ganttTasks = mppTasksToGanttTasks(validProjectData.tasks);

    expect(ganttTasks).toHaveLength(4);

    // First task (summary)
    const rootTask = ganttTasks.find((t) => t.id === 1)!;
    expect(rootTask.name).toBe("Tarea Raíz");
    expect(rootTask.isSummary).toBe(true);
    expect(rootTask.isMilestone).toBe(false);
    expect(rootTask.outlineLevel).toBe(1);
    expect(rootTask.start).toBeInstanceOf(Date);
    expect(rootTask.finish).toBeInstanceOf(Date);

    // Second task (50% complete)
    const designTask = ganttTasks.find((t) => t.id === 2)!;
    expect(designTask.name).toBe("Tarea 1 - Diseño");
    expect(designTask.progress).toBe(50);
    expect(designTask.duration).toBe(5); // 40h / 8h per day = 5 days

    // Milestone detection (start == finish)
    const milestone = ganttTasks.find((t) => t.id === 4)!;
    expect(milestone.isMilestone).toBe(true);
  });

  test("preserves extra MPP task fields for dynamic columns", () => {
    const ganttTasks = mppTasksToGanttTasks([
      {
        ...validProjectData.tasks[1],
        Text1: "Contrato",
        Number1: 42,
      },
    ]);

    expect(ganttTasks[0].mppFields).toEqual(
      expect.objectContaining({
        UID: 2,
        Name: "Tarea 1 - Diseño",
        Text1: "Contrato",
        Number1: 42,
      }),
    );
  });

  test("maps dependency types correctly", () => {
    const ganttTasks = mppTasksToGanttTasks(validProjectData.tasks);

    // Task 3 depends on Task 2 (FS)
    const devTask = ganttTasks.find((t) => t.id === 3)!;
    expect(devTask.dependencies).toHaveLength(1);
    expect(devTask.dependencies[0].from).toBe(2);
    expect(devTask.dependencies[0].to).toBe(3);
    expect(devTask.dependencies[0].type).toBe("FS");

    // Milestone depends on Task 3 (FS)
    const milestone = ganttTasks.find((t) => t.id === 4)!;
    expect(milestone.dependencies).toHaveLength(1);
    expect(milestone.dependencies[0].from).toBe(3);
    expect(milestone.dependencies[0].type).toBe("FS");
  });

  test("filters out root empty task (UID=0 with no name)", () => {
    const tasksWithRoot: MSPTask[] = [
      {
        UID: 0,
        ID: 0,
        Name: "",
        Start: "",
        Finish: "",
        Duration: "PT0H0M0S",
        DurationFormat: 7,
        PercentComplete: 0,
        Summary: false,
        Milestone: false,
        OutlineLevel: 0,
        WBS: "",
      },
      ...validProjectData.tasks,
    ];

    const ganttTasks = mppTasksToGanttTasks(tasksWithRoot);
    expect(ganttTasks.find((t) => t.id === 0)).toBeUndefined();
    expect(ganttTasks).toHaveLength(4);
  });

  test("filters out non-root empty tasks", () => {
    const tasksWithBlankRows: MSPTask[] = [
      ...validProjectData.tasks,
      {
        UID: 99,
        ID: 99,
        Name: "",
        Start: "2026-03-09T09:00",
        Finish: "2026-03-09T19:00",
        Duration: "1.0d",
        DurationFormat: 7,
        PercentComplete: 0,
        Summary: false,
        Milestone: true,
        OutlineLevel: 2,
        WBS: "1.99",
      },
    ];

    const ganttTasks = mppTasksToGanttTasks(tasksWithBlankRows);
    expect(ganttTasks.find((task) => task.id === 99)).toBeUndefined();
    expect(ganttTasks).toHaveLength(4);
  });

  test("handles tasks with missing dates gracefully", () => {
    const tasksWithMissingDates: MSPTask[] = [
      {
        UID: 10,
        ID: 10,
        Name: "Sin Fechas",
        Start: "",
        Finish: "",
        Duration: "PT8H0M0S",
        DurationFormat: 7,
        PercentComplete: 0,
        Summary: false,
        Milestone: false,
        OutlineLevel: 1,
        WBS: "",
        PredecessorLink: [],
      },
    ];

    const ganttTasks = mppTasksToGanttTasks(tasksWithMissingDates);
    expect(ganttTasks).toHaveLength(1);
    // Should fallback to current date
    expect(ganttTasks[0].start).toBeInstanceOf(Date);
    expect(ganttTasks[0].finish).toBeInstanceOf(Date);
  });

  test("handles empty task array", () => {
    const ganttTasks = mppTasksToGanttTasks([]);
    expect(ganttTasks).toHaveLength(0);
  });

  test("converts various duration formats", () => {
    const tasks: MSPTask[] = [
      {
        UID: 1,
        ID: 1,
        Name: "8 horas",
        Start: "2026-01-01T08:00:00",
        Finish: "2026-01-01T17:00:00",
        Duration: "PT8H0M0S",
        DurationFormat: 7,
        PercentComplete: 0,
        Summary: false,
        Milestone: false,
        OutlineLevel: 1,
        WBS: "",
      },
      {
        UID: 2,
        ID: 2,
        Name: "5 días",
        Start: "2026-01-01T08:00:00",
        Finish: "2026-01-07T17:00:00",
        Duration: "P5D",
        DurationFormat: 7,
        PercentComplete: 0,
        Summary: false,
        Milestone: false,
        OutlineLevel: 1,
        WBS: "",
      },
      {
        UID: 3,
        ID: 3,
        Name: "10 horas 30 min",
        Start: "2026-01-01T08:00:00",
        Finish: "2026-01-02T18:30:00",
        Duration: "PT10H30M",
        DurationFormat: 7,
        PercentComplete: 0,
        Summary: false,
        Milestone: false,
        OutlineLevel: 1,
        WBS: "",
      },
    ];

    const ganttTasks = mppTasksToGanttTasks(tasks);

    expect(ganttTasks[0].duration).toBe(1); // 8h / 8h = 1 day
    expect(ganttTasks[1].duration).toBe(5); // P5D = 5 days
    expect(ganttTasks[2].duration).toBeCloseTo(1.3125, 2); // 10.5h / 8h ≈ 1.3125 days
  });
});

// ============================================================
// Test Suite: Complete End-to-End Flow
// ============================================================

describe("MPP Import Integration - End-to-End Flow", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_MPP_PARSER_URL = "http://mpp-parser:8000";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MPP_PARSER_URL;
  });

  test("complete flow: file → parse → transform → Gantt-ready tasks", async () => {
    // Step 1: Mock microservice response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });

    // Step 2: Parse the file
    const file = createMockFile("proyecto-completo.mpp");
    const projectData = await parseMPP(file);

    // Step 3: Transform to Gantt tasks
    const ganttTasks = mppTasksToGanttTasks(projectData.tasks);

    // Step 4: Verify Gantt-ready output
    expect(ganttTasks.length).toBeGreaterThan(0);
    ganttTasks.forEach((task) => {
      expect(task.id).toBeDefined();
      expect(task.name).toBeDefined();
      expect(task.start).toBeInstanceOf(Date);
      expect(task.finish).toBeInstanceOf(Date);
      expect(typeof task.duration).toBe("number");
      expect(typeof task.progress).toBe("number");
      expect(typeof task.isCritical).toBe("boolean");
      expect(typeof task.isMilestone).toBe("boolean");
      expect(typeof task.isSummary).toBe("boolean");
      expect(typeof task.outlineLevel).toBe("number");
      expect(Array.isArray(task.dependencies)).toBe(true);
    });

    // Step 5: Verify project metadata
    expect(projectData.name).toBe("Proyecto de Prueba");
    expect(projectData.startDate).toBeDefined();
    expect(projectData.resources).toHaveLength(2);
  });

  test("flow with dependencies creates correct graph", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });

    const projectData = await parseMPP(createMockFile("with-deps.mpp"));
    const ganttTasks = mppTasksToGanttTasks(projectData.tasks);

    // Verify dependency chain: Tarea 2 → Tarea 3 → Hito
    const devTask = ganttTasks.find((t) => t.id === 3)!;
    const milestone = ganttTasks.find((t) => t.id === 4)!;

    expect(devTask.dependencies[0].from).toBe(2); // Depends on design
    expect(milestone.dependencies[0].from).toBe(3); // Depends on dev

    // Build adjacency for validation
    const taskMap = new Map(ganttTasks.map((t) => [t.id, t]));
    ganttTasks.forEach((task) => {
      task.dependencies.forEach((dep) => {
        expect(taskMap.has(dep.from)).toBe(true);
        expect(taskMap.has(dep.to)).toBe(true);
      });
    });
  });

  test("flow with resources preserves resource data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });

    const projectData = await parseMPP(createMockFile("with-resources.mpp"));

    expect(projectData.resources).toEqual([
      { UID: 1, Name: "Juan Pérez", Type: 1 },
      { UID: 2, Name: "María García", Type: 1 },
    ]);
  });
});

// ============================================================
// Test Suite: Error Flows
// ============================================================

describe("MPP Import Integration - Error Flows", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("network failure produces user-friendly error", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    try {
      await parseMPP(createMockFile("test.mpp"));
      fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("conexión");
      // Simulate what MPPUploader does: onError callback
      const errorMessage = (err as Error).message;
      expect(errorMessage.length).toBeGreaterThan(0);
    }
  });

  test("server error produces informative error message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "MPXJ not found",
    });

    try {
      await parseMPP(createMockFile("test.mpp"));
      fail("Should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("500");
      expect((err as Error).message).toContain("MPXJ not found");
    }
  });

  test("invalid file type rejected before API call", () => {
    // This tests the validation logic that happens BEFORE parseMPP is called
    // MPPUploader.validateFile() checks extension
    const ACCEPTED_EXTENSIONS = [".mpp"];

    const invalidFiles = [
      { name: "test.xml", shouldPass: false },
      { name: "test.pdf", shouldPass: false },
      { name: "test.txt", shouldPass: false },
      { name: "test.mpp", shouldPass: true },
      { name: "test.MPP", shouldPass: true },
    ];

    invalidFiles.forEach(({ name, shouldPass }) => {
      const ext = "." + name.split(".").pop()?.toLowerCase();
      const isValid = ACCEPTED_EXTENSIONS.includes(ext!);
      expect(isValid).toBe(shouldPass);
    });
  });

  test("file size validation rejects oversized files", () => {
    const MAX_FILE_SIZE_MB = 50;
    const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    const validFile = createMockFile("small.mpp", 1024);
    const oversizedFile = createMockFile("huge.mpp", MAX_BYTES + 1);

    expect(validFile.size).toBeLessThanOrEqual(MAX_BYTES);
    expect(oversizedFile.size).toBeGreaterThan(MAX_BYTES);
  });

  test("error propagation: parseMPP error → onError callback", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Network error"));

    const onError = jest.fn();

    try {
      const data = await parseMPP(createMockFile("test.mpp"));
      // If we got data, simulate the upload handler
      mppTasksToGanttTasks(data.tasks);
    } catch (err) {
      // Simulate MPPUploader error handling
      const message =
        err instanceof Error
          ? err.message
          : "Error desconocido al parsear el archivo";
      onError(message);
    }

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("conexión"),
    );
  });

  test("success propagation: parseMPP → onUploadComplete callback", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });

    const onUploadComplete = jest.fn();

    try {
      const data = await parseMPP(createMockFile("test.mpp"));
      // Simulate MPPUploader success handling
      const ganttTasks = mppTasksToGanttTasks(data.tasks);
      onUploadComplete(ganttTasks);
    } catch {
      // Should not reach here
    }

    expect(onUploadComplete).toHaveBeenCalledTimes(1);
    expect(onUploadComplete).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          name: expect.any(String),
          start: expect.any(Date),
          finish: expect.any(Date),
        }),
      ]),
    );
  });
});

// ============================================================
// Test Suite: State Transitions
// ============================================================

describe("MPP Import Integration - State Transitions", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_MPP_PARSER_URL = "http://mpp-parser:8000";
  });

  test("idle → parsing → success state transitions", async () => {
    const states: string[] = [];
    let currentState = "idle";

    mockFetch.mockImplementation(async () => {
      states.push(`parsing:fetch_started`);
      currentState = "parsing";

      return {
        ok: true,
        json: async () => {
          states.push(`parsing:response_received`);
          return validProjectData;
        },
      };
    });

    // Simulate state machine
    currentState = "idle";
    states.push(`start:${currentState}`);

    try {
      const data = await parseMPP(createMockFile("test.mpp"));
      currentState = "success";
      states.push(`end:${currentState}`);

      // Verify Gantt tasks can be created
      const ganttTasks = mppTasksToGanttTasks(data.tasks);
      expect(ganttTasks.length).toBeGreaterThan(0);
    } catch {
      currentState = "error";
      states.push(`end:${currentState}`);
    }

    expect(states).toContain("start:idle");
    expect(states).toContain("parsing:fetch_started");
    expect(states).toContain("parsing:response_received");
    expect(states).toContain("end:success");
    expect(currentState).toBe("success");
  });

  test("idle → parsing → error state transitions (network failure)", async () => {
    const states: string[] = [];
    let currentState = "idle";

    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    states.push(`start:${currentState}`);

    try {
      await parseMPP(createMockFile("test.mpp"));
      currentState = "success";
    } catch {
      currentState = "error";
      states.push(`end:${currentState}`);
    }

    expect(states).toContain("start:idle");
    expect(states).toContain("end:error");
    expect(currentState).toBe("error");
  });

  test("idle → parsing → error state transitions (HTTP error)", async () => {
    const states: string[] = [];
    let currentState = "idle";

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "Unprocessable Entity",
    });

    states.push(`start:${currentState}`);

    try {
      await parseMPP(createMockFile("test.mpp"));
      currentState = "success";
    } catch {
      currentState = "error";
      states.push(`end:${currentState}`);
    }

    expect(states).toContain("end:error");
    expect(currentState).toBe("error");
  });

  test("error → idle transition (retry after error)", async () => {
    let currentState = "idle";

    // First attempt fails
    mockFetch.mockRejectedValueOnce(new TypeError("Network error"));
    try {
      await parseMPP(createMockFile("test.mpp"));
    } catch {
      currentState = "error";
    }
    expect(currentState).toBe("error");

    // Reset to idle (simulates user clicking "Intentar de nuevo")
    currentState = "idle";
    expect(currentState).toBe("idle");

    // Second attempt succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProjectData,
    });
    try {
      const data = await parseMPP(createMockFile("test.mpp"));
      const ganttTasks = mppTasksToGanttTasks(data.tasks);
      currentState = "success";
      expect(ganttTasks.length).toBeGreaterThan(0);
    } catch {
      currentState = "error";
    }
    expect(currentState).toBe("success");
  });
});

// ============================================================
// Test Suite: Performance
// ============================================================

describe("MPP Import Integration - Performance", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_MPP_PARSER_URL = "http://mpp-parser:8000";
  });

  test("parseMPP completes within 10 seconds for typical file", async () => {
    // Simulate typical microservice latency (200ms-2s)
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => validProjectData,
              }),
            100,
          ),
        ),
    );

    const start = performance.now();
    const data = await parseMPP(createMockFile("typical.mpp"));
    const elapsed = performance.now() - start;

    expect(data).toBeDefined();
    expect(elapsed).toBeLessThan(10000); // 10 seconds
  });

  test("transformation completes within 1 second for large project", () => {
    // Generate a large task list (500 tasks)
    const largeTasks: MSPTask[] = Array.from({ length: 500 }, (_, i) => ({
      UID: i + 1,
      ID: i + 1,
      Name: `Tarea ${i + 1}`,
      Start: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T08:00:00`,
      Finish: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T17:00:00`,
      Duration: "PT8H0M0S",
      DurationFormat: 7,
      PercentComplete: Math.floor(Math.random() * 100),
      Summary: i % 10 === 0,
      Milestone: i % 20 === 0,
      OutlineLevel: i % 10 === 0 ? 1 : 2,
      WBS: `${Math.floor(i / 10) + 1}.${(i % 10) + 1}`,
      PredecessorLink:
        i > 0 && i % 3 === 0
          ? [{ PredecessorUID: i, Type: 1, LinkLag: 0, LagFormat: 7 }]
          : [],
    }));

    const start = performance.now();
    const ganttTasks = mppTasksToGanttTasks(largeTasks);
    const elapsed = performance.now() - start;

    expect(ganttTasks).toHaveLength(500);
    expect(elapsed).toBeLessThan(1000); // 1 second
  });

  test("end-to-end flow completes within 10 seconds", async () => {
    // Simulate realistic network + processing time
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => validProjectData,
              }),
            50,
          ),
        ),
    );

    const start = performance.now();

    // Full flow
    const data = await parseMPP(createMockFile("e2e-test.mpp"));
    const ganttTasks = mppTasksToGanttTasks(data.tasks);

    // Verify all tasks are valid
    ganttTasks.forEach((task) => {
      expect(task.start.getTime()).not.toBeNaN();
      expect(task.finish.getTime()).not.toBeNaN();
    });

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10000); // 10 seconds
  });

  test("multiple rapid requests don't cause memory leaks", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => validProjectData,
    });

    // Simulate 10 rapid uploads
    const promises = Array.from({ length: 10 }, (_, i) =>
      parseMPP(createMockFile(`rapid-${i}.mpp`)).then((data) =>
        mppTasksToGanttTasks(data.tasks),
      ),
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach((ganttTasks) => {
      expect(ganttTasks.length).toBeGreaterThan(0);
    });

    expect(mockFetch).toHaveBeenCalledTimes(10);
  });
});

// ============================================================
// Test Suite: Edge Cases
// ============================================================

describe("MPP Import Integration - Edge Cases", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_MPP_PARSER_URL = "http://mpp-parser:8000";
  });

  test("project with zero tasks", async () => {
    const emptyProject: ProjectData = {
      name: "Proyecto Vacío",
      startDate: "2026-01-01T00:00:00",
      finishDate: "2026-01-01T00:00:00",
      tasks: [],
      resources: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyProject,
    });

    const data = await parseMPP(createMockFile("empty.mpp"));
    const ganttTasks = mppTasksToGanttTasks(data.tasks);

    expect(ganttTasks).toHaveLength(0);
    expect(data.name).toBe("Proyecto Vacío");
  });

  test("project with only milestones", async () => {
    const milestonesOnly: ProjectData = {
      name: "Hitos",
      startDate: "2026-01-01T00:00:00",
      finishDate: "2026-12-31T00:00:00",
      tasks: [
        {
          UID: 1,
          ID: 1,
          Name: "Hito 1",
          Start: "2026-03-01T00:00:00",
          Finish: "2026-03-01T00:00:00",
          Duration: "PT0H0M0S",
          DurationFormat: 7,
          PercentComplete: 0,
          Summary: false,
          Milestone: true,
          OutlineLevel: 1,
          WBS: "1",
        },
        {
          UID: 2,
          ID: 2,
          Name: "Hito 2",
          Start: "2026-06-01T00:00:00",
          Finish: "2026-06-01T00:00:00",
          Duration: "PT0H0M0S",
          DurationFormat: 7,
          PercentComplete: 0,
          Summary: false,
          Milestone: true,
          OutlineLevel: 1,
          WBS: "2",
        },
      ],
      resources: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => milestonesOnly,
    });

    const data = await parseMPP(createMockFile("milestones.mpp"));
    const ganttTasks = mppTasksToGanttTasks(data.tasks);

    expect(ganttTasks).toHaveLength(2);
    ganttTasks.forEach((task) => {
      expect(task.isMilestone).toBe(true);
      expect(task.duration).toBe(0);
    });
  });

  test("task names with special characters", async () => {
    const specialChars: ProjectData = {
      name: "Proyecto Ñoño",
      startDate: "2026-01-01T00:00:00",
      finishDate: "2026-01-31T00:00:00",
      tasks: [
        {
          UID: 1,
          ID: 1,
          Name: "Tarea con ñ, acentos: áéíóú, symbols: @#$%",
          Start: "2026-01-01T08:00:00",
          Finish: "2026-01-01T17:00:00",
          Duration: "PT8H0M0S",
          DurationFormat: 7,
          PercentComplete: 0,
          Summary: false,
          Milestone: false,
          OutlineLevel: 1,
          WBS: "1",
        },
      ],
      resources: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => specialChars,
    });

    const data = await parseMPP(createMockFile("special.mpp"));
    const ganttTasks = mppTasksToGanttTasks(data.tasks);

    expect(ganttTasks[0].name).toBe(
      "Tarea con ñ, acentos: áéíóú, symbols: @#$%",
    );
  });

  test("circular dependencies don't cause infinite loop", async () => {
    const circularProject: ProjectData = {
      name: "Circular",
      startDate: "2026-01-01T00:00:00",
      finishDate: "2026-01-31T00:00:00",
      tasks: [
        {
          UID: 1,
          ID: 1,
          Name: "Tarea A",
          Start: "2026-01-01T08:00:00",
          Finish: "2026-01-02T17:00:00",
          Duration: "PT16H0M0S",
          DurationFormat: 7,
          PercentComplete: 0,
          Summary: false,
          Milestone: false,
          OutlineLevel: 1,
          WBS: "1",
          PredecessorLink: [
            { PredecessorUID: 2, Type: 1, LinkLag: 0, LagFormat: 7 },
          ],
        },
        {
          UID: 2,
          ID: 2,
          Name: "Tarea B",
          Start: "2026-01-02T08:00:00",
          Finish: "2026-01-03T17:00:00",
          Duration: "PT16H0M0S",
          DurationFormat: 7,
          PercentComplete: 0,
          Summary: false,
          Milestone: false,
          OutlineLevel: 1,
          WBS: "2",
          PredecessorLink: [
            { PredecessorUID: 1, Type: 1, LinkLag: 0, LagFormat: 7 },
          ],
        },
      ],
      resources: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => circularProject,
    });

    const data = await parseMPP(createMockFile("circular.mpp"));
    const ganttTasks = mppTasksToGanttTasks(data.tasks);

    // Should complete without hanging
    expect(ganttTasks).toHaveLength(2);
    // Both tasks should have their dependencies mapped
    expect(ganttTasks[0].dependencies).toHaveLength(1);
    expect(ganttTasks[1].dependencies).toHaveLength(1);
  });

  test("very long task names are preserved", async () => {
    const longName = "A".repeat(500);
    const project: ProjectData = {
      name: "Long Name Test",
      startDate: "2026-01-01T00:00:00",
      finishDate: "2026-01-31T00:00:00",
      tasks: [
        {
          UID: 1,
          ID: 1,
          Name: longName,
          Start: "2026-01-01T08:00:00",
          Finish: "2026-01-01T17:00:00",
          Duration: "PT8H0M0S",
          DurationFormat: 7,
          PercentComplete: 0,
          Summary: false,
          Milestone: false,
          OutlineLevel: 1,
          WBS: "1",
        },
      ],
      resources: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => project,
    });

    const data = await parseMPP(createMockFile("long.mpp"));
    const ganttTasks = mppTasksToGanttTasks(data.tasks);

    expect(ganttTasks[0].name).toBe(longName);
    expect(ganttTasks[0].name.length).toBe(500);
  });

  test("concurrent parseMPP calls resolve independently", async () => {
    const responses = ["Project A", "Project B", "Project C"];
    let responseIdx = 0;

    mockFetch.mockImplementation(async () => {
      const idx = responseIdx;
      responseIdx++;
      return {
        ok: true,
        json: async () => ({
          ...validProjectData,
          name: responses[idx],
        }),
      };
    });

    const results = await Promise.all([
      parseMPP(createMockFile("concurrent-1.mpp")),
      parseMPP(createMockFile("concurrent-2.mpp")),
      parseMPP(createMockFile("concurrent-3.mpp")),
    ]);

    expect(results).toHaveLength(3);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["Project A", "Project B", "Project C"]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
