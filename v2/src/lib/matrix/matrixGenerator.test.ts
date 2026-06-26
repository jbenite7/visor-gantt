import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import { recalculateSchedule } from "@/lib/scheduling/scheduleEngine";
import type { MatrixPlan } from "@/types/matrix";
import { createDefaultMatrixPlan } from "@/lib/matrix/templates";

const matrixPlan: MatrixPlan = {
  id: "matrix-1",
  name: "Torre vivienda",
  startDate: "2026-01-05",
  scopeTree: [
    {
      id: "torre-a",
      name: "Torre A",
      type: "Torre",
      children: [
        { id: "piso-1", name: "Piso 1", type: "Piso" },
        { id: "piso-2", name: "Piso 2", type: "Piso" },
      ],
    },
  ],
  areas: [
    {
      id: "estructura",
      name: "Estructura",
      discipline: "Construccion",
    },
  ],
  recipes: [
    {
      id: "concreto",
      name: "Concreto estructura",
      activities: [
        {
          id: "formaleta",
          name: "Formaleta",
          productivityPerDay: 50,
          defaultQuantity: 100,
        },
        {
          id: "vaciado",
          name: "Vaciado de concreto",
          productivityPerDay: 40,
          defaultQuantity: 80,
        },
      ],
      dependencies: [
        {
          predecessorActivityId: "formaleta",
          successorActivityId: "vaciado",
          type: "FS",
          lagDays: 0,
        },
      ],
      lineOfBalance: {
        scopeType: "Piso",
        offsetDays: 2,
      },
    },
  ],
  cells: [
    {
      id: "cell-p1-estructura",
      scopeId: "piso-1",
      areaId: "estructura",
      recipeId: "concreto",
      active: true,
      quantity: 100,
      unit: "m2",
    },
    {
      id: "cell-p2-estructura",
      scopeId: "piso-2",
      areaId: "estructura",
      recipeId: "concreto",
      active: true,
      quantity: 100,
      unit: "m2",
    },
  ],
};

describe("generateScheduleFromMatrix", () => {
  test("expands active scope-area cells into WBS summaries, tasks, durations, dependencies and LOB offsets", () => {
    const result = generateScheduleFromMatrix(matrixPlan);

    expect(result.issues).toEqual([]);
    expect(result.tasks.map((task) => task.name)).toEqual([
      "Torre A",
      "Piso 1",
      "Estructura",
      "Estructura - Formaleta - Piso 1",
      "Estructura - Vaciado de concreto - Piso 1",
      "Piso 2",
      "Estructura",
      "Estructura - Formaleta - Piso 2",
      "Estructura - Vaciado de concreto - Piso 2",
    ]);

    const piso1Formaleta = result.tasks.find(
      (task) => task.name === "Estructura - Formaleta - Piso 1",
    );
    const piso1Vaciado = result.tasks.find(
      (task) => task.name === "Estructura - Vaciado de concreto - Piso 1",
    );
    const piso2Formaleta = result.tasks.find(
      (task) => task.name === "Estructura - Formaleta - Piso 2",
    );

    expect(piso1Formaleta).toMatchObject({
      duration: 2,
      outlineLevel: 4,
      wbs: "1.1.1.1",
      matrixSource: {
        matrixPlanId: "matrix-1",
        scopeId: "piso-1",
        areaId: "estructura",
        cellId: "cell-p1-estructura",
        recipeId: "concreto",
        activityId: "formaleta",
      },
    });
    expect(piso1Formaleta?.start.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(piso1Formaleta?.finish.toISOString().slice(0, 10)).toBe("2026-01-06");
    expect(piso1Vaciado?.start.toISOString().slice(0, 10)).toBe("2026-01-07");
    expect(piso2Formaleta?.start.toISOString().slice(0, 10)).toBe("2026-01-07");

    expect(piso1Vaciado?.dependencies).toEqual([
      {
        from: piso1Formaleta?.id,
        to: piso1Vaciado.id,
        type: "FS",
        lag: 0,
      },
    ]);

    expect(result.provenance["cell-p1-estructura"]).toEqual([
      piso1Formaleta?.id,
      piso1Vaciado?.id,
    ]);
  });

  test("reports inactive cells and missing recipes without generating tasks for them", () => {
    const result = generateScheduleFromMatrix({
      ...matrixPlan,
      cells: [
        { ...matrixPlan.cells[0], active: false },
        { ...matrixPlan.cells[1], recipeId: "missing-recipe" },
      ],
    });

    expect(result.tasks).toHaveLength(0);
    expect(result.issues).toEqual([
      {
        severity: "medium",
        kind: "inactiveCell",
        cellId: "cell-p1-estructura",
        message: "La celda Piso 1 x Estructura esta inactiva.",
      },
      {
        severity: "high",
        kind: "missingRecipe",
        cellId: "cell-p2-estructura",
        message: "La celda Piso 2 x Estructura no tiene una receta valida.",
      },
    ]);
  });

  test("generates tasks accepted by the existing Gantt scheduling engine", () => {
    const generated = generateScheduleFromMatrix(
      createDefaultMatrixPlan({
        id: "matrix-schedule-engine",
        name: "Engine",
        startDate: "2026-01-05",
      }),
    );

    const recalculated = recalculateSchedule(generated.tasks);

    expect(recalculated.issues).toEqual([]);
    expect(recalculated.tasks.some((task) => task.matrixSource != null)).toBe(
      true,
    );
  });

  test("uses activity-level quantities and productivity overrides instead of global cell quantities", () => {
    const result = generateScheduleFromMatrix({
      ...matrixPlan,
      cells: [
        {
          ...matrixPlan.cells[0],
          quantity: 999,
          activityOverrides: [
            {
              activityId: "formaleta",
              quantity: 120,
              unit: "m2",
              productivityPerDay: 30,
              lastEditedAt: "2026-01-01T00:00:00.000Z",
              lastEditedFrom: "matrix",
            },
            {
              activityId: "vaciado",
              quantity: 45,
              unit: "m3",
              productivityPerDay: 15,
              lastEditedAt: "2026-01-01T00:00:00.000Z",
              lastEditedFrom: "matrix",
            },
          ],
        },
      ],
    });

    const formaleta = result.tasks.find(
      (task) => task.matrixSource?.activityId === "formaleta",
    );
    const vaciado = result.tasks.find(
      (task) => task.matrixSource?.activityId === "vaciado",
    );

    expect(formaleta).toMatchObject({
      duration: 4,
      matrixSync: {
        lastEditedAt: "2026-01-01T00:00:00.000Z",
        lastEditedFrom: "matrix",
      },
    });
    expect(vaciado).toMatchObject({ duration: 3 });
  });

  test("reports zero activity quantities as missing data instead of generating one-day tasks", () => {
    const result = generateScheduleFromMatrix({
      ...matrixPlan,
      cells: [
        {
          ...matrixPlan.cells[0],
          activityOverrides: [
            {
              activityId: "formaleta",
              quantity: 0,
              unit: "m2",
              productivityPerDay: 30,
              lastEditedAt: "2026-01-01T00:00:00.000Z",
              lastEditedFrom: "matrix",
            },
          ],
        },
      ],
    });

    expect(result.tasks.some((task) => task.matrixSource?.activityId === "formaleta")).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "high",
          kind: "missingQuantity",
          cellId: "cell-p1-estructura",
          message: "La actividad Formaleta no tiene cantidad para Piso 1 x Estructura.",
        }),
      ]),
    );
  });
});
