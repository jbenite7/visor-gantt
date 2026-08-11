/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SCurveView from "./SCurveView";
import { saveProjectSnapshot } from "@/app/actions/snapshots";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";

// La sub-vista Cortes solo lee/escribe fotos al abrirse; sin este mock,
// importar las acciones tira de `pg` en el entorno jsdom del test.
jest.mock("@/app/actions/snapshots", () => ({
  listProjectSnapshots: jest.fn(async () => []),
  loadProjectSnapshot: jest.fn(async () => null),
  saveProjectSnapshot: jest.fn(async () => ({ success: true })),
}));

function task(overrides: Partial<GanttTask> & { id: string | number; name: string }): GanttTask {
  return {
    start: new Date(2026, 0, 1),
    finish: new Date(2026, 0, 4),
    duration: 4,
    progress: 25,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("SCurveView", () => {
  test("renders automatic feedback from earned value diagnostics", () => {
    const tasks: GanttTask[] = [
      task({ id: "T1", name: "Estructura" }),
    ];
    const budgetMappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 1000 },
    ];
    const budgetItems: BudgetItem[] = [
      {
        id: "item-1",
        category: "labor",
        budgetedAmount: 1000,
        spentAmount: 1500,
        mappedTaskIds: ["T1"],
      },
    ];

    render(
      <SCurveView
        tasks={tasks}
        budgetMappings={budgetMappings}
        budgetItems={budgetItems}
      />,
    );

    expect(screen.getByTestId("s-curve-feedback")).toHaveTextContent("SPI");
    expect(screen.getAllByTestId("s-curve-feedback-card").length).toBeGreaterThan(0);
  });
});

/**
 * El tablero de Cortes se tragaba el motivo del fallo.
 *
 * `handleMarkSnapshot` hacía `if (!result.success) return;`: el error llegaba
 * del servidor y se descartaba ahí mismo. El usuario pulsaba «Marcar corte» y
 * no pasaba absolutamente nada.
 */
describe("marcar un corte que falla no se queda mudo", () => {
  test("el motivo del servidor llega hasta la pantalla", async () => {
    (saveProjectSnapshot as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: "No tienes permisos para esta acción",
    });

    render(
      <SCurveView
        projectId="p1"
        tasks={[task({ id: 1, name: "Excavación" })]}
        budgetMappings={[]}
        budgetItems={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cortes/i }));
    fireEvent.change(screen.getByTestId("snapshots-board-mark-name"), {
      target: { value: "Corte de enero" },
    });
    fireEvent.click(screen.getByTestId("snapshots-board-mark"));

    expect(await screen.findByTestId("snapshot-mark-error")).toHaveTextContent(
      /no tienes permisos/i,
    );
  });

  test("si después sale bien, el aviso desaparece", async () => {
    (saveProjectSnapshot as jest.Mock)
      .mockResolvedValueOnce({ success: false, error: "Se cayó la base" })
      .mockResolvedValueOnce({ success: true });

    render(
      <SCurveView
        projectId="p1"
        tasks={[task({ id: 1, name: "Excavación" })]}
        budgetMappings={[]}
        budgetItems={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cortes/i }));
    const nombre = () => screen.getByTestId("snapshots-board-mark-name");

    fireEvent.change(nombre(), { target: { value: "Primero" } });
    fireEvent.click(screen.getByTestId("snapshots-board-mark"));
    await screen.findByTestId("snapshot-mark-error");

    fireEvent.change(nombre(), { target: { value: "Segundo" } });
    fireEvent.click(screen.getByTestId("snapshots-board-mark"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("snapshot-mark-error"),
      ).not.toBeInTheDocument(),
    );
  });
});
