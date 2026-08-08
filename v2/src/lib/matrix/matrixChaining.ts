import type { ActivityRecipe, LocationChaining, ScopeNode } from "@/types/matrix";

/**
 * El encadenado que rige una celda.
 *
 * Orden: lo que diga el alcance, si no lo que diga la receta, y si ninguno
 * dice nada, paralelo — que es exactamente el comportamiento que la matriz
 * ha tenido hasta hoy, para que ningún plan guardado cambie de fechas.
 */
export function resolveChaining(
  scope: ScopeNode | undefined,
  recipe: ActivityRecipe | undefined,
): LocationChaining {
  return scope?.locationChaining ?? recipe?.locationChaining ?? { mode: "paralelo" };
}
