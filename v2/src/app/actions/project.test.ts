import type { MatrixTemplate } from "@/types/matrix";

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
  listMatrixTemplates,
  saveMatrixTemplate,
} from "./project";

const template: MatrixTemplate = {
  id: "template-edificio",
  name: "Edificio",
  projectType: "Edificacion",
  scopeTree: [
    {
      id: "obra",
      name: "Obra",
      type: "Capitulo",
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
});
