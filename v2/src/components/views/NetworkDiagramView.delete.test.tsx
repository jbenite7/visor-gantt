/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import NetworkDiagramView from "./NetworkDiagramView";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-05"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

function conDependencia(): GanttTask[] {
  return [
    task({ id: 1 }),
    task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
  ];
}

describe("NetworkDiagramView · borrar dependencias (A3)", () => {
  test("sin flecha seleccionada no hay botón de borrar", () => {
    render(<NetworkDiagramView tasks={conDependencia()} onDeleteDependency={jest.fn()} />);

    expect(screen.queryByTestId("network-delete-dependency")).not.toBeInTheDocument();
  });

  test("al elegir una flecha aparece el botón de borrar", () => {
    render(<NetworkDiagramView tasks={conDependencia()} onDeleteDependency={jest.fn()} />);

    fireEvent.click(screen.getByTestId("network-arrow"));

    expect(screen.getByTestId("network-delete-dependency")).toBeInTheDocument();
  });

  test("el botón borra la dependencia elegida", () => {
    const onDeleteDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={conDependencia()}
        onDeleteDependency={onDeleteDependency}
      />,
    );

    fireEvent.click(screen.getByTestId("network-arrow"));
    fireEvent.click(screen.getByTestId("network-delete-dependency"));

    expect(onDeleteDependency).toHaveBeenCalledWith({ from: 1, to: 2 });
  });

  test("la tecla Suprimir borra la flecha elegida", () => {
    const onDeleteDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={conDependencia()}
        onDeleteDependency={onDeleteDependency}
      />,
    );

    fireEvent.click(screen.getByTestId("network-arrow"));
    fireEvent.keyDown(window, { key: "Delete" });

    expect(onDeleteDependency).toHaveBeenCalledWith({ from: 1, to: 2 });
  });

  test("tras borrar, la selección se suelta", () => {
    render(
      <NetworkDiagramView tasks={conDependencia()} onDeleteDependency={jest.fn()} />,
    );

    fireEvent.click(screen.getByTestId("network-arrow"));
    fireEvent.click(screen.getByTestId("network-delete-dependency"));

    expect(screen.queryByTestId("network-delete-dependency")).not.toBeInTheDocument();
  });
});
