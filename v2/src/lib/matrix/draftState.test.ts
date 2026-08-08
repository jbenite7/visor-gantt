import { describeDraftChanges } from "./draftState";
import type { MatrixPlan } from "@/types/matrix";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        quantity: 10,
      },
    ],
  };
}

describe("describeDraftChanges", () => {
  test("sin cambios no hay nada que avisar", () => {
    expect(describeDraftChanges(plan(), plan())).toEqual({
      hasChanges: false,
      changedCellCount: 0,
      message: "No hay cambios sin aplicar.",
    });
  });

  test("cambiar una cantidad cuenta como un cambio", () => {
    const draft = {
      ...plan(),
      cells: [{ ...plan().cells[0], quantity: 25 }],
    };
    const result = describeDraftChanges(draft, plan());

    expect(result.hasChanges).toBe(true);
    expect(result.changedCellCount).toBe(1);
    expect(result.message).toBe("Hay 1 celda con cambios sin aplicar.");
  });

  test("varias celdas se cuentan en plural", () => {
    const applied = plan();
    const draft = {
      ...applied,
      cells: [
        { ...applied.cells[0], quantity: 25 },
        {
          id: "c2",
          scopeId: "estructura",
          areaId: "piso-2",
          recipeId: "r1",
          active: true,
        },
      ],
    };

    expect(describeDraftChanges(draft, applied).message).toBe(
      "Hay 2 celdas con cambios sin aplicar.",
    );
  });

  test("cambiar los alcances también cuenta, aunque las celdas sigan igual", () => {
    const draft = {
      ...plan(),
      scopeTree: [
        ...plan().scopeTree,
        { id: "acabados", name: "Acabados", type: "Disciplina" },
      ],
    };
    const result = describeDraftChanges(draft, plan());

    expect(result.hasChanges).toBe(true);
    expect(result.message).toBe("Hay cambios en la estructura de la matriz sin aplicar.");
  });

  test("un borrador nuevo sobre nada es un cambio", () => {
    expect(describeDraftChanges(plan(), undefined).hasChanges).toBe(true);
  });

  test("sin borrador no hay cambios que perder", () => {
    expect(describeDraftChanges(undefined, plan()).hasChanges).toBe(false);
  });

  test("borrar una celda cuenta como cambio: es lo que más fácil se pierde", () => {
    const applied = plan();
    const draft = { ...applied, cells: [] };

    const result = describeDraftChanges(draft, applied);

    expect(result.hasChanges).toBe(true);
    expect(result.changedCellCount).toBe(1);
    expect(result.message).toBe("Hay 1 celda con cambios sin aplicar.");
  });

  test("una celda editada y otra borrada suman dos", () => {
    const applied = {
      ...plan(),
      cells: [plan().cells[0], { ...plan().cells[0], id: "c2", areaId: "piso-2" }],
    };
    const draft = { ...applied, cells: [{ ...applied.cells[0], quantity: 99 }] };

    expect(describeDraftChanges(draft, applied).changedCellCount).toBe(2);
  });
});
