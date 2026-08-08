import {
  CALENDAR_SHIFT_THRESHOLD_DAYS,
  describeCalendarShift,
} from "./matrixCalendarShift";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { MatrixPlan } from "@/types/matrix";

function planLargo(): MatrixPlan {
  return {
    id: "plan-shift",
    name: "Torre",
    startDate: "2026-07-15",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "r1",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 30 },
        ],
        dependencies: [],
      },
    ],
    cells: [
      { id: "c1", scopeId: "estructura", areaId: "piso-1", recipeId: "r1", active: true },
    ],
  };
}

describe("describeCalendarShift", () => {
  test("un calendario que solo quita los domingos no desplaza nada", () => {
    const shift = describeCalendarShift(planLargo(), {
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5, 6],
    });

    expect(shift.maxShiftDays).toBe(0);
    expect(shift.exceedsThreshold).toBe(false);
    expect(shift.message).toBe(
      "Aplicar el calendario del proyecto no cambia las fechas de la matriz.",
    );
  });

  test("quitar los sábados de 30 días de trabajo desplaza más del umbral", () => {
    const shift = describeCalendarShift(planLargo(), {
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5],
    });

    expect(shift.maxShiftDays).toBeGreaterThan(CALENDAR_SHIFT_THRESHOLD_DAYS);
    expect(shift.exceedsThreshold).toBe(true);
    expect(shift.taskName).toContain("Columnas");
    expect(shift.message).toContain("días");
  });

  test("el umbral es de tres días, ni más ni menos", () => {
    expect(CALENDAR_SHIFT_THRESHOLD_DAYS).toBe(3);
  });
});
