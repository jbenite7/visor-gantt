import {
  FACTORY_TEMPLATES,
  listFactoryTemplates,
  templateFromPlan,
} from "./templateCatalog";
import { DEFAULT_MATRIX_TEMPLATE } from "./templates";
import type { MatrixPlan } from "@/types/matrix";

describe("catálogo de plantillas de fábrica", () => {
  test("incluye la de vivienda vertical que ya existía", () => {
    expect(FACTORY_TEMPLATES.map((template) => template.id)).toContain(
      DEFAULT_MATRIX_TEMPLATE.id,
    );
  });

  test("hay una plantilla por tipo de obra, no una sola", () => {
    expect(FACTORY_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(FACTORY_TEMPLATES.map((template) => template.projectType)).size)
      .toBeGreaterThanOrEqual(3);
  });

  test("todas tienen alcances, ubicaciones y recetas: ninguna en blanco", () => {
    for (const template of FACTORY_TEMPLATES) {
      expect(template.scopeTree.length).toBeGreaterThan(0);
      expect(template.areas.length).toBeGreaterThan(0);
      expect(template.recipes.length).toBeGreaterThan(0);
    }
  });

  test("todos los identificadores son distintos", () => {
    const ids = FACTORY_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("cada alcance apunta a una receta que existe en su plantilla", () => {
    for (const template of FACTORY_TEMPLATES) {
      const recipeIds = new Set(template.recipes.map((recipe) => recipe.id));
      const walk = (nodes: typeof template.scopeTree) => {
        for (const node of nodes) {
          if (node.defaultRecipeId) expect(recipeIds.has(node.defaultRecipeId)).toBe(true);
          if (node.children) walk(node.children);
        }
      };
      walk(template.scopeTree);
    }
  });

  test("listFactoryTemplates devuelve una copia: nadie puede alterar el catálogo", () => {
    const lista = listFactoryTemplates();
    lista.pop();

    expect(listFactoryTemplates()).toHaveLength(FACTORY_TEMPLATES.length);
  });

  test("las plantillas que devuelve son copias: editarlas no toca el catálogo", () => {
    const primera = listFactoryTemplates()[0];
    primera.recipes[0].name = "Cambiada";
    primera.scopeTree[0].name = "Cambiado";

    const segunda = listFactoryTemplates()[0];
    expect(segunda.recipes[0].name).not.toBe("Cambiada");
    expect(segunda.scopeTree[0].name).not.toBe("Cambiado");
    expect(FACTORY_TEMPLATES[0].recipes[0].name).not.toBe("Cambiada");
  });
});

describe("templateFromPlan", () => {
  const plan: MatrixPlan = {
    id: "p1",
    name: "Torre 3 de Da Porto",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      { id: "c1", scopeId: "estructura", areaId: "piso-1", recipeId: "r1", active: true },
    ],
  };

  test("guarda la forma de la obra: alcances, ubicaciones y recetas", () => {
    const template = templateFromPlan(plan, "Mi torre tipo");

    expect(template.name).toBe("Mi torre tipo");
    expect(template.scopeTree).toEqual(plan.scopeTree);
    expect(template.areas).toEqual(plan.areas);
    expect(template.recipes).toEqual(plan.recipes);
  });

  test("no guarda las celdas ni las fechas: una plantilla no es una obra concreta", () => {
    const template = templateFromPlan(plan, "Mi torre tipo") as unknown as Record<string, unknown>;

    expect(template.cells).toBeUndefined();
    expect(template.startDate).toBeUndefined();
  });

  test("la plantilla es independiente del plan del que salió", () => {
    const template = templateFromPlan(plan, "Mi torre tipo");
    template.scopeTree[0].name = "Cambiado";

    expect(plan.scopeTree[0].name).toBe("Estructura");
  });
});
