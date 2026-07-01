/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MatrixEditorView from "./MatrixEditorView";
import { createDefaultMatrixPlan, createEmptyMatrixPlan } from "@/lib/matrix/templates";

describe("MatrixEditorView", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
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

  test("infers Piso as the location type when adding floor locations", () => {
    const onApplyMatrixPlan = jest.fn();
    const matrixPlan = createEmptyMatrixPlan({
      id: "matrix-empty-ui",
      name: "Edificio 10 pisos",
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

    fireEvent.change(screen.getByPlaceholderText("Nueva ubicación"), {
      target: { value: "Piso 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ubicación" }));
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        areas: [
          expect.objectContaining({
            name: "Piso 1",
            type: "Piso",
          }),
        ],
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

  test("edits scope and location trees with leaf-only cells", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const onApplyMatrixPlan = jest.fn();
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-tree-ui",
      name: "Matriz Jerarquica",
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

    fireEvent.click(screen.getByRole("button", { name: "Alcances" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar hijo a Estructura" }));
    fireEvent.change(screen.getByLabelText("Nombre alcance Nuevo sub-alcance"), {
      target: { value: "Zapatas" },
    });
    fireEvent.change(screen.getByLabelText("Tipo alcance Zapatas"), {
      target: { value: "Partida" },
    });
    fireEvent.change(screen.getByLabelText("Receta alcance Zapatas"), {
      target: { value: "estructura-concreto" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Ubicaciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar hijo a Piso 1" }));
    fireEvent.change(screen.getByLabelText("Nombre ubicacion Nueva sub-ubicacion"), {
      target: { value: "Apto 101" },
    });
    fireEvent.change(screen.getByLabelText("Tipo ubicacion Apto 101"), {
      target: { value: "Unidad" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));
    expect(screen.getByText("Zapatas")).toBeInTheDocument();
    expect(screen.getByText("Apto 101")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Estructura en concreto/i }).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));
    const applied = onApplyMatrixPlan.mock.calls[0][0];
    const leafScope = applied.scopeTree[0].children[0].children[0];
    const leafArea = applied.areas[0].children[0].children[0];

    expect(leafScope).toMatchObject({
      name: "Zapatas",
      type: "Partida",
      defaultRecipeId: "estructura-concreto",
    });
    expect(leafArea).toMatchObject({ name: "Apto 101", type: "Unidad" });
    expect(applied.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: leafScope.id,
          areaId: leafArea.id,
          recipeId: "estructura-concreto",
        }),
      ]),
    );
    expect(applied.cells).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeId: "estructura" }),
        expect.objectContaining({ areaId: "piso-1" }),
      ]),
    );
  });

  test("blocks level eleven and confirms cascade deletion", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const onApplyMatrixPlan = jest.fn();
    let child = {
      id: "nivel-10",
      name: "Nivel 10",
      type: "Nivel",
      defaultRecipeId: "estructura-concreto",
    };
    for (let depth = 9; depth >= 1; depth -= 1) {
      child = {
        id: `nivel-${depth}`,
        name: `Nivel ${depth}`,
        type: "Nivel",
        children: [child],
      };
    }
    const matrixPlan = {
      ...createDefaultMatrixPlan({
        id: "matrix-depth-ui",
        name: "Matriz Profunda",
        startDate: "2026-01-05",
      }),
      scopeTree: [child],
      cells: [
        {
          id: "cell-depth",
          scopeId: "nivel-10",
          areaId: "piso-1",
          recipeId: "estructura-concreto",
          active: true,
        },
      ],
    };

    render(
      <MatrixEditorView
        matrixPlan={matrixPlan}
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Alcances" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar hijo a Nivel 10" }));
    expect(screen.getByText("Maximo 10 niveles de jerarquia.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Nivel 9" }));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Se eliminaran 2 alcances y 1 celdas"),
    );
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    expect(onApplyMatrixPlan.mock.calls[0][0].cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: "nivel-8",
          active: false,
        }),
      ]),
    );
    expect(onApplyMatrixPlan.mock.calls[0][0].cells).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeId: "nivel-9" }),
        expect.objectContaining({ scopeId: "nivel-10" }),
      ]),
    );
  });
});
