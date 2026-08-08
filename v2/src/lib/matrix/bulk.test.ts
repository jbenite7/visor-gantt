import { applyBulkCellEdit, createAreaRange, duplicateAreaNode, duplicateScopeNode } from "./bulk";
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

describe("duplicateAreaNode", () => {
  test("copia la ubicación con otro nombre", () => {
    const result = duplicateAreaNode(plan(), "piso-1", AHORA);

    expect(result.areas).toHaveLength(3);
    expect(result.areas.map((area) => area.name)).toContain("Piso 1 (copia)");
  });

  test("copia también sus celdas, con la misma receta y cantidad", () => {
    const result = duplicateAreaNode(plan(), "piso-1", AHORA);
    const copia = result.areas.find((area) => area.name === "Piso 1 (copia)")!;
    const celdaCopiada = result.cells.find((cell) => cell.areaId === copia.id)!;

    expect(celdaCopiada.recipeId).toBe("r1");
    expect(celdaCopiada.quantity).toBe(10);
    expect(celdaCopiada.active).toBe(true);
  });

  test("la copia no arrastra las tareas ya generadas de la original", () => {
    const conTareas: MatrixPlan = {
      ...plan(),
      cells: [
        {
          ...plan().cells[0],
          generatedTaskIds: ["mx-task-1"],
          syncedTaskIds: ["mx-task-1"],
        },
      ],
    };
    const result = duplicateAreaNode(conTareas, "piso-1", AHORA);
    const copia = result.areas.find((area) => area.name === "Piso 1 (copia)")!;
    const celdaCopiada = result.cells.find((cell) => cell.areaId === copia.id)!;

    expect(celdaCopiada.generatedTaskIds ?? []).toHaveLength(0);
  });

  test("duplicar algo que no existe no cambia nada", () => {
    const original = plan();
    expect(duplicateAreaNode(original, "fantasma", AHORA).areas).toHaveLength(2);
  });
});

describe("duplicateScopeNode", () => {
  test("copia el alcance con sus celdas", () => {
    const result = duplicateScopeNode(plan(), "estructura", AHORA);
    const copia = result.scopeTree.find((scope) => scope.name === "Estructura (copia)")!;

    expect(copia).toBeDefined();
    expect(result.cells.filter((cell) => cell.scopeId === copia.id)).toHaveLength(1);
  });
});

describe("createAreaRange", () => {
  test("crea las ubicaciones del rango con el patrón indicado", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Piso {n}", from: 3, to: 6, type: "Piso" },
      AHORA,
    );

    expect(result.areas.map((area) => area.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
      "Piso 4",
      "Piso 5",
      "Piso 6",
    ]);
  });

  test("crea las celdas de cada alcance para cada ubicación nueva", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Piso {n}", from: 3, to: 4, type: "Piso" },
      AHORA,
    );

    // 2 alcances × 2 ubicaciones nuevas = 4 celdas nuevas, más la que ya había
    expect(result.cells).toHaveLength(5);
  });

  test("un rango descendente crea sótanos en orden", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Sótano {n}", from: 3, to: 1, type: "Sótano" },
      AHORA,
    );

    expect(result.areas.slice(2).map((area) => area.name)).toEqual([
      "Sótano 3",
      "Sótano 2",
      "Sótano 1",
    ]);
  });

  test("no repite una ubicación que ya existe con ese nombre", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Piso {n}", from: 1, to: 3, type: "Piso" },
      AHORA,
    );

    expect(result.areas.map((area) => area.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
    ]);
  });

  test("un patrón sin {n} crea una sola ubicación y no veinte iguales", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Cubierta", from: 1, to: 5, type: "Piso" },
      AHORA,
    );

    expect(result.areas.filter((area) => area.name === "Cubierta")).toHaveLength(1);
  });
});
