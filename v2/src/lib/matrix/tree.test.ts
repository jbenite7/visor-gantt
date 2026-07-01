import type { MatrixPlan } from "@/types/matrix";
import {
  MAX_MATRIX_TREE_DEPTH,
  canAddChild,
  getAreaLeaves,
  getScopeLeaves,
  reconcileMatrixCells,
  removeAreaNode,
  removeScopeNode,
} from "./tree";

const basePlan: MatrixPlan = {
  id: "matrix-tree",
  name: "Matriz arbol",
  startDate: "2026-01-05",
  scopeTree: [
    {
      id: "obra",
      name: "Obra",
      type: "Capitulo",
      children: [
        {
          id: "estructura",
          name: "Estructura",
          type: "Disciplina",
          defaultRecipeId: "concreto",
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
  areas: [
    {
      id: "torre-a",
      name: "Torre A",
      type: "Torre",
      children: [
        {
          id: "piso-1",
          name: "Piso 1",
          type: "Piso",
          children: [{ id: "apto-101", name: "Apto 101", type: "Unidad" }],
        },
      ],
    },
  ],
  recipes: [
    {
      id: "concreto",
      name: "Concreto",
      activities: [],
      dependencies: [],
    },
  ],
  cells: [
    {
      id: "cell-estructura-piso-1",
      scopeId: "estructura",
      areaId: "piso-1",
      recipeId: "concreto",
      active: true,
      notes: "celda padre obsoleta",
    },
    {
      id: "cell-zapatas-apto-101",
      scopeId: "zapatas",
      areaId: "apto-101",
      recipeId: "concreto",
      active: true,
      notes: "celda hoja conservada",
    },
  ],
};

function tenLevels() {
  let child = { id: "nivel-10", name: "Nivel 10", type: "Nivel" };
  for (let depth = 9; depth >= 1; depth -= 1) {
    child = {
      id: `nivel-${depth}`,
      name: `Nivel ${depth}`,
      type: "Nivel",
      children: [child],
    };
  }
  return [child];
}

describe("matrix tree helpers", () => {
  test("returns only leaves for scope and location trees", () => {
    expect(getScopeLeaves(basePlan.scopeTree).map((leaf) => leaf.node.id)).toEqual([
      "zapatas",
    ]);
    expect(getAreaLeaves(basePlan.areas).map((leaf) => leaf.node.id)).toEqual([
      "apto-101",
    ]);
  });

  test("blocks children beyond ten hierarchy levels", () => {
    expect(MAX_MATRIX_TREE_DEPTH).toBe(10);
    expect(canAddChild(tenLevels(), "nivel-9")).toBe(true);
    expect(canAddChild(tenLevels(), "nivel-10")).toBe(false);
  });

  test("reconciles cells to leaf scope by leaf location combinations", () => {
    const reconciled = reconcileMatrixCells(basePlan, "2026-02-02T00:00:00.000Z");

    expect(reconciled.cells).toEqual([
      expect.objectContaining({
        id: "cell-zapatas-apto-101",
        scopeId: "zapatas",
        areaId: "apto-101",
        active: true,
        notes: "celda hoja conservada",
      }),
    ]);
    expect(reconciled.cells).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeId: "estructura" }),
        expect.objectContaining({ areaId: "piso-1" }),
      ]),
    );
  });

  test("removes scope or location descendants and their cells as a cascade", () => {
    const withoutScope = removeScopeNode(basePlan, "estructura");
    expect(withoutScope.scopeTree[0].children).toEqual([]);
    expect(withoutScope.cells).toEqual([]);

    const withoutArea = removeAreaNode(basePlan, "piso-1");
    expect(withoutArea.areas[0].children).toEqual([]);
    expect(withoutArea.cells).toEqual([]);
  });
});
