import type {
  ActivityDependencyRule,
  ActivityRecipe,
  ActivityRecipeItem,
} from "@/types/matrix";

/**
 * Operaciones del editor de recetas, puras y sin interfaz.
 *
 * Dos reglas viven aquí y no en la pantalla, porque son del dato:
 * quitar una actividad quita sus vínculos —si no, `generateScheduleFromMatrix`
 * los descarta en silencio— y un vínculo no puede cerrar un círculo.
 */
export function addRecipeActivity(
  recipe: ActivityRecipe,
  activity: ActivityRecipeItem,
  atIndex?: number,
): ActivityRecipe {
  const activities = [...recipe.activities];
  const index = atIndex ?? activities.length;
  activities.splice(Math.max(0, Math.min(index, activities.length)), 0, activity);
  return { ...recipe, activities };
}

export function removeRecipeActivity(
  recipe: ActivityRecipe,
  activityId: string,
): ActivityRecipe {
  return {
    ...recipe,
    activities: recipe.activities.filter((activity) => activity.id !== activityId),
    dependencies: recipe.dependencies.filter(
      (rule) =>
        rule.predecessorActivityId !== activityId &&
        rule.successorActivityId !== activityId,
    ),
  };
}

export function moveRecipeActivity(
  recipe: ActivityRecipe,
  activityId: string,
  toIndex: number,
): ActivityRecipe {
  const from = recipe.activities.findIndex((activity) => activity.id === activityId);
  if (from === -1) return recipe;

  const activities = [...recipe.activities];
  const [moved] = activities.splice(from, 1);
  activities.splice(Math.max(0, Math.min(toIndex, activities.length)), 0, moved);
  return { ...recipe, activities };
}

export interface SetDependencyResult {
  recipe: ActivityRecipe;
  /** Frase en lenguaje de obra cuando el vínculo no se acepta. */
  rejectedReason?: string;
}

export function setRecipeDependency(
  recipe: ActivityRecipe,
  rule: ActivityDependencyRule,
): SetDependencyResult {
  if (rule.predecessorActivityId === rule.successorActivityId) {
    return { recipe, rejectedReason: "Una actividad no puede depender de sí misma." };
  }

  const nameOf = (id: string) =>
    recipe.activities.find((activity) => activity.id === id)?.name;
  const predecessorName = nameOf(rule.predecessorActivityId);
  const successorName = nameOf(rule.successorActivityId);

  if (!predecessorName || !successorName) {
    return { recipe, rejectedReason: "La actividad enlazada no está en esta receta." };
  }

  const inverse = recipe.dependencies.find(
    (item) =>
      item.predecessorActivityId === rule.successorActivityId &&
      item.successorActivityId === rule.predecessorActivityId,
  );
  if (inverse) {
    return {
      recipe,
      rejectedReason: `«${successorName}» ya va antes que «${predecessorName}»: el vínculo contrario dejaría la receta en círculo.`,
    };
  }

  const dependencies = recipe.dependencies.filter(
    (item) =>
      !(
        item.predecessorActivityId === rule.predecessorActivityId &&
        item.successorActivityId === rule.successorActivityId
      ),
  );

  return { recipe: { ...recipe, dependencies: [...dependencies, rule] } };
}

export function removeRecipeDependency(
  recipe: ActivityRecipe,
  predecessorActivityId: string,
  successorActivityId: string,
): ActivityRecipe {
  return {
    ...recipe,
    dependencies: recipe.dependencies.filter(
      (rule) =>
        !(
          rule.predecessorActivityId === predecessorActivityId &&
          rule.successorActivityId === successorActivityId
        ),
    ),
  };
}
