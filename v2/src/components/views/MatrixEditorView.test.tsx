/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MatrixEditorView from "./MatrixEditorView";
import MatrixEditorViewDefault, { MATRIX_VISIBLE_ROWS } from "./MatrixEditorView";
import type { MatrixPlan } from "@/types/matrix";
import { createDefaultMatrixPlan, createEmptyMatrixPlan } from "@/lib/matrix/templates";

function planGrande(scopeCount = 30): MatrixPlan {
  const scopeTree = Array.from({ length: scopeCount }, (_, index) => ({
    id: `alcance-${index}`,
    name: `Alcance ${index + 1}`,
    type: "Disciplina",
    defaultRecipeId: "r1",
  }));
  const areas = Array.from({ length: 40 }, (_, index) => ({
    id: `ubicacion-${index}`,
    name: `Piso ${index + 1}`,
    type: "Piso",
  }));

  return {
    id: "grande",
    name: "Torre grande",
    startDate: "2026-03-02",
    scopeTree,
    areas,
    recipes: [
      {
        id: "r1",
        name: "Receta",
        activities: [
          { id: "a1", name: "Actividad", productivityPerDay: 1, defaultQuantity: 2 },
        ],
        dependencies: [],
      },
    ],
    cells: scopeTree.flatMap((scope) =>
      areas.map((area) => ({
        id: `cell-${scope.id}-${area.id}`,
        scopeId: scope.id,
        areaId: area.id,
        recipeId: "r1",
        active: true,
        quantity: 2,
      })),
    ),
  };
}

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

function renderEditor() {
  const onApplyMatrixPlan = jest.fn();
  const plan = createDefaultMatrixPlan({
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
  });
  render(
    <MatrixEditorView
      matrixPlan={plan}
      tasks={[]}
      onApplyMatrixPlan={onApplyMatrixPlan}
      onSyncFromGantt={jest.fn()}
    />,
  );
  return { plan, onApplyMatrixPlan };
}

describe("MatrixEditorView · selección de varias celdas", () => {
  test("sin selección múltiple no aparece el panel de lote", () => {
    renderEditor();

    expect(screen.queryByTestId("matrix-bulk-panel")).not.toBeInTheDocument();
  });

  test("marcar dos celdas abre el panel de lote con el recuento", () => {
    const { plan } = renderEditor();
    const [primera, segunda] = plan.cells;

    fireEvent.click(screen.getByTestId(`matrix-cell-select-${primera.id}`));
    fireEvent.click(screen.getByTestId(`matrix-cell-select-${segunda.id}`));

    expect(screen.getByTestId("matrix-bulk-panel")).toHaveTextContent(
      "2 celdas seleccionadas",
    );
  });

  test("seleccionar una fila entera marca todas sus celdas", () => {
    const { plan } = renderEditor();
    const scopeId = plan.scopeTree[0].children![0].id;

    fireEvent.click(screen.getByTestId(`matrix-select-row-${scopeId}`));

    const enLaFila = plan.cells.filter((cell) => cell.scopeId === scopeId).length;
    expect(screen.getByTestId("matrix-bulk-panel")).toHaveTextContent(
      `${enLaFila} celdas seleccionadas`,
    );
  });

  test("desactivar en lote aplica el cambio a las celdas marcadas", () => {
    const { plan, onApplyMatrixPlan } = renderEditor();
    const [primera, segunda] = plan.cells;

    fireEvent.click(screen.getByTestId(`matrix-cell-select-${primera.id}`));
    fireEvent.click(screen.getByTestId(`matrix-cell-select-${segunda.id}`));
    fireEvent.click(screen.getByRole("button", { name: "Desactivar las seleccionadas" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    const aplicado = onApplyMatrixPlan.mock.calls.at(-1)![0];
    expect(aplicado.cells.find((cell: { id: string }) => cell.id === primera.id).active).toBe(
      false,
    );
    expect(aplicado.cells.find((cell: { id: string }) => cell.id === segunda.id).active).toBe(
      false,
    );
  });

  test("limpiar la selección cierra el panel", () => {
    const { plan } = renderEditor();

    fireEvent.click(screen.getByTestId(`matrix-cell-select-${plan.cells[0].id}`));
    fireEvent.click(screen.getByRole("button", { name: "Quitar la selección" }));

    expect(screen.queryByTestId("matrix-bulk-panel")).not.toBeInTheDocument();
  });
});

describe("MatrixEditorView · selección y borrados", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("borrar un alcance descarta sus coordenadas de la selección", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const { plan, onApplyMatrixPlan } = renderEditor();
    const scopeId = plan.scopeTree[0].children![0].id;

    fireEvent.click(screen.getByTestId(`matrix-select-row-${scopeId}`));

    fireEvent.click(screen.getByRole("button", { name: "Alcances" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Estructura" }));
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));

    expect(screen.queryByTestId("matrix-bulk-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    const aplicado = onApplyMatrixPlan.mock.calls.at(-1)![0];
    expect(
      aplicado.cells.filter((cell: { scopeId: string }) => cell.scopeId === scopeId),
    ).toHaveLength(0);
  });
});

describe("MatrixEditorView · escala", () => {
  test("el plan de prueba tiene más de 1000 celdas", () => {
    expect(planGrande().cells).toHaveLength(1200);
  });

  test("no monta las 1200 celdas de golpe", () => {
    render(
      <MatrixEditorViewDefault
        matrixPlan={planGrande()}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(screen.getAllByTestId(/^matrix-cell-select-/).length).toBeLessThanOrEqual(
      MATRIX_VISIBLE_ROWS * 40,
    );
    expect(screen.getAllByTestId(/^matrix-cell-select-/).length).toBeLessThan(1200);
  });

  test("anuncia cuántas filas se están viendo de cuántas", () => {
    render(
      <MatrixEditorViewDefault
        matrixPlan={planGrande()}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(screen.getByTestId("matrix-window-status")).toHaveTextContent(
      `Mostrando ${MATRIX_VISIBLE_ROWS} de 30 alcances.`,
    );
  });

  test("se puede avanzar a las filas siguientes", () => {
    render(
      <MatrixEditorViewDefault
        matrixPlan={planGrande()}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(screen.getByText("Alcance 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver los siguientes alcances" }));

    expect(screen.queryByText("Alcance 1")).not.toBeInTheDocument();
    expect(
      screen.getByText(`Alcance ${MATRIX_VISIBLE_ROWS + 1}`),
    ).toBeInTheDocument();
  });

  test("una matriz pequeña no muestra los controles de ventana", () => {
    const { plan } = renderEditor();

    expect(plan.cells.length).toBeLessThan(MATRIX_VISIBLE_ROWS * 40);
    expect(screen.queryByTestId("matrix-window-status")).not.toBeInTheDocument();
  });

  test("si la matriz encoge por debajo de la página actual, la ventana retrocede", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MatrixEditorViewDefault
        matrixPlan={planGrande(25)}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    const siguientes = () =>
      screen.getByRole("button", { name: "Ver los siguientes alcances" });
    fireEvent.click(siguientes());
    fireEvent.click(siguientes());
    expect(screen.getByTestId("matrix-window-status")).toHaveTextContent(
      "Mostrando 1 de 25 alcances.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Alcances" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Alcance 25" }));
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));

    expect(screen.getByTestId("matrix-window-status")).toHaveTextContent(
      `Mostrando ${MATRIX_VISIBLE_ROWS} de 24 alcances.`,
    );
    expect(screen.getByText("Alcance 24")).toBeInTheDocument();
  });
});
