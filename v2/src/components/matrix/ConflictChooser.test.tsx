/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ConflictChooser from "./ConflictChooser";
import type { MatrixSyncConflict } from "@/types/matrix";

const conflictos: MatrixSyncConflict[] = [
  {
    taskId: "mx-task-c1-columnas",
    cellId: "c1",
    field: "name",
    matrixValue: "Columnas · Piso 1",
    ganttValue: "Columnas piso 1 (revisadas)",
    message: "«Columnas · Piso 1» se renombró a «Columnas piso 1 (revisadas)» desde el Gantt.",
  },
  {
    taskId: "mx-task-c1-columnas",
    cellId: "c1",
    field: "duration",
    matrixValue: "5",
    ganttValue: "8",
    message: "La duración pasó de 5 a 8 días desde el Gantt.",
  },
];

describe("ConflictChooser", () => {
  test("sin conflictos no dibuja nada", () => {
    const { container } = render(
      <ConflictChooser conflicts={[]} onResolve={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("muestra las dos versiones de cada conflicto", () => {
    render(
      <ConflictChooser conflicts={conflictos} onResolve={jest.fn()} onCancel={jest.fn()} />,
    );

    const fila = screen.getByTestId("conflict-mx-task-c1-columnas-name");
    expect(fila).toHaveTextContent("Columnas · Piso 1");
    expect(fila).toHaveTextContent("Columnas piso 1 (revisadas)");
  });

  test("por defecto gana la matriz, y lo dice", () => {
    const onResolve = jest.fn();
    render(
      <ConflictChooser conflicts={conflictos} onResolve={onResolve} onCancel={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    expect(onResolve).toHaveBeenCalledWith({
      "mx-task-c1-columnas::name": "matriz",
      "mx-task-c1-columnas::duration": "matriz",
    });
  });

  test("elegir el Gantt en un conflicto solo cambia ese", () => {
    const onResolve = jest.fn();
    render(
      <ConflictChooser conflicts={conflictos} onResolve={onResolve} onCancel={jest.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("radio", {
        name: "Conservar lo del Gantt en el nombre de mx-task-c1-columnas",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    expect(onResolve).toHaveBeenCalledWith({
      "mx-task-c1-columnas::name": "gantt",
      "mx-task-c1-columnas::duration": "matriz",
    });
  });

  test("el horario de una tarea se decide de una vez, aunque tenga varios campos en conflicto", () => {
    const onResolve = jest.fn();
    const conflictosConHorario: MatrixSyncConflict[] = [
      ...conflictos,
      {
        taskId: "mx-task-c1-columnas",
        cellId: "c1",
        field: "start",
        matrixValue: "2026-08-10",
        ganttValue: "2026-08-12",
        message: "El inicio pasó del 2026-08-10 al 2026-08-12 desde el Gantt.",
      },
    ];
    render(
      <ConflictChooser
        conflicts={conflictosConHorario}
        onResolve={onResolve}
        onCancel={jest.fn()}
      />,
    );

    const fila = screen.getByTestId("conflict-mx-task-c1-columnas-schedule");
    expect(fila).toHaveTextContent("5 → 8");
    expect(fila).toHaveTextContent("2026-08-10 → 2026-08-12");

    fireEvent.click(
      screen.getByRole("radio", {
        name: "Conservar lo del Gantt en el horario de mx-task-c1-columnas",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    expect(onResolve).toHaveBeenCalledWith({
      "mx-task-c1-columnas::name": "matriz",
      "mx-task-c1-columnas::duration": "gantt",
      "mx-task-c1-columnas::start": "gantt",
    });
  });

  test("una lista de conflictos nueva no congela el estado: el conflicto nuevo parte de la matriz", () => {
    const onResolve = jest.fn();
    const { rerender } = render(
      <ConflictChooser conflicts={conflictos} onResolve={onResolve} onCancel={jest.fn()} />,
    );

    const conflictosNuevos: MatrixSyncConflict[] = [
      {
        taskId: "mx-task-c2-vigas",
        cellId: "c2",
        field: "name",
        matrixValue: "Vigas · Piso 1",
        ganttValue: "Vigas piso 1 (revisadas)",
        message: "«Vigas · Piso 1» se renombró a «Vigas piso 1 (revisadas)» desde el Gantt.",
      },
    ];

    rerender(
      <ConflictChooser
        conflicts={conflictosNuevos}
        onResolve={onResolve}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    expect(onResolve).toHaveBeenCalledWith({
      "mx-task-c2-vigas::name": "matriz",
    });
  });

  test("dice cuántos conflictos hay antes de pedir decidir", () => {
    render(
      <ConflictChooser conflicts={conflictos} onResolve={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.getByTestId("conflict-summary")).toHaveTextContent(
      "2 cambios hechos en el Gantt chocan con la matriz. Elige cuál gana en cada uno.",
    );
  });

  test("cancelar no aplica nada", () => {
    const onCancel = jest.fn();
    const onResolve = jest.fn();
    render(
      <ConflictChooser conflicts={conflictos} onResolve={onResolve} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "No aplicar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onResolve).not.toHaveBeenCalled();
  });
});
