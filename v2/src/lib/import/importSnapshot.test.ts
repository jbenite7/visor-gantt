import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";

const saveProjectSnapshot = jest.fn(async () => ({ success: true }));

jest.mock("@/app/actions/snapshots", () => ({
  saveProjectSnapshot: (...args: unknown[]) => saveProjectSnapshot(...(args as [])),
}));

import { captureImportSnapshot, importSnapshotName } from "./importSnapshot";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

beforeEach(() => {
  saveProjectSnapshot.mockClear();
  saveProjectSnapshot.mockResolvedValue({ success: true });
});

describe("importSnapshotName", () => {
  test("el nombre dice de qué archivo salió y de qué día", () => {
    expect(
      importSnapshotName("Estación 16 v7.mpp", createProjectDate("2026-02-05T00:00:00")),
    ).toBe("Importación de «Estación 16 v7» — 05/02/2026 00:00");
  });

  test("dos importaciones del mismo archivo el mismo día a horas distintas dan nombres distintos", () => {
    const manana = createProjectDate("2026-02-05T09:15:00");
    const tarde = createProjectDate("2026-02-05T16:40:00");

    const nombreManana = importSnapshotName("Estación 16 v7.mpp", manana);
    const nombreTarde = importSnapshotName("Estación 16 v7.mpp", tarde);

    expect(nombreManana).not.toBe(nombreTarde);
    expect(nombreManana).toBe("Importación de «Estación 16 v7» — 05/02/2026 09:15");
    expect(nombreTarde).toBe("Importación de «Estación 16 v7» — 05/02/2026 16:40");
  });
});

describe("captureImportSnapshot", () => {
  test("guarda una foto con origen importación y todas las tareas del archivo", async () => {
    const resultado = await captureImportSnapshot({
      projectId: "p1",
      tasks: [task({ id: 1 }), task({ id: 2 })],
      fileName: "Estación 16 v7.mpp",
      capturedAt: createProjectDate("2026-02-05"),
    });

    expect(resultado).toEqual({ captured: true });
    expect(saveProjectSnapshot).toHaveBeenCalledTimes(1);
    const foto = saveProjectSnapshot.mock.calls[0][0] as {
      projectId: string;
      origin: string;
      name: string;
      tasks: unknown[];
    };
    expect(foto.projectId).toBe("p1");
    expect(foto.origin).toBe("import");
    expect(foto.name).toContain("Estación 16 v7");
    expect(foto.tasks).toHaveLength(2);
  });

  test("un archivo sin tareas no deja foto: no hay nada que fotografiar", async () => {
    const resultado = await captureImportSnapshot({
      projectId: "p1",
      tasks: [],
      fileName: "vacío.mpp",
    });

    expect(resultado).toEqual({ captured: false });
    expect(saveProjectSnapshot).not.toHaveBeenCalled();
  });

  test("si la foto falla, la importación no se cae con ella", async () => {
    saveProjectSnapshot.mockResolvedValue({ success: false, error: "disco lleno" });

    await expect(
      captureImportSnapshot({
        projectId: "p1",
        tasks: [task({ id: 1 })],
        fileName: "Estación 16 v7.mpp",
      }),
    ).resolves.toEqual({ captured: false });
  });

  test("una excepción tampoco tumba la importación", async () => {
    saveProjectSnapshot.mockRejectedValue(new Error("sin conexión"));

    await expect(
      captureImportSnapshot({
        projectId: "p1",
        tasks: [task({ id: 1 })],
        fileName: "Estación 16 v7.mpp",
      }),
    ).resolves.toEqual({ captured: false });
  });
});
