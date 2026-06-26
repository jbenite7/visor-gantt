import type { MatrixPlan, MatrixTemplate } from "@/types/matrix";

export const DEFAULT_MATRIX_TEMPLATE: MatrixTemplate = {
  id: "template-vivienda-vertical",
  name: "Vivienda vertical",
  projectType: "Edificacion",
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
    { id: "estructura", name: "Estructura", discipline: "Construccion" },
    { id: "arquitectura", name: "Arquitectura", discipline: "Construccion" },
    { id: "mep", name: "Redes MEP", discipline: "Instalaciones" },
  ],
  recipes: [
    {
      id: "estructura-concreto",
      name: "Estructura en concreto",
      activities: [
        {
          id: "formaleta",
          name: "Formaleta",
          productivityPerDay: 50,
          defaultQuantity: 100,
          unit: "m2",
        },
        {
          id: "acero",
          name: "Acero de refuerzo",
          productivityPerDay: 800,
          defaultQuantity: 1600,
          unit: "kg",
        },
        {
          id: "vaciado",
          name: "Vaciado de concreto",
          productivityPerDay: 40,
          defaultQuantity: 80,
          unit: "m3",
        },
      ],
      dependencies: [
        {
          predecessorActivityId: "formaleta",
          successorActivityId: "acero",
          type: "FS",
          lagDays: 0,
        },
        {
          predecessorActivityId: "acero",
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
    {
      id: "arquitectura-muros",
      name: "Muros y acabados base",
      activities: [
        {
          id: "mamposteria",
          name: "Mamposteria",
          productivityPerDay: 35,
          defaultQuantity: 140,
          unit: "m2",
        },
        {
          id: "panete",
          name: "Panete",
          productivityPerDay: 45,
          defaultQuantity: 140,
          unit: "m2",
        },
      ],
      dependencies: [
        {
          predecessorActivityId: "mamposteria",
          successorActivityId: "panete",
          type: "FS",
          lagDays: 1,
        },
      ],
      lineOfBalance: {
        scopeType: "Piso",
        offsetDays: 3,
      },
    },
    {
      id: "mep-rough-in",
      name: "Redes embebidas",
      activities: [
        {
          id: "trazado",
          name: "Trazado de redes",
          productivityPerDay: 120,
          defaultQuantity: 120,
          unit: "m",
        },
        {
          id: "instalacion",
          name: "Instalacion de redes",
          productivityPerDay: 80,
          defaultQuantity: 120,
          unit: "m",
        },
      ],
      dependencies: [
        {
          predecessorActivityId: "trazado",
          successorActivityId: "instalacion",
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
};

function defaultRecipeForArea(areaId: string): string {
  if (areaId === "estructura") return "estructura-concreto";
  if (areaId === "arquitectura") return "arquitectura-muros";
  return "mep-rough-in";
}

function activityOverridesForRecipe(recipeId: string) {
  const recipe = DEFAULT_MATRIX_TEMPLATE.recipes.find(
    (item) => item.id === recipeId,
  );
  const now = "2026-01-01T00:00:00.000Z";

  return (
    recipe?.activities.map((activity) => ({
      activityId: activity.id,
      quantity: activity.defaultQuantity ?? 1,
      unit: activity.unit,
      productivityPerDay: activity.productivityPerDay,
      lastEditedAt: now,
      lastEditedFrom: "matrix" as const,
    })) ?? []
  );
}

export function createDefaultMatrixPlan({
  id = `matrix-${Date.now()}`,
  name,
  startDate,
}: {
  id?: string;
  name: string;
  startDate: string;
}): MatrixPlan {
  const leafScopes =
    DEFAULT_MATRIX_TEMPLATE.scopeTree[0].children ??
    DEFAULT_MATRIX_TEMPLATE.scopeTree;

  return {
    id,
    name,
    templateId: DEFAULT_MATRIX_TEMPLATE.id,
    startDate,
    scopeTree: DEFAULT_MATRIX_TEMPLATE.scopeTree,
    areas: DEFAULT_MATRIX_TEMPLATE.areas,
    recipes: DEFAULT_MATRIX_TEMPLATE.recipes,
    cells: leafScopes.flatMap((scope) =>
      DEFAULT_MATRIX_TEMPLATE.areas.map((area) => {
        const recipeId = defaultRecipeForArea(area.id);
        return {
          id: `cell-${scope.id}-${area.id}`,
          scopeId: scope.id,
          areaId: area.id,
          recipeId,
          active: area.id !== "mep",
          activityOverrides: activityOverridesForRecipe(recipeId),
          lastEditedAt: "2026-01-01T00:00:00.000Z",
          lastEditedFrom: "matrix" as const,
        };
      }),
    ),
  };
}

export function createEmptyMatrixPlan({
  id = `matrix-${Date.now()}`,
  name,
  startDate,
}: {
  id?: string;
  name: string;
  startDate: string;
}): MatrixPlan {
  return {
    id,
    name,
    startDate,
    scopeTree: [],
    areas: [],
    recipes: DEFAULT_MATRIX_TEMPLATE.recipes,
    cells: [],
  };
}
