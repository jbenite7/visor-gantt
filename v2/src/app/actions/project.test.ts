import type { MatrixPlan, MatrixTemplate } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";

const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect },
}));

jest.mock("@/lib/auth/session", () => ({
  getCurrentUser: jest.fn(async () => ({ id: "user-1", email: "aia@example.com" })),
}));

jest.mock("@/lib/auth/rbac", () => ({
  userHasPermission: jest.fn(async () => true),
}));

import {
  createMatrixPlanFromTemplate,
  loadProject,
  listMatrixTemplates,
  saveProject,
  saveMatrixTemplate,
} from "./project";
import {
  EMPTY_DETECTION_DICTIONARY,
  rememberCorrection,
} from "@/lib/scheduling/detection/dictionary";

const template: MatrixTemplate = {
  id: "template-edificio",
  name: "Edificio",
  projectType: "Edificacion",
  scopeTree: [
    {
      id: "obra",
      name: "Obra",
      type: "Capítulo",
      children: [
        {
          id: "zapatas",
          name: "Zapatas",
          type: "Partida",
          defaultRecipeId: "concreto",
        },
      ],
    },
  ],
  areas: [
    {
      id: "torre-a",
      name: "Torre A",
      type: "Torre",
      children: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    },
  ],
  recipes: [
    {
      id: "concreto",
      name: "Concreto",
      activities: [
        {
          id: "formaleta",
          name: "Formaleta",
          productivityPerDay: 50,
          defaultQuantity: 100,
          unit: "m2",
        },
      ],
      dependencies: [],
    },
  ],
};

const calendar: ProjectCalendar = {
  timeZone: "America/Bogota",
  workDays: [1, 2, 3, 4, 5],
  startHour: "08:00",
  endHour: "17:00",
  hoursPerDay: 8,
  nonWorkingDays: [],
  dateOverrides: [],
};

const importedMatrixPlan: MatrixPlan = {
  id: "matrix-mpp-demo",
  name: "Demo importado - Programacion matricial",
  templateId: "mpp-import",
  startDate: "2026-01-01",
  scopeTree: [
    {
      id: "mpp-scope-1",
      name: "Actividad importada",
      type: "Tarea MPP",
    },
  ],
  areas: [
    {
      id: "mpp-cronograma-importado",
      name: "Cronograma importado",
      type: "MPP",
    },
  ],
  recipes: [
    {
      id: "recipe-1",
      name: "Actividad importada",
      activities: [
        {
          id: "activity-1",
          name: "Actividad importada",
          productivityPerDay: 1,
          defaultQuantity: 2,
          unit: "d",
        },
      ],
      dependencies: [],
    },
  ],
  cells: [
    {
      id: "cell-1",
      scopeId: "mpp-scope-1",
      areaId: "mpp-cronograma-importado",
      recipeId: "recipe-1",
      active: true,
      generatedTaskIds: [1],
      syncedTaskIds: [1],
      activityOverrides: [
        {
          activityId: "activity-1",
          name: "Actividad importada",
          quantity: 2,
          unit: "d",
          productivityPerDay: 1,
          sourceTaskId: 1,
          start: "2026-01-01T00:00:00.000Z",
          finish: "2026-01-02T00:00:00.000Z",
          duration: 2,
          progress: 35.25,
          percentComplete: 35.25,
          lastEditedAt: "2026-01-01T00:00:00.000Z",
          lastEditedFrom: "gantt",
        },
      ],
    },
  ],
};

describe("matrix template actions", () => {
  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    connect.mockClear();
  });

  test("saves and lists reusable matrix templates as JSONB", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "template-edificio" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "template-edificio",
            name: "Edificio",
            project_type: "Edificacion",
            template_data: template,
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      });

    await expect(saveMatrixTemplate(template)).resolves.toEqual({
      success: true,
      id: "template-edificio",
    });
    await expect(listMatrixTemplates()).resolves.toEqual([
      {
        id: "template-edificio",
        name: "Edificio",
        projectType: "Edificacion",
        template,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    expect(query.mock.calls[1][0]).toContain("INSERT INTO matrix_templates");
    expect(query.mock.calls[1][1][3]).toBe(JSON.stringify(template));
  });

  test("materializes a template into an independent project matrix plan", async () => {
    const plan = await createMatrixPlanFromTemplate({
      template,
      id: "matrix-from-template",
      name: "Proyecto desde plantilla",
      startDate: "2026-02-02",
    });

    expect(plan).toMatchObject({
      id: "matrix-from-template",
      name: "Proyecto desde plantilla",
      templateId: "template-edificio",
      startDate: "2026-02-02",
    });
    expect(plan).not.toBe(template);
    expect(plan.scopeTree).not.toBe(template.scopeTree);
    expect(plan.cells).toEqual([
      expect.objectContaining({
        scopeId: "zapatas",
        areaId: "piso-1",
        recipeId: "concreto",
        active: false,
      }),
    ]);
  });

  test("persists and reloads imported matrix plan links through project_data", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "project-1" }] });

    const saveResult = await saveProject({
      name: "Importado",
      tasks: [
        {
          id: 1,
          name: "Actividad importada",
          start: new Date("2026-01-01T00:00:00.000Z"),
          finish: new Date("2026-01-02T00:00:00.000Z"),
          duration: 2,
          progress: 35.25,
          percentComplete: 35.25,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
          wbs: "1",
          matrixSource: {
            matrixPlanId: "matrix-mpp-demo",
            scopeId: "mpp-scope-1",
            areaId: "mpp-cronograma-importado",
            cellId: "cell-1",
            recipeId: "recipe-1",
            activityId: "activity-1",
          },
        },
      ],
      resources: [],
      assignments: [],
      budgetItems: [],
      budgetMappings: [],
      baselines: [],
      calendar,
      matrixPlan: importedMatrixPlan,
      planningAuditEvents: [
        {
          id: "audit-1",
          kind: "taskEdit",
          summary: "Update duration on task 1",
          taskIds: [1],
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const serializedProject = JSON.parse(query.mock.calls[0][1][1]);
    query.mockResolvedValueOnce({
      rows: [
        {
          name: "Importado",
          project_data: serializedProject,
        },
      ],
    });
    const loaded = await loadProject("project-1");

    expect(saveResult).toEqual({ success: true, id: "project-1" });
    expect(query.mock.calls[0][0]).toContain("INSERT INTO projects");
    expect(query.mock.calls[1][0]).toContain("SELECT name, project_data");
    expect(loaded?.matrixPlan).toEqual(importedMatrixPlan);
    expect(loaded?.planningAuditEvents).toEqual([
      {
        id: "audit-1",
        kind: "taskEdit",
        summary: "Update duration on task 1",
        taskIds: [1],
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    expect(loaded?.tasks[0]).toEqual(
      expect.objectContaining({
        id: 1,
        start: new Date("2026-01-01T00:00:00.000Z"),
        finish: new Date("2026-01-02T00:00:00.000Z"),
        matrixSource: expect.objectContaining({
          matrixPlanId: "matrix-mpp-demo",
          cellId: "cell-1",
        }),
      }),
    );
  });
});

describe("ProjectData · el diccionario de correcciones viaja con el proyecto (R4)", () => {
  beforeEach(() => {
    query.mockReset();
  });

  function proyectoBase() {
    return {
      name: "Estación 16",
      tasks: [],
      resources: [],
      assignments: [],
      budgetItems: [],
      budgetMappings: [],
      baselines: [],
      calendar,
    };
  }

  test("una corrección guardada sobrevive al viaje de ida y vuelta", async () => {
    const dictionary = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "ubicacion",
      name: "Instalación de redes secas",
      value: "4",
      note: "Va en el piso 4, no en obra general",
      recordedAt: "2026-08-08T10:00:00.000Z",
    });

    query.mockResolvedValueOnce({ rows: [{ id: "project-1" }] });
    await saveProject({ ...proyectoBase(), detectionDictionary: dictionary });

    const serializado = JSON.parse(query.mock.calls[0][1][1]);
    expect(serializado.detectionDictionary.corrections).toHaveLength(1);
    expect(serializado.detectionDictionary.corrections[0].value).toBe("4");

    query.mockResolvedValueOnce({
      rows: [{ name: "Estación 16", project_data: serializado }],
    });
    const cargado = await loadProject("project-1");

    expect(cargado?.detectionDictionary).toEqual(dictionary);
  });

  test("un proyecto viejo sin diccionario se lee como diccionario vacío", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "project-2" }] });
    await saveProject(proyectoBase());

    const serializado = JSON.parse(query.mock.calls[0][1][1]);
    delete (serializado as { detectionDictionary?: unknown }).detectionDictionary;

    query.mockResolvedValueOnce({
      rows: [{ name: "Antiguo", project_data: serializado }],
    });
    const cargado = await loadProject("project-2");

    expect(cargado?.detectionDictionary).toEqual(EMPTY_DETECTION_DICTIONARY);
  });
});
