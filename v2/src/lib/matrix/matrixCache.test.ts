import { calendarKeyOf, cellSignature, createMatrixCache } from "./matrixCache";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { ActivityRecipe, AreaNode, MatrixCell, ScopeNode } from "@/types/matrix";

const receta: ActivityRecipe = {
  id: "r1",
  name: "Estructura",
  activities: [{ id: "columnas", name: "Columnas", productivityPerDay: 2, defaultQuantity: 6 }],
  dependencies: [],
};

const celda: MatrixCell = {
  id: "c1",
  scopeId: "estructura",
  areaId: "piso-1",
  recipeId: "r1",
  active: true,
  quantity: 10,
  unit: "m2",
};

const alcance: ScopeNode = {
  id: "estructura",
  name: "Estructura",
  type: "scope",
};

const ubicacion: AreaNode = {
  id: "piso-1",
  name: "Piso 1",
  type: "area",
};

function firma(
  overrides: Partial<MatrixCell> = {},
  startDate = "2026-03-02",
  scopeOverrides: Partial<ScopeNode> = {},
  areaOverrides: Partial<AreaNode> = {},
  scopeLeafIndexVal?: number,
  areaLeafIndexVal?: number,
): string {
  return cellSignature({
    cell: { ...celda, ...overrides },
    recipe: receta,
    scope: { ...alcance, ...scopeOverrides },
    area: { ...ubicacion, ...areaOverrides },
    scopeLeafIndex: scopeLeafIndexVal,
    areaLeafIndex: areaLeafIndexVal,
    startDate,
    calendarKey: calendarKeyOf(),
  });
}

describe("cellSignature", () => {
  test("la misma celda da la misma firma", () => {
    expect(firma()).toBe(firma());
  });

  test.each([
    ["la cantidad", { quantity: 11 } as Partial<MatrixCell>],
    ["la receta (id)", { recipeId: "r2" } as Partial<MatrixCell>],
    ["la activación", { active: false } as Partial<MatrixCell>],
    ["la unidad", { unit: "ml" } as Partial<MatrixCell>],
    ["el rendimiento propio", { productivityOverridePerDay: 3 } as Partial<MatrixCell>],
    ["la ubicación (id)", { areaId: "piso-2" } as Partial<MatrixCell>],
    ["el alcance (id)", { scopeId: "acabados" } as Partial<MatrixCell>],
  ])("cambiar %s cambia la firma", (_nombre, cellOverrides) => {
    expect(firma(cellOverrides)).not.toBe(firma());
  });

  test("cambiar una cantidad de actividad cambia la firma", () => {
    expect(
      firma({
        activityOverrides: [
          {
            activityId: "columnas",
            quantity: 99,
            lastEditedAt: "2026-03-02T00:00:00.000Z",
            lastEditedFrom: "matrix" as const,
          },
        ],
      }),
    ).not.toBe(firma());
  });

  test("cambiar el nombre del alcance cambia la firma", () => {
    expect(firma({}, "2026-03-02", { name: "Cimentación" })).not.toBe(firma());
  });

  test("cambiar el nombre de la ubicación cambia la firma", () => {
    expect(firma({}, "2026-03-02", {}, { name: "Piso 2" })).not.toBe(firma());
  });

  test("cambiar el encadenado de ubicación del alcance cambia la firma", () => {
    const scopeWithChaining: Partial<ScopeNode> = { locationChaining: "sequential" };
    expect(firma({}, "2026-03-02", scopeWithChaining)).not.toBe(firma());
  });

  test("cambiar el índice de orden del alcance cambia la firma", () => {
    expect(firma({}, "2026-03-02", {}, {}, 5)).not.toBe(firma());
  });

  test("cambiar el índice de orden de la ubicación cambia la firma", () => {
    expect(firma({}, "2026-03-02", {}, {}, undefined, 3)).not.toBe(firma());
  });

  test("cambiar activities de la receta (manteniendo id) cambia la firma", () => {
    const recetaModificada: ActivityRecipe = {
      ...receta,
      activities: [
        { id: "columnas", name: "Columnas", productivityPerDay: 2, defaultQuantity: 6 },
        { id: "vigas", name: "Vigas", productivityPerDay: 1.5, defaultQuantity: 4 },
      ],
    };

    expect(
      cellSignature({
        cell: celda,
        recipe: recetaModificada,
        scope: alcance,
        area: ubicacion,
        startDate: "2026-03-02",
        calendarKey: calendarKeyOf(),
      }),
    ).not.toBe(firma());
  });

  test("cambiar dependencies de la receta (manteniendo id) cambia la firma", () => {
    const recetaModificada: ActivityRecipe = {
      ...receta,
      dependencies: [{ source: "columnas", target: "vigas" }],
    };

    expect(
      cellSignature({
        cell: celda,
        recipe: recetaModificada,
        scope: alcance,
        area: ubicacion,
        startDate: "2026-03-02",
        calendarKey: calendarKeyOf(),
      }),
    ).not.toBe(firma());
  });

  test("cambiar locationChaining de la receta (manteniendo id) cambia la firma", () => {
    const recetaModificada: ActivityRecipe = {
      ...receta,
      locationChaining: "sequential",
    };

    expect(
      cellSignature({
        cell: celda,
        recipe: recetaModificada,
        scope: alcance,
        area: ubicacion,
        startDate: "2026-03-02",
        calendarKey: calendarKeyOf(),
      }),
    ).not.toBe(firma());
  });

  test("cambiar la fecha de inicio del plan cambia la firma de todas las celdas", () => {
    expect(firma({}, "2026-04-01")).not.toBe(firma());
  });

  test("cambiar el calendario cambia la clave de calendario", () => {
    expect(calendarKeyOf()).not.toBe(
      calendarKeyOf({ ...DEFAULT_PROJECT_CALENDAR, workDays: [1, 2, 3, 4, 5] }),
    );
  });

  test("agregar un festivo al calendario cambia la clave de calendario", () => {
    expect(calendarKeyOf()).not.toBe(
      calendarKeyOf({
        ...DEFAULT_PROJECT_CALENDAR,
        nonWorkingDays: [{ date: "2026-12-25", name: "Navidad" }],
      }),
    );
  });
});

describe("createMatrixCache", () => {
  test("nace vacía y con los contadores a cero", () => {
    const cache = createMatrixCache();

    expect(cache.signatures.size).toBe(0);
    expect(cache.hits).toBe(0);
    expect(cache.misses).toBe(0);
  });
});
