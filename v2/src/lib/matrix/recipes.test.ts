import {
  addRecipeActivity,
  moveRecipeActivity,
  removeRecipeActivity,
  removeRecipeDependency,
  setRecipeDependency,
} from "./recipes";
import type { ActivityRecipe } from "@/types/matrix";

function receta(): ActivityRecipe {
  return {
    id: "r1",
    name: "Estructura",
    activities: [
      { id: "columnas", name: "Columnas", productivityPerDay: 1 },
      { id: "losa", name: "Losa", productivityPerDay: 1 },
    ],
    dependencies: [
      { predecessorActivityId: "columnas", successorActivityId: "losa", type: "FS" },
    ],
  };
}

describe("addRecipeActivity", () => {
  test("añade al final por defecto", () => {
    const result = addRecipeActivity(receta(), {
      id: "acero",
      name: "Acero",
      productivityPerDay: 2,
    });

    expect(result.activities.map((item) => item.id)).toEqual([
      "columnas",
      "losa",
      "acero",
    ]);
  });

  test("añade en la posición indicada", () => {
    const result = addRecipeActivity(
      receta(),
      { id: "acero", name: "Acero", productivityPerDay: 2 },
      0,
    );

    expect(result.activities[0].id).toBe("acero");
  });

  test("no muta la receta recibida", () => {
    const original = receta();
    addRecipeActivity(original, { id: "acero", name: "Acero", productivityPerDay: 2 });

    expect(original.activities).toHaveLength(2);
  });
});

describe("removeRecipeActivity", () => {
  test("quita la actividad", () => {
    const result = removeRecipeActivity(receta(), "losa");

    expect(result.activities.map((item) => item.id)).toEqual(["columnas"]);
  });

  test("quita también sus dependencias, para no dejar vínculos huérfanos", () => {
    const result = removeRecipeActivity(receta(), "losa");

    expect(result.dependencies).toHaveLength(0);
  });

  test("quitar algo que no existe no cambia nada", () => {
    const result = removeRecipeActivity(receta(), "inexistente");

    expect(result.activities).toHaveLength(2);
    expect(result.dependencies).toHaveLength(1);
  });
});

describe("moveRecipeActivity", () => {
  test("reordena las actividades", () => {
    const result = moveRecipeActivity(receta(), "losa", 0);

    expect(result.activities.map((item) => item.id)).toEqual(["losa", "columnas"]);
  });

  test("un índice fuera de rango se ajusta al extremo", () => {
    const result = moveRecipeActivity(receta(), "columnas", 99);

    expect(result.activities.map((item) => item.id)).toEqual(["losa", "columnas"]);
  });
});

describe("setRecipeDependency", () => {
  test("añade un vínculo nuevo", () => {
    const conAcero = addRecipeActivity(receta(), {
      id: "acero",
      name: "Acero",
      productivityPerDay: 1,
    });
    const { recipe, rejectedReason } = setRecipeDependency(conAcero, {
      predecessorActivityId: "losa",
      successorActivityId: "acero",
      type: "FS",
    });

    expect(rejectedReason).toBeUndefined();
    expect(recipe.dependencies).toHaveLength(2);
  });

  test("reemplaza el vínculo existente entre las mismas actividades", () => {
    const { recipe } = setRecipeDependency(receta(), {
      predecessorActivityId: "columnas",
      successorActivityId: "losa",
      type: "SS",
      lagDays: 2,
    });

    expect(recipe.dependencies).toHaveLength(1);
    expect(recipe.dependencies[0].type).toBe("SS");
    expect(recipe.dependencies[0].lagDays).toBe(2);
  });

  test("rechaza que una actividad dependa de sí misma", () => {
    const { recipe, rejectedReason } = setRecipeDependency(receta(), {
      predecessorActivityId: "losa",
      successorActivityId: "losa",
      type: "FS",
    });

    expect(rejectedReason).toBe("Una actividad no puede depender de sí misma.");
    expect(recipe.dependencies).toHaveLength(1);
  });

  test("rechaza el ciclo directo: si A va antes que B, B no puede ir antes que A", () => {
    const { recipe, rejectedReason } = setRecipeDependency(receta(), {
      predecessorActivityId: "losa",
      successorActivityId: "columnas",
      type: "FS",
    });

    expect(rejectedReason).toBe(
      "«Columnas» ya va antes que «Losa»: el vínculo contrario dejaría la receta en círculo.",
    );
    expect(recipe.dependencies).toHaveLength(1);
  });

  test("rechaza un vínculo a una actividad que no está en la receta", () => {
    const { rejectedReason } = setRecipeDependency(receta(), {
      predecessorActivityId: "columnas",
      successorActivityId: "fantasma",
      type: "FS",
    });

    expect(rejectedReason).toBe("La actividad enlazada no está en esta receta.");
  });
});

describe("removeRecipeDependency", () => {
  test("quita el vínculo indicado", () => {
    const result = removeRecipeDependency(receta(), "columnas", "losa");

    expect(result.dependencies).toHaveLength(0);
  });
});
