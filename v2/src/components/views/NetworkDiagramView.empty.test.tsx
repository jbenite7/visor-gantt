/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import NetworkDiagramView from "./NetworkDiagramView";

describe("Diagrama de Red · estado vacío que enseña", () => {
  test("sin tareas, la vista enseña qué hacer en vez de quedarse muda", () => {
    render(<NetworkDiagramView tasks={[]} />);

    const estado = screen.getByTestId("network-empty-state");
    expect(estado).toHaveTextContent(/importa un archivo/i);
    expect(estado).toHaveTextContent(/dos clics/i);
  });

  test("con tareas pero sin dependencias, explica cómo dibujar la primera", () => {
    render(
      <NetworkDiagramView
        tasks={[
          {
            id: 1,
            name: "Excavación",
            start: new Date(2026, 0, 1),
            finish: new Date(2026, 0, 5),
            duration: 5,
            progress: 0,
            isCritical: false,
            isMilestone: false,
            isSummary: false,
            outlineLevel: 1,
            dependencies: [],
          },
        ]}
        onCreateDependency={jest.fn()}
      />,
    );

    expect(screen.getByTestId("network-empty-state")).toHaveTextContent(
      /punto al costado/i,
    );
  });

  test("una vuelta clara al Gantt, sin inventar una entrada nueva en el menú", () => {
    const onNavigate = jest.fn();
    render(<NetworkDiagramView tasks={[]} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /volver al gantt/i }));

    expect(onNavigate).toHaveBeenCalledWith("gantt");
  });
});
