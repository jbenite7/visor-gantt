import {
  approveCellFeedback,
  dismissCellFeedback,
  listPendingFeedback,
} from "./feedback";
import type { MatrixPlan } from "@/types/matrix";

const AHORA = "2026-08-07T12:00:00.000Z";

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
        quantity: 20,
        productivityOverridePerDay: 4,
        feedback: {
          source: "gantt",
          observedDurationDays: 8,
          suggestedProductivityPerDay: 2.5,
          status: "pendingApproval",
        },
      },
      {
        id: "c2",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
      },
    ],
  };
}

describe("listPendingFeedback", () => {
  test("lista solo lo que está esperando aprobación", () => {
    const pendientes = listPendingFeedback(plan());

    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].cellId).toBe("c1");
  });

  test("lo explica en lenguaje de obra, con los dos números", () => {
    expect(listPendingFeedback(plan())[0].message).toBe(
      "En obra tardó 8 días. El rendimiento real es 2,5 por día, frente a 4 planificado.",
    );
  });

  test("un plan sin observaciones devuelve la lista vacía", () => {
    expect(listPendingFeedback({ ...plan(), cells: [] })).toEqual([]);
  });
});

describe("approveCellFeedback", () => {
  test("aprobar escribe el rendimiento observado en la celda", () => {
    const result = approveCellFeedback(plan(), "c1", AHORA);
    const celda = result.cells.find((cell) => cell.id === "c1")!;

    expect(celda.productivityOverridePerDay).toBe(2.5);
    expect(celda.feedback?.status).toBe("approved");
  });

  test("aprobado deja de estar pendiente", () => {
    expect(listPendingFeedback(approveCellFeedback(plan(), "c1", AHORA))).toHaveLength(0);
  });

  test("marca cuándo se aprobó y desde dónde", () => {
    const celda = approveCellFeedback(plan(), "c1", AHORA).cells.find(
      (cell) => cell.id === "c1",
    )!;

    expect(celda.lastEditedAt).toBe(AHORA);
    expect(celda.lastEditedFrom).toBe("matrix");
  });

  test("aprobar una celda sin observación no cambia nada", () => {
    const result = approveCellFeedback(plan(), "c2", AHORA);

    expect(result.cells.find((cell) => cell.id === "c2")?.productivityOverridePerDay)
      .toBeUndefined();
  });
});

describe("dismissCellFeedback", () => {
  test("descartar conserva el rendimiento planificado", () => {
    const celda = dismissCellFeedback(plan(), "c1", AHORA).cells.find(
      (cell) => cell.id === "c1",
    )!;

    expect(celda.productivityOverridePerDay).toBe(4);
    expect(celda.feedback?.status).toBe("dismissed");
  });

  test("descartado deja de estar pendiente", () => {
    expect(listPendingFeedback(dismissCellFeedback(plan(), "c1", AHORA))).toHaveLength(0);
  });
});
