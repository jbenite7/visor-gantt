import { applyBulkCellEdit } from "./bulk";
import type { MatrixPlan } from "@/types/matrix";

const AHORA = "2026-08-07T12:00:00.000Z";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [
      { id: "estructura", name: "Estructura", type: "Disciplina" },
      { id: "acabados", name: "Acabados", type: "Disciplina" },
    ],
    areas: [
      { id: "piso-1", name: "Piso 1", type: "Piso" },
      { id: "piso-2", name: "Piso 2", type: "Piso" },
    ],
    recipes: [
      { id: "r1", name: "Estructura", activities: [], dependencies: [] },
      { id: "r2", name: "Acabados", activities: [], dependencies: [] },
    ],
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

describe("applyBulkCellEdit", () => {
  test("aplica el cambio a las celdas seleccionadas", () => {
    const result = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { quantity: 25 },
      AHORA,
    );

    expect(result.cells[0].quantity).toBe(25);
  });

  test("solo toca los campos que se pasan: activar no borra la receta", () => {
    const result = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { active: false },
      AHORA,
    );

    expect(result.cells[0].active).toBe(false);
    expect(result.cells[0].recipeId).toBe("r1");
    expect(result.cells[0].quantity).toBe(10);
  });

  test("crea las celdas que aún no existen, para que seleccionar una fila entera funcione", () => {
    const result = applyBulkCellEdit(
      plan(),
      [
        { scopeId: "estructura", areaId: "piso-1" },
        { scopeId: "estructura", areaId: "piso-2" },
      ],
      { recipeId: "r1", active: true },
      AHORA,
    );

    expect(result.cells).toHaveLength(2);
    const nueva = result.cells.find((cell) => cell.areaId === "piso-2")!;
    expect(nueva.recipeId).toBe("r1");
    expect(nueva.active).toBe(true);
  });

  test("marca cuándo y desde dónde se editó", () => {
    const result = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { quantity: 3 },
      AHORA,
    );

    expect(result.cells[0].lastEditedAt).toBe(AHORA);
    expect(result.cells[0].lastEditedFrom).toBe("matrix");
  });

  test("no toca las celdas que no se seleccionaron", () => {
    const base = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-2" }],
      { quantity: 7, active: true },
      AHORA,
    );
    const result = applyBulkCellEdit(
      base,
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { quantity: 99 },
      AHORA,
    );

    expect(result.cells.find((cell) => cell.areaId === "piso-2")?.quantity).toBe(7);
  });

  test("sin celdas seleccionadas devuelve el plan tal cual", () => {
    const original = plan();
    expect(applyBulkCellEdit(original, [], { quantity: 1 }, AHORA).cells).toEqual(
      original.cells,
    );
  });
});
