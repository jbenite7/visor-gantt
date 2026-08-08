/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import AssignmentSheetView from "./AssignmentSheetView";
import type { Assignment, Resource } from "@/types/resource";
import type { GanttTask } from "@/components/gantt/types";

const recursos: Resource[] = [
  { uid: 1, name: "Cuadrilla 2", type: "work", rate: 20, availability: 100 },
  { uid: 2, name: "Retroexcavadora", type: "work", rate: 90, availability: 100 },
];

const tareas: GanttTask[] = [1, 2].map((id) => ({
  id,
  name: `Actividad ${id}`,
  start: new Date("2026-01-05"),
  finish: new Date("2026-01-09"),
  duration: 5,
  progress: 0,
  isCritical: false,
  isMilestone: false,
  isSummary: false,
  outlineLevel: 1,
  dependencies: [],
}));

const yaOcupada: Assignment[] = [
  { taskId: 1, resourceId: 1, units: 100, cost: 0 },
];

describe("armar el proyecto en la app también se puede (M14)", () => {
  test("se puede crear una asignación desde la hoja", () => {
    const onCreateAssignment = jest.fn();
    render(
      <AssignmentSheetView
        assignments={[]}
        tasks={tareas}
        resources={recursos}
        onCreateAssignment={onCreateAssignment}
      />,
    );

    fireEvent.click(screen.getByTestId("assignment-add"));
    fireEvent.change(screen.getByTestId("assignment-task"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("assignment-resource"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTestId("assignment-confirm"));

    expect(onCreateAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 2, resourceId: 1 }),
    );
  });

  test("sin forma de crear, la hoja no promete un botón que no hace nada", () => {
    render(
      <AssignmentSheetView
        assignments={yaOcupada}
        tasks={tareas}
        resources={recursos}
      />,
    );

    expect(screen.queryByTestId("assignment-add")).not.toBeInTheDocument();
  });

  test("borrar una asignación pide confirmación", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleteAssignment = jest.fn();
    render(
      <AssignmentSheetView
        assignments={yaOcupada}
        tasks={tareas}
        resources={recursos}
        onDeleteAssignment={onDeleteAssignment}
      />,
    );

    fireEvent.click(screen.getAllByTestId("assignment-delete")[0]);

    expect(confirmar).toHaveBeenCalled();
    expect(onDeleteAssignment).toHaveBeenCalledWith(yaOcupada[0]);
    confirmar.mockRestore();
  });

  test("si el usuario dice que no, la asignación se queda", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(false);
    const onDeleteAssignment = jest.fn();
    render(
      <AssignmentSheetView
        assignments={yaOcupada}
        tasks={tareas}
        resources={recursos}
        onDeleteAssignment={onDeleteAssignment}
      />,
    );

    fireEvent.click(screen.getAllByTestId("assignment-delete")[0]);

    expect(onDeleteAssignment).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });
});

describe("la sobrecarga se ve aquí, sin ir a Problemas (M19)", () => {
  test("crear una que sobrecargue avisa antes, no después", () => {
    render(
      <AssignmentSheetView
        assignments={yaOcupada}
        tasks={tareas}
        resources={recursos}
        onCreateAssignment={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("assignment-add"));
    fireEvent.change(screen.getByTestId("assignment-task"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("assignment-resource"), {
      target: { value: "1" },
    });

    expect(screen.getByTestId("assignment-overload-warning")).toHaveTextContent(
      /sobrecarg/i,
    );
  });

  test("una que cabe no asusta al usuario sin motivo", () => {
    render(
      <AssignmentSheetView
        assignments={yaOcupada}
        tasks={tareas}
        resources={recursos}
        onCreateAssignment={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("assignment-add"));
    fireEvent.change(screen.getByTestId("assignment-task"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("assignment-resource"), {
      target: { value: "2" },
    });

    expect(
      screen.queryByTestId("assignment-overload-warning"),
    ).not.toBeInTheDocument();
  });

  test("las filas ya sobrecargadas se marcan en la propia hoja", () => {
    render(
      <AssignmentSheetView
        assignments={[
          ...yaOcupada,
          { taskId: 2, resourceId: 1, units: 100, cost: 0 },
        ]}
        tasks={tareas}
        resources={recursos}
      />,
    );

    expect(screen.getAllByTestId("assignment-overloaded").length).toBeGreaterThan(
      0,
    );
  });
});

describe("la tabla no se descuadra al poder borrar (M14)", () => {
  test("la columna Quitar tiene su encabezado", () => {
    render(
      <AssignmentSheetView
        assignments={yaOcupada}
        tasks={tareas}
        resources={recursos}
        onDeleteAssignment={jest.fn()}
      />,
    );

    const encabezados = screen.getAllByRole("columnheader").length;
    const celdas = screen
      .getAllByTestId("assignment-delete")[0]
      .closest("tr")!
      .querySelectorAll("td").length;

    expect(celdas).toBe(encabezados);
  });

  test("sin poder borrar, ni encabezado ni celda de más", () => {
    render(
      <AssignmentSheetView
        assignments={yaOcupada}
        tasks={tareas}
        resources={recursos}
      />,
    );

    const encabezados = screen.getAllByRole("columnheader").length;
    const celdas = screen
      .getAllByRole("row")[1]
      .querySelectorAll("td").length;

    expect(celdas).toBe(encabezados);
  });
});
