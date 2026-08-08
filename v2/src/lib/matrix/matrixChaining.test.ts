import { resolveChaining } from "./matrixChaining";
import type { ActivityRecipe, ScopeNode } from "@/types/matrix";

const receta: ActivityRecipe = {
  id: "r1",
  name: "Estructura",
  activities: [
    { id: "columnas", name: "Columnas", productivityPerDay: 1 },
    { id: "losa", name: "Losa", productivityPerDay: 1 },
  ],
  dependencies: [],
  locationChaining: { mode: "encadenado", lagDays: 1 },
};

const alcance: ScopeNode = { id: "estructura", name: "Estructura", type: "Disciplina" };

describe("resolveChaining", () => {
  test("por defecto las ubicaciones van en paralelo: es lo que hacía la matriz hasta hoy", () => {
    expect(resolveChaining(alcance, { ...receta, locationChaining: undefined })).toEqual({
      mode: "paralelo",
    });
  });

  test("la receta define el encadenado cuando el alcance no dice nada", () => {
    expect(resolveChaining(alcance, receta)).toEqual({
      mode: "encadenado",
      lagDays: 1,
    });
  });

  test("el alcance gana a la receta: es quien sabe si su oficio encadena", () => {
    const acabados: ScopeNode = {
      ...alcance,
      locationChaining: { mode: "paralelo" },
    };

    expect(resolveChaining(acabados, receta)).toEqual({ mode: "paralelo" });
  });

  test("sin alcance ni receta también va en paralelo, sin reventar", () => {
    expect(resolveChaining(undefined, undefined)).toEqual({ mode: "paralelo" });
  });

  test("conserva la actividad de enganche y el sentido invertido", () => {
    const alcanceInvertido: ScopeNode = {
      ...alcance,
      locationChaining: { mode: "encadenado", activityId: "losa", reverse: true },
    };

    expect(resolveChaining(alcanceInvertido, receta)).toEqual({
      mode: "encadenado",
      activityId: "losa",
      reverse: true,
    });
  });
});
