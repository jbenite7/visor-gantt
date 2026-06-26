/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MatrixEditorView from "./MatrixEditorView";
import { createDefaultMatrixPlan } from "@/lib/matrix/templates";

describe("MatrixEditorView", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("creates a draft matrix for projects without matrix data", () => {
    render(
      <MatrixEditorView
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Crear matriz/i }));

    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();
    expect(screen.getByText("Piso 1")).toBeInTheDocument();
  });

  test("opens a side panel with activity quantities, units and productivity", () => {
    const onApplyMatrixPlan = jest.fn();
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-ui",
      name: "Matriz UI",
      startDate: "2026-01-05",
    });

    render(
      <MatrixEditorView
        matrixPlan={matrixPlan}
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Piso 1"));

    expect(screen.getByTestId("matrix-cell-panel")).toBeInTheDocument();
    expect(screen.getByText("Formaleta")).toBeInTheDocument();
    expect(screen.getByLabelText("Unidad Formaleta")).toHaveValue("m2");

    fireEvent.change(screen.getByLabelText("Cantidad Formaleta"), {
      target: { value: "250" },
    });
    fireEvent.change(screen.getByLabelText("Rendimiento Formaleta"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({
            activityOverrides: expect.arrayContaining([
              expect.objectContaining({
                activityId: "formaleta",
                quantity: 250,
                productivityPerDay: 25,
                unit: "m2",
                lastEditedFrom: "matrix",
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  test("shows cell quantity summaries and allows editing activity units", () => {
    const onApplyMatrixPlan = jest.fn();
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-unit",
      name: "Matriz Unidades",
      startDate: "2026-01-05",
    });

    render(
      <MatrixEditorView
        matrixPlan={matrixPlan}
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(
      screen.getAllByRole("button", {
        name: /Estructura en concreto 3 actividades .*100 m2.*1600 kg.*80 m3/i,
      }).length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Unidad Formaleta"), {
      target: { value: "m2-form" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({
            activityOverrides: expect.arrayContaining([
              expect.objectContaining({
                activityId: "formaleta",
                unit: "m2-form",
                lastEditedFrom: "matrix",
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  test("warns about missing activity quantities and productivity in the cell panel", () => {
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-alerts",
      name: "Matriz Alertas",
      startDate: "2026-01-05",
    });
    const firstCell = matrixPlan.cells[0];

    render(
      <MatrixEditorView
        matrixPlan={{
          ...matrixPlan,
          cells: [
            {
              ...firstCell,
              activityOverrides: firstCell.activityOverrides?.map((override) =>
                override.activityId === "formaleta"
                  ? { ...override, quantity: 0, productivityPerDay: 0 }
                  : override,
              ),
            },
            ...matrixPlan.cells.slice(1),
          ],
        }}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(screen.getByText("Datos faltantes")).toBeInTheDocument();
    expect(screen.getByText("Formaleta necesita cantidad mayor a 0.")).toBeInTheDocument();
    expect(screen.getByText("Formaleta necesita rendimiento mayor a 0.")).toBeInTheDocument();
  });

  test("stamps recipe changes with the current matrix edit timestamp", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-02T10:00:00.000Z"));
    const onApplyMatrixPlan = jest.fn();
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-recipe-change",
      name: "Matriz Receta",
      startDate: "2026-01-05",
    });

    render(
      <MatrixEditorView
        matrixPlan={matrixPlan}
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Receta"), {
      target: { value: "arquitectura-muros" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({
            recipeId: "arquitectura-muros",
            lastEditedAt: "2026-02-02T10:00:00.000Z",
            activityOverrides: expect.arrayContaining([
              expect.objectContaining({
                activityId: "mamposteria",
                lastEditedAt: "2026-02-02T10:00:00.000Z",
                lastEditedFrom: "matrix",
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});
