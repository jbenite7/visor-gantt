/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
jest.mock("@/app/actions/project", () => ({
  saveMatrixTemplate: jest.fn(async () => ({ success: true, id: "t1" })),
  listMatrixTemplates: jest.fn(async () => []),
}));

import MatrixEditorView from "./MatrixEditorView";
import { listMatrixTemplates, saveMatrixTemplate } from "@/app/actions/project";
import MatrixEditorViewDefault, { MATRIX_VISIBLE_ROWS } from "./MatrixEditorView";
import type { MatrixPlan } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { GanttTask } from "@/components/gantt/types";
import { createDefaultMatrixPlan, createEmptyMatrixPlan } from "@/lib/matrix/templates";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";

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
    fireEvent.change(screen.getByLabelText("Nombre ubicación Nueva sub-ubicación"), {
      target: { value: "Apto 101" },
    });
    fireEvent.change(screen.getByLabelText("Tipo ubicación Apto 101"), {
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
    expect(screen.getByText("Máximo 10 niveles de jerarquía.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Nivel 9" }));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Se eliminarán 2 alcances y 1 celdas"),
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

function tarea(id: number, name: string, startDay: number, durationDays: number): GanttTask {
  return {
    id,
    name,
    start: new Date(2026, 2, startDay),
    finish: new Date(2026, 2, startDay + durationDays - 1),
    duration: durationDays,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [],
  };
}

/** Tres pisos con la misma actividad: lo mínimo para que haya propuesta. */
function cronogramaRepetido(): GanttTask[] {
  return [
    tarea(1, "Mampostería piso 1", 2, 5),
    tarea(2, "Mampostería piso 2", 9, 5),
    tarea(3, "Mampostería piso 3", 16, 5),
  ];
}

function planConRendimientoObservado(): MatrixPlan {
  return {
    id: "matriz-rendimientos",
    name: "Torre con obra",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "r1",
        name: "Receta",
        activities: [
          { id: "a1", name: "Actividad", productivityPerDay: 5, defaultQuantity: 10 },
        ],
        dependencies: [],
      },
    ],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        quantity: 10,
        productivityOverridePerDay: 5,
        feedback: {
          source: "gantt",
          observedDurationDays: 4,
          suggestedProductivityPerDay: 2.5,
          status: "pendingApproval",
        },
      },
    ],
  };
}

function renderConPlanPorDefecto(props: {
  onApplyMatrixPlan?: jest.Mock;
  tasks?: GanttTask[];
} = {}) {
  const onApplyMatrixPlan = props.onApplyMatrixPlan ?? jest.fn();
  render(
    <MatrixEditorView
      matrixPlan={createDefaultMatrixPlan({
        id: "matrix-montaje",
        name: "Matriz montaje",
        startDate: "2026-01-05",
      })}
      tasks={props.tasks ?? []}
      onApplyMatrixPlan={onApplyMatrixPlan}
      onSyncFromGantt={jest.fn()}
    />,
  );
  return onApplyMatrixPlan;
}

describe("MatrixEditorView · pantallas enchufadas", () => {
  test("el modo Ubicaciones monta las acciones en lote y duplicar llega al borrador", () => {
    const onApplyMatrixPlan = renderConPlanPorDefecto();

    fireEvent.click(screen.getByRole("button", { name: "Ubicaciones" }));
    expect(screen.getByTestId("location-bulk-actions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Duplicar ubicación" }));
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        areas: expect.arrayContaining([
          expect.objectContaining({ name: "Piso 1 (copia)" }),
        ]),
      }),
    );
  });

  test("el modo Ubicaciones crea un rango de ubicaciones en el borrador", () => {
    const onApplyMatrixPlan = renderConPlanPorDefecto();

    fireEvent.click(screen.getByRole("button", { name: "Ubicaciones" }));
    fireEvent.change(screen.getByLabelText("Nombre, con {n} donde va el número"), {
      target: { value: "Sótano {n}" },
    });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear ubicaciones" }));
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        areas: expect.arrayContaining([
          expect.objectContaining({ name: "Sótano 3" }),
        ]),
      }),
    );
  });

  test("el modo Recetas monta el editor y la actividad nueva llega al borrador", () => {
    const onApplyMatrixPlan = renderConPlanPorDefecto();

    fireEvent.click(screen.getByRole("button", { name: "Recetas" }));
    expect(screen.getByTestId("recipe-editor")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombre de la actividad"), {
      target: { value: "Curado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    const plan = onApplyMatrixPlan.mock.calls[0][0] as MatrixPlan;
    expect(
      plan.recipes.flatMap((recipe) => recipe.activities).map((item) => item.name),
    ).toContain("Curado");
  });

  test("el modo Plantillas monta el selector y elegir una reemplaza el borrador", () => {
    const onApplyMatrixPlan = renderConPlanPorDefecto();

    fireEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    expect(screen.getByTestId("template-picker")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Urbanismo y obras exteriores" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-urbanismo" }),
    );
  });

  test("guardar como plantilla deja la matriz en las plantillas propias", async () => {
    renderConPlanPorDefecto();

    fireEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    expect(screen.getByTestId("template-picker-own")).toHaveTextContent(
      "Todavía no has guardado ninguna matriz como plantilla.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar como plantilla" }));

    // Se espera: desde el 2026-08-11 el guardado va al servidor y no solo a
    // memoria, así que la lista se actualiza cuando el servidor confirma. Antes
    // era síncrono porque no salía de la pestaña — y por eso se perdía al
    // recargar.
    await waitFor(() =>
      expect(screen.getByTestId("template-picker-own")).toHaveTextContent(
        "Matriz montaje",
      ),
    );
  });

  test("sin cronograma no se puede generar la matriz desde el cronograma", () => {
    renderConPlanPorDefecto();

    fireEvent.click(screen.getByRole("button", { name: "Plantillas" }));

    expect(
      screen.getByRole("button", { name: "Generar matriz desde el cronograma" }),
    ).toBeDisabled();
  });

  test("generar desde el cronograma enseña la propuesta y aceptarla construye el plan", () => {
    const onApplyMatrixPlan = renderConPlanPorDefecto({
      tasks: cronogramaRepetido(),
    });

    fireEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Generar matriz desde el cronograma" }),
    );

    expect(screen.getByTestId("proposal-review")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Crear la matriz" }));
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    const plan = onApplyMatrixPlan.mock.calls[0][0] as MatrixPlan;
    expect(plan.areas.map((area) => area.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
    ]);
  });

  test("el modo Rendimientos monta el panel y aprobar llega al borrador", () => {
    const onApplyMatrixPlan = jest.fn();
    render(
      <MatrixEditorView
        matrixPlan={planConRendimientoObservado()}
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rendimientos" }));
    expect(screen.getByTestId("feedback-item-c1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Usar el rendimiento real" }));
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(onApplyMatrixPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "c1", productivityOverridePerDay: 2.5 }),
        ]),
      }),
    );
  });

  test("el modo Rendimientos descarta el rendimiento observado", () => {
    const onApplyMatrixPlan = jest.fn();
    render(
      <MatrixEditorView
        matrixPlan={planConRendimientoObservado()}
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rendimientos" }));
    fireEvent.click(screen.getByRole("button", { name: "Mantener lo planificado" }));

    expect(screen.getByTestId("feedback-empty")).toBeInTheDocument();
  });
});

describe("el borrador de la matriz no se pierde sin avisar (M28)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderConPlan(
    extra: Partial<ComponentProps<typeof MatrixEditorView>> = {},
  ) {
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-borrador",
      name: "Matriz",
      startDate: "2026-01-05",
    });

    render(
      <MatrixEditorView
        matrixPlan={matrixPlan}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
        {...extra}
      />,
    );
  }

  test("«Deshacer» pasa a llamarse «Descartar cambios»", () => {
    renderConPlan();

    expect(screen.getByTestId("matrix-discard")).toHaveTextContent(
      "Descartar cambios",
    );
  });

  test("sin cambios, descartar no pregunta nada", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    renderConPlan();

    fireEvent.click(screen.getByTestId("matrix-discard"));

    expect(confirmar).not.toHaveBeenCalled();
  });

  test("con cambios, descartar pide confirmación y dice cuántos se pierden", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(false);
    renderConPlan();

    fireEvent.click(
      screen.getByRole("button", { name: /Activar todas las celdas/i }),
    );
    fireEvent.click(screen.getByTestId("matrix-discard"));

    expect(confirmar).toHaveBeenCalledWith(expect.stringMatching(/cambio/i));
  });

  test("si el usuario dice que no, el borrador sigue ahí", () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    renderConPlan();

    fireEvent.click(
      screen.getByRole("button", { name: /Activar todas las celdas/i }),
    );
    fireEvent.click(screen.getByTestId("matrix-discard"));

    expect(screen.getByTestId("matrix-dirty")).toBeInTheDocument();
  });

  test("el borrador sucio se anuncia al proyecto, para el aviso al cerrar", () => {
    const onDirtyChange = jest.fn();
    renderConPlan({ onDirtyChange });

    fireEvent.click(
      screen.getByRole("button", { name: /Activar todas las celdas/i }),
    );

    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });
});

describe("MatrixEditorView · el calendario del proyecto manda en las fechas", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Solo tres días de obra: estira la matriz muy por encima del umbral. */
  const calendarioCorto: ProjectCalendar = {
    ...DEFAULT_PROJECT_CALENDAR,
    workDays: [1, 2, 3],
  };

  function renderConCalendario(
    extra: Partial<ComponentProps<typeof MatrixEditorView>> = {},
  ) {
    const onApplyMatrixPlan = jest.fn();
    render(
      <MatrixEditorView
        matrixPlan={createDefaultMatrixPlan({
          id: "matrix-calendario",
          name: "Matriz",
          startDate: "2026-01-05",
        })}
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
        {...extra}
      />,
    );
    return { onApplyMatrixPlan };
  }

  test("sin calendario la vista previa mantiene el fin de siempre", () => {
    renderConCalendario();

    // Fecha anclada: si la regla histórica cambiara, este test lo cazaría.
    expect(screen.getByTestId("matrix-preview")).toHaveTextContent(
      "Preview: 19 tareas · 2 alertas · fin 2026-01-16",
    );

    cleanup();

    renderConCalendario({ calendar: calendarioCorto });

    expect(screen.getByTestId("matrix-preview")).not.toHaveTextContent(
      "fin 2026-01-16",
    );
  });

  test("si el calendario mueve las fechas más de la cuenta, avisa antes de aplicar", () => {
    const { onApplyMatrixPlan } = renderConCalendario({
      calendar: calendarioCorto,
    });

    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(screen.getByTestId("matrix-calendar-warning")).toHaveTextContent(
      /más tarde/,
    );
    expect(onApplyMatrixPlan).not.toHaveBeenCalled();
  });

  test("el aviso no bloquea: se puede aplicar igual", () => {
    const { onApplyMatrixPlan } = renderConCalendario({
      calendar: calendarioCorto,
    });

    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar de todas formas" }));

    expect(onApplyMatrixPlan).toHaveBeenCalledTimes(1);
  });

  test("sin calendario se aplica directo, como hasta ahora", () => {
    const { onApplyMatrixPlan } = renderConCalendario();

    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(screen.queryByTestId("matrix-calendar-warning")).not.toBeInTheDocument();
    expect(onApplyMatrixPlan).toHaveBeenCalledTimes(1);
  });
});

describe("MatrixEditorView · borrar una ubicación no borra tareas a ciegas", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function planConTareas() {
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-borrar-area",
      name: "Matriz",
      startDate: "2026-01-05",
    });
    return { matrixPlan, tasks: generateScheduleFromMatrix(matrixPlan).tasks };
  }

  function renderParaBorrar(onRemoveArea?: jest.Mock) {
    const { matrixPlan, tasks } = planConTareas();
    render(
      <MatrixEditorView
        matrixPlan={matrixPlan}
        tasks={tasks}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
        onRemoveArea={onRemoveArea}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ubicaciones" }));
  }

  test("con tareas generadas, avisa y ofrece las dos salidas en vez de confirmar", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    renderParaBorrar(jest.fn());

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Piso 1" }));

    expect(screen.getByTestId("area-removal-choice")).toHaveTextContent(
      /tareas ya generadas en el cronograma/,
    );
    expect(
      screen.getByRole("button", { name: "Borrar también sus tareas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Conservarlas en el cronograma" }),
    ).toBeInTheDocument();
    expect(confirmar).not.toHaveBeenCalled();
  });

  test("borrar también las tareas se lo pide al proyecto, que sabe deshacer", () => {
    const onRemoveArea = jest.fn();
    renderParaBorrar(onRemoveArea);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Piso 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Borrar también sus tareas" }));

    expect(onRemoveArea).toHaveBeenCalledWith("piso-1", "borrar");
    expect(screen.queryByTestId("area-removal-choice")).not.toBeInTheDocument();
  });

  test("conservarlas en el cronograma también se lo pide al proyecto", () => {
    const onRemoveArea = jest.fn();
    renderParaBorrar(onRemoveArea);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Piso 1" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Conservarlas en el cronograma" }),
    );

    expect(onRemoveArea).toHaveBeenCalledWith("piso-1", "conservar");
  });

  test("sin tareas generadas se borra como siempre, con la confirmación de antes", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    const onRemoveArea = jest.fn();
    render(
      <MatrixEditorView
        matrixPlan={createDefaultMatrixPlan({
          id: "matrix-sin-tareas",
          name: "Matriz",
          startDate: "2026-01-05",
        })}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
        onRemoveArea={onRemoveArea}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ubicaciones" }));

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Piso 1" }));

    expect(confirmar).toHaveBeenCalled();
    expect(screen.queryByTestId("area-removal-choice")).not.toBeInTheDocument();
    expect(onRemoveArea).not.toHaveBeenCalled();
  });
});

describe("MatrixEditorView · deshacer dentro del editor (R1)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("borrar un alcance y deshacer devuelve el alcance y sus celdas", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const { plan } = renderEditor();
    const scopeId = plan.scopeTree[0].children![0].id;

    const celdasAntes = screen.getAllByTestId(/^matrix-cell-select-/).length;

    fireEvent.click(screen.getByRole("button", { name: "Alcances" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Estructura" }));
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));

    expect(
      screen.queryAllByTestId(`matrix-select-row-${scopeId}`),
    ).toHaveLength(0);

    fireEvent.keyDown(window, { key: "z", metaKey: true });

    expect(screen.getByTestId(`matrix-select-row-${scopeId}`)).toBeInTheDocument();
    expect(screen.getAllByTestId(/^matrix-cell-select-/)).toHaveLength(
      celdasAntes,
    );
  });

  test("rehacer vuelve a aplicar lo deshecho", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const { plan } = renderEditor();
    const scopeId = plan.scopeTree[0].children![0].id;

    fireEvent.click(screen.getByRole("button", { name: "Alcances" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Estructura" }));
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));

    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(screen.getByTestId(`matrix-select-row-${scopeId}`)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });

    expect(
      screen.queryAllByTestId(`matrix-select-row-${scopeId}`),
    ).toHaveLength(0);
  });

  test("sin nada que deshacer, el atajo no rompe el borrador", () => {
    const { plan } = renderEditor();
    const scopeId = plan.scopeTree[0].children![0].id;

    fireEvent.keyDown(window, { key: "z", metaKey: true });

    expect(screen.getByTestId(`matrix-select-row-${scopeId}`)).toBeInTheDocument();
  });

  test("N operaciones seguidas y un guardado producen UNA entrada en el historial general", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const { onApplyMatrixPlan } = renderEditor();

    // Dos mutaciones del borrador antes de aplicar.
    fireEvent.click(
      screen.getByRole("button", { name: /Activar todas las celdas/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(onApplyMatrixPlan).toHaveBeenCalledTimes(1);
  });
});

describe("MatrixEditorView · deshacer se puede ver, no solo teclear (R1)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("los botones existen y arrancan apagados", () => {
    renderEditor();

    expect(screen.getByTestId("matrix-undo")).toBeDisabled();
    expect(screen.getByTestId("matrix-redo")).toBeDisabled();
  });

  test("tras un cambio, deshacer se enciende y funciona con el ratón", () => {
    const { plan } = renderEditor();
    const scopeId = plan.scopeTree[0].children![0].id;
    jest.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(screen.getByRole("button", { name: "Alcances" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Estructura" }));
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));

    expect(screen.getByTestId("matrix-undo")).toBeEnabled();
    fireEvent.click(screen.getByTestId("matrix-undo"));

    expect(screen.getByTestId(`matrix-select-row-${scopeId}`)).toBeInTheDocument();
    expect(screen.getByTestId("matrix-redo")).toBeEnabled();
  });

  test("el botón dice el atajo, para que se aprenda", () => {
    renderEditor();

    expect(screen.getByTestId("matrix-undo")).toHaveAttribute(
      "title",
      expect.stringMatching(/Z/),
    );
  });
});

describe("MatrixEditorView · descartar de verdad (R1)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("al confirmar, el borrador vuelve al plan aplicado y la pila se vacía", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: /Activar todas las celdas/i }),
    );
    fireEvent.click(screen.getByTestId("matrix-discard"));

    // Sin esta prueba, la rama del «sí» no se ejecutaba en ningún test: los dos
    // que había respondían «no» o no tenían cambios, así que un fallo dentro de
    // `descartarCambios` pasaba desapercibido.
    expect(screen.queryByTestId("matrix-dirty")).not.toBeInTheDocument();
    expect(screen.getByTestId("matrix-undo")).toBeDisabled();
    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();
  });
});

describe("MatrixEditorView · la portada de la Matriz (R8)", () => {
  function renderVacio() {
    const onApplyMatrixPlan = jest.fn();
    render(
      <MatrixEditorView
        tasks={[]}
        onApplyMatrixPlan={onApplyMatrixPlan}
        onSyncFromGantt={jest.fn()}
      />,
    );
    return { onApplyMatrixPlan };
  }

  test("sin matriz, la puerta explica qué hay dentro en vez de pedir un clic a ciegas", () => {
    renderVacio();

    expect(screen.getByTestId("matrix-editor-empty")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-intro-benefits")).toBeInTheDocument();
    expect(screen.getByTestId("template-picker")).toBeInTheDocument();
  });

  test("elegir una plantilla de fábrica aterriza en la cuadrícula ya poblada", () => {
    renderVacio();

    const primera = screen
      .getByTestId("template-picker")
      .querySelectorAll("li button")[0];
    fireEvent.click(primera);

    // Un solo gesto: de la portada a la matriz con celdas, sin pasar por
    // «Crear matriz» y luego «Plantillas».
    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();
    expect(
      screen.getAllByTestId(/^matrix-cell-select-/).length,
    ).toBeGreaterThan(0);
  });

  test("crear en blanco sigue llevando a la matriz vacía de siempre", () => {
    renderVacio();

    fireEvent.click(screen.getByTestId("matrix-create-blank"));

    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();
  });
});

/**
 * «Generar matriz desde el cronograma» guardaba una propuesta que la propia
 * pantalla no pintaba nunca.
 *
 * `MatrixIntro` —la portada que R0 acababa de construir— llamaba a
 * `setProposal`, pero `ProposalReview` solo se pinta dentro de la rama que
 * exige `draft`, y el retorno temprano de «sin borrador» se dispara antes. El
 * usuario pulsaba y no pasaba nada. Y si después creaba una matriz en blanco,
 * aparecía un `ProposalReview` fantasma con la propuesta olvidada.
 */
describe("Generar matriz desde el cronograma cumple lo que promete", () => {
  function renderConTareas() {
    render(
      <MatrixEditorView
        tasks={cronogramaRepetido()}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );
  }

  test("al generar desde la portada, la propuesta se ve", () => {
    renderConTareas();

    fireEvent.click(
      screen.getByRole("button", { name: /generar matriz desde el cronograma/i }),
    );

    expect(screen.getByTestId("proposal-review")).toBeInTheDocument();
  });

  test("y la portada deja paso: no se quedan las dos a la vez", () => {
    renderConTareas();

    fireEvent.click(
      screen.getByRole("button", { name: /generar matriz desde el cronograma/i }),
    );

    expect(screen.queryByTestId("matrix-editor-empty")).not.toBeInTheDocument();
  });

  test("se puede volver atrás sin quedarse encerrado", () => {
    renderConTareas();

    fireEvent.click(
      screen.getByRole("button", { name: /generar matriz desde el cronograma/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar|descartar/i }));

    expect(screen.getByTestId("matrix-editor-empty")).toBeInTheDocument();
  });

  // El `ProposalReview` fantasma que motivó esto ya no se puede provocar: con la
  // rama nueva, mientras hay propuesta pendiente la portada no se pinta, así que
  // no hay botón de «crear en blanco» que pulsar. `createDraft` limpia la
  // propuesta igualmente, como defensa para el día que aparezca otro camino —y
  // por eso ninguna mutación de esa línea pone rojo a nadie: es inalcanzable
  // hoy, y conviene decirlo en vez de fingir que está cubierta.
  //
  // Lo que este test sí comprueba, y es alcanzable: tras descartar la
  // propuesta, crear en blanco entra limpio.
  test("tras descartar la propuesta, crear en blanco entra sin restos", () => {
    renderConTareas();

    // Se genera una propuesta, se vuelve atrás, y se crea en blanco.
    fireEvent.click(
      screen.getByRole("button", { name: /generar matriz desde el cronograma/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar|descartar/i }));
    fireEvent.click(screen.getByTestId("matrix-create-blank"));

    expect(screen.queryByTestId("proposal-review")).not.toBeInTheDocument();
  });
});

/**
 * «Guardar como plantilla» no guardaba nada en ninguna parte.
 *
 * `saveAsTemplate` solo hacía `setOwnTemplates(...)`: estado local de React. La
 * plantilla desaparecía al recargar, y `listMatrixTemplates` tampoco se llamaba
 * nunca, así que aunque se hubiera guardado no habría vuelto. El botón decía
 * «Guardar» y no había nada guardado: pérdida de trabajo disfrazada de éxito.
 *
 * Las dos acciones de servidor existían desde el principio, escritas y sin un
 * solo llamador.
 */
describe("Guardar como plantilla guarda de verdad", () => {
  beforeEach(() => {
    (saveMatrixTemplate as jest.Mock).mockClear();
    (listMatrixTemplates as jest.Mock).mockClear();
    (saveMatrixTemplate as jest.Mock).mockResolvedValue({ success: true, id: "t1" });
    (listMatrixTemplates as jest.Mock).mockResolvedValue([]);
  });

  test("al abrir, se piden las plantillas guardadas: si no, nunca vuelven", async () => {
    renderEditor();

    await waitFor(() => expect(listMatrixTemplates).toHaveBeenCalled());
  });

  test("guardar como plantilla llama al servidor, no solo a la memoria", async () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /plantillas/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /guardar como plantilla/i }),
    );

    await waitFor(() => expect(saveMatrixTemplate).toHaveBeenCalled());
  });

  test("si el servidor rechaza, se dice: no se finge que quedó guardada", async () => {
    (saveMatrixTemplate as jest.Mock).mockResolvedValue({
      success: false,
      error: "No tienes permisos para esta acción",
    });

    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /plantillas/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /guardar como plantilla/i }),
    );

    expect(
      await screen.findByTestId("matrix-template-error"),
    ).toHaveTextContent(/no tienes permisos/i);
  });
});
