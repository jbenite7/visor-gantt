import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import { generateScheduleFromMatrix as generarPlan } from "@/lib/matrix/matrixGenerator";
import { recalculateSchedule } from "@/lib/scheduling/scheduleEngine";
import type { MatrixPlan } from "@/types/matrix";
import { DEFAULT_MATRIX_TEMPLATE, createDefaultMatrixPlan } from "@/lib/matrix/templates";

const matrixPlan: MatrixPlan = {
  id: "matrix-1",
  name: "Torre vivienda",
  startDate: "2026-01-05",
  scopeTree: [
    {
      id: "construccion",
      name: "Construccion",
      type: "Capitulo",
      children: [
        { id: "estructura", name: "Estructura", type: "Disciplina" },
      ],
    },
  ],
  areas: [
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
      id: "cell-estructura-p1",
      scopeId: "estructura",
      areaId: "piso-1",
      recipeId: "concreto",
      active: true,
      quantity: 100,
      unit: "m2",
    },
    {
      id: "cell-estructura-p2",
      scopeId: "estructura",
      areaId: "piso-2",
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
      "Construccion",
      "Estructura",
      "Torre A",
      "Piso 1",
      "Estructura - Formaleta - Piso 1",
      "Estructura - Vaciado de concreto - Piso 1",
      "Piso 2",
      "Estructura - Formaleta - Piso 2",
      "Estructura - Vaciado de concreto - Piso 2",
    ]);
    expect(result.tasks.map((task) => task.mppFields?.UNIQUE_ID)).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
    ]);
    expect(
      result.tasks.every((task) => Number.isInteger(task.mppFields?.UNIQUE_ID)),
    ).toBe(true);

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
      outlineLevel: 5,
      wbs: "1.1.1.1.1",
      matrixSource: {
        matrixPlanId: "matrix-1",
        scopeId: "estructura",
        areaId: "piso-1",
        cellId: "cell-estructura-p1",
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

    expect(result.provenance["cell-estructura-p1"]).toEqual([
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
        cellId: "cell-estructura-p1",
        message: "La celda Estructura × Piso 1 esta inactiva.",
      },
      {
        severity: "high",
        kind: "missingRecipe",
        cellId: "cell-estructura-p2",
        message: "La celda Estructura × Piso 2 no tiene una receta valida.",
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
          cellId: "cell-estructura-p1",
          message: "La actividad Formaleta no tiene cantidad para Estructura × Piso 1.",
        }),
      ]),
    );
  });

  test("uses the leaf scope default recipe and ignores parent cells", () => {
    const result = generateScheduleFromMatrix({
      ...matrixPlan,
      scopeTree: [
        {
          id: "construccion",
          name: "Construccion",
          type: "Capitulo",
          children: [
            {
              id: "estructura",
              name: "Estructura",
              type: "Disciplina",
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
        },
      ],
      cells: [
        {
          id: "cell-parent",
          scopeId: "estructura",
          areaId: "piso-1",
          recipeId: "concreto",
          active: true,
          quantity: 100,
        },
        {
          id: "cell-leaf",
          scopeId: "zapatas",
          areaId: "piso-1",
          active: true,
          quantity: 100,
        },
      ],
    });

    expect(result.issues).toEqual([]);
    expect(result.tasks.map((task) => task.name)).toContain(
      "Zapatas - Formaleta - Piso 1",
    );
    expect(result.tasks.map((task) => task.name)).not.toContain(
      "Estructura - Formaleta - Piso 1",
    );
    expect(result.provenance["cell-leaf"]).toHaveLength(2);
    expect(result.provenance["cell-parent"]).toBeUndefined();
  });

  test("generates a 10-floor building from three active base scopes", () => {
    const scopeTree = [
      {
        id: "estructura",
        name: "Estructura",
        type: "Disciplina",
        defaultRecipeId: "estructura-concreto",
      },
      {
        id: "arquitectura",
        name: "Arquitectura",
        type: "Disciplina",
        defaultRecipeId: "arquitectura-muros",
      },
      {
        id: "redes-mep",
        name: "Redes MEP",
        type: "Disciplina",
        defaultRecipeId: "mep-rough-in",
      },
    ];
    const areas = Array.from({ length: 10 }, (_, index) => ({
      id: `piso-${index + 1}`,
      name: `Piso ${index + 1}`,
      type: "Piso",
    }));
    const plan: MatrixPlan = {
      id: "matrix-edificio-10-pisos",
      name: "Edificio 10 pisos",
      startDate: "2026-01-05",
      scopeTree,
      areas,
      recipes: DEFAULT_MATRIX_TEMPLATE.recipes,
      cells: scopeTree.flatMap((scope) =>
        areas.map((area) => ({
          id: `cell-${scope.id}-${area.id}`,
          scopeId: scope.id,
          areaId: area.id,
          recipeId: scope.defaultRecipeId,
          active: true,
          lastEditedAt: "2026-01-01T00:00:00.000Z",
          lastEditedFrom: "matrix" as const,
        })),
      ),
    };

    const result = generateScheduleFromMatrix(plan);

    expect(plan.cells).toHaveLength(30);
    expect(result.issues).toEqual([]);
    expect(result.tasks.filter((task) => task.matrixSource && !task.isSummary)).toHaveLength(70);
    expect(result.dependencies).toHaveLength(40);
    expect(result.tasks.map((task) => task.name)).toEqual(
      expect.arrayContaining([
        "Estructura - Vaciado de concreto - Piso 10",
        "Arquitectura - Panete - Piso 10",
        "Redes MEP - Instalacion de redes - Piso 10",
      ]),
    );
    expect(result.provenance["cell-redes-mep-piso-10"]).toHaveLength(2);
  });
});

import { generateScheduleFromMatrix as generar } from "./matrixGenerator";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { MatrixPlan } from "@/types/matrix";

function planDeUnaCelda(): MatrixPlan {
  return {
    id: "plan-cal",
    name: "Torre con festivos",
    startDate: "2026-07-15",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "receta-estructura",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 5 },
        ],
        dependencies: [],
      },
    ],
    cells: [
      {
        id: "celda-1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "receta-estructura",
        active: true,
      },
    ],
  };
}

describe("generateScheduleFromMatrix · calendario del proyecto", () => {
  test("sin calendario las fechas no cambian respecto a lo de siempre", () => {
    const { tasks } = generar(planDeUnaCelda());
    const columnas = tasks.find((task) => !task.isSummary)!;

    // Miércoles 15 + 5 días saltando solo el domingo → lunes 20
    expect(columnas.finish.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  test("con el calendario del proyecto respeta el fin de semana y el festivo", () => {
    const { tasks } = generar(planDeUnaCelda(), {
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        workDays: [1, 2, 3, 4, 5],
        nonWorkingDays: [
          { id: "f1", date: "2026-07-20", name: "Día de la Independencia" },
        ],
      },
    });
    const columnas = tasks.find((task) => !task.isSummary)!;

    // 15, 16, 17, 21, 22 → termina el miércoles 22
    expect(columnas.finish.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
});

function planDeTresPisos(chaining: MatrixPlan["recipes"][number]["locationChaining"]): MatrixPlan {
  return {
    id: "plan-cadena",
    name: "Torre de tres pisos",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [
      { id: "piso-1", name: "Piso 1", type: "Piso" },
      { id: "piso-2", name: "Piso 2", type: "Piso" },
      { id: "piso-3", name: "Piso 3", type: "Piso" },
    ],
    recipes: [
      {
        id: "r1",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 3 },
          { id: "losa", name: "Losa", productivityPerDay: 1, defaultQuantity: 4 },
        ],
        dependencies: [
          { predecessorActivityId: "columnas", successorActivityId: "losa", type: "FS" },
        ],
        locationChaining: chaining,
      },
    ],
    cells: ["piso-1", "piso-2", "piso-3"].map((areaId) => ({
      id: `celda-${areaId}`,
      scopeId: "estructura",
      areaId,
      recipeId: "r1",
      active: true,
    })),
  };
}

describe("generateScheduleFromMatrix · ritmo piso a piso", () => {
  test("en paralelo no hay vínculo entre pisos: es lo de siempre", () => {
    const { dependencies } = generarPlan(planDeTresPisos({ mode: "paralelo" }));
    const entrePisos = dependencies.filter(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(entrePisos).toHaveLength(0);
  });

  test("encadenado vincula cada actividad con la misma del piso siguiente", () => {
    const { dependencies } = generarPlan(planDeTresPisos({ mode: "encadenado" }));
    const columnas12 = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.from).includes("columnas") &&
        String(dependency.to).includes("piso-2") &&
        String(dependency.to).includes("columnas"),
    );

    expect(columnas12).toBeDefined();
    expect(columnas12?.type).toBe("FS");
  });

  test("la cadena llega hasta el último piso", () => {
    const { dependencies } = generarPlan(planDeTresPisos({ mode: "encadenado" }));
    const losa23 = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-2") &&
        String(dependency.from).includes("losa") &&
        String(dependency.to).includes("piso-3") &&
        String(dependency.to).includes("losa"),
    );

    expect(losa23).toBeDefined();
  });

  test("con actividad de enganche solo esa actividad encadena", () => {
    const { dependencies } = generarPlan(
      planDeTresPisos({ mode: "encadenado", activityId: "losa" }),
    );
    const columnas12 = dependencies.filter(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.from).includes("columnas") &&
        String(dependency.to).includes("piso-2"),
    );
    const losa12 = dependencies.filter(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.from).includes("losa") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(columnas12).toHaveLength(0);
    expect(losa12).toHaveLength(1);
  });

  test("el desfase entre pisos se guarda en el vínculo", () => {
    const { dependencies } = generarPlan(
      planDeTresPisos({ mode: "encadenado", lagDays: 2 }),
    );
    const primera = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(primera?.lag).toBe(2);
  });

  test("invertido encadena de arriba abajo", () => {
    const { dependencies } = generarPlan(
      planDeTresPisos({ mode: "encadenado", reverse: true }),
    );
    const desdeElTercero = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-3") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(desdeElTercero).toBeDefined();
  });

  test("la tarea sucesora recibe el vínculo en su lista de dependencias", () => {
    const { tasks, dependencies } = generarPlan(planDeTresPisos({ mode: "encadenado" }));
    const primera = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.to).includes("piso-2"),
    )!;
    const sucesora = tasks.find((task) => task.id === primera.to)!;

    expect(sucesora.dependencies.some((item) => item.from === primera.from)).toBe(true);
  });
});
