/**
 * Valla de regresión (A2): el autoguardado de proyectos debe seguir
 * escribiendo un único blob en `projects.project_data`, sin tocar
 * `project_snapshots` (las fotos del cronograma). Cada foto que se metiera
 * en este camino engordaría el autoguardado, que es justo lo que la
 * migración 001 existe para evitar. Si este test se pone en rojo, el motivo
 * casi seguro es que alguien coló una consulta a `project_snapshots` (o a
 * `schema_migrations`) dentro de `saveProject`: hay que sacarla de aquí y
 * moverla a `src/app/actions/snapshots.ts`, no borrar la valla.
 */
import type { ProjectData } from "./project";
import { createProjectDate } from "@/lib/date/projectDate";

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

import { saveProject } from "./project";

function proyecto(): ProjectData {
  return {
    id: "p1",
    name: "Estación 16",
    tasks: [],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [
      {
        id: "baseline-1",
        name: "Contractual",
        createdAt: createProjectDate("2026-01-05"),
        tasks: [],
      },
    ],
    calendar: {
      timeZone: "America/Bogota",
      workDays: [1, 2, 3, 4, 5],
      startHour: "08:00",
      endHour: "17:00",
      hoursPerDay: 8,
      nonWorkingDays: [],
      dateOverrides: [],
    },
  };
}

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [{ id: "p1" }] });
});

describe("saveProject no se entera de que las fotos existen (A2)", () => {
  test("guardar un proyecto no consulta project_snapshots", async () => {
    await saveProject(proyecto());

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).not.toContain("project_snapshots");
  });

  test("guardar un proyecto tampoco dispara el migrador", async () => {
    await saveProject(proyecto());

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).not.toContain("schema_migrations");
  });

  test("las líneas base siguen viajando dentro del blob", async () => {
    await saveProject(proyecto());

    const update = query.mock.calls.find((call) =>
      String(call[0]).includes("UPDATE projects"),
    );
    expect(update).toBeDefined();
    const blob = JSON.parse(String((update![1] as unknown[])[1]));
    expect(blob.baselines).toHaveLength(1);
    expect(blob.baselines[0].id).toBe("baseline-1");
  });
});
