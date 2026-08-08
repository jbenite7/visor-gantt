import { calendarKeyOf, cellSignature, createMatrixCache } from "./matrixCache";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { ActivityRecipe, MatrixCell } from "@/types/matrix";

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

function firma(overrides: Partial<MatrixCell> = {}, startDate = "2026-03-02"): string {
  return cellSignature({
    cell: { ...celda, ...overrides },
    recipe: receta,
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
    ["la receta", { recipeId: "r2" } as Partial<MatrixCell>],
    ["la activación", { active: false } as Partial<MatrixCell>],
    ["la unidad", { unit: "ml" } as Partial<MatrixCell>],
    ["el rendimiento propio", { productivityOverridePerDay: 3 } as Partial<MatrixCell>],
    ["la ubicación", { areaId: "piso-2" } as Partial<MatrixCell>],
    ["el alcance", { scopeId: "acabados" } as Partial<MatrixCell>],
  ])("cambiar %s cambia la firma", (_nombre, overrides) => {
    expect(firma(overrides)).not.toBe(firma());
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

  test("cambiar la fecha de inicio del plan cambia la firma de todas las celdas", () => {
    expect(firma({}, "2026-04-01")).not.toBe(firma());
  });

  test("cambiar el calendario cambia la clave de calendario", () => {
    expect(calendarKeyOf()).not.toBe(
      calendarKeyOf({ ...DEFAULT_PROJECT_CALENDAR, workDays: [1, 2, 3, 4, 5] }),
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
