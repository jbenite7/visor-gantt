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

function conector(taskId: string | number): HTMLElement {
  return screen
    .getAllByTestId("network-connector")
    .find((element) => element.getAttribute("data-task-id") === String(taskId))!;
}

function nodo(taskId: string | number): HTMLElement {
  return screen
    .getAllByTestId("network-node")
    .find((element) => element.getAttribute("data-task-id") === String(taskId))!;
}

describe("NetworkDiagramView · dibujar dependencias (A3)", () => {
  test("cada nodo ofrece un conector para empezar la flecha", () => {
    render(<NetworkDiagramView tasks={[task({ id: 1 }), task({ id: 2 })]} />);

    expect(screen.getAllByTestId("network-connector")).toHaveLength(2);
  });

  test("conector del origen y clic en el destino crean la dependencia", () => {
    const onCreateDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        onCreateDependency={onCreateDependency}
      />,
    );

    fireEvent.click(conector(1));
    fireEvent.click(nodo(2));

    expect(onCreateDependency).toHaveBeenCalledWith(1, 2, "FS");
  });

  test("mientras se dibuja, la vista dice qué falta hacer", () => {
    render(<NetworkDiagramView tasks={[task({ id: 1 }), task({ id: 2 })]} />);

    fireEvent.click(conector(1));

    expect(screen.getByTestId("network-connect-hint")).toHaveTextContent(
      /elige la actividad que va después/i,
    );
  });

  test("una flecha que cerraría un ciclo se rechaza con su motivo y no se crea", () => {
    const onCreateDependency = jest.fn();
    const onRejectEdit = jest.fn();

    render(
      <NetworkDiagramView
        tasks={[
          task({ id: 1 }),
          task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
        ]}
        onCreateDependency={onCreateDependency}
        onRejectEdit={onRejectEdit}
      />,
    );

    fireEvent.click(conector(2));
    fireEvent.click(nodo(1));

    expect(onCreateDependency).not.toHaveBeenCalled();
    expect(onRejectEdit).toHaveBeenCalledWith(expect.stringMatching(/ciclo/i));
  });

  test("Escape cancela el dibujo a medias", () => {
    const onCreateDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        onCreateDependency={onCreateDependency}
      />,
    );

    fireEvent.click(conector(1));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(nodo(2));

    expect(onCreateDependency).not.toHaveBeenCalled();
    expect(screen.queryByTestId("network-connect-hint")).not.toBeInTheDocument();
  });

  test("sin manejador de creación, seleccionar un nodo sigue funcionando como antes", () => {
    const onTaskClick = jest.fn();

    render(<NetworkDiagramView tasks={[task({ id: 1 })]} onTaskClick={onTaskClick} />);

    fireEvent.click(nodo(1));

    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
