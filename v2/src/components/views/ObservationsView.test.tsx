/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ObservationsView from "./ObservationsView";
import type { Observation } from "@/lib/observations/observations";

function obs(
  id: number,
  text: string,
  status: Observation["status"] = "pending",
): Observation {
  return {
    id: `obs-${id}`,
    taskId: id,
    taskName: `Actividad ${id}`,
    text,
    status,
    createdAt: "2026-08-07T08:00:00.000Z",
  };
}

describe("todas las observaciones del proyecto en un sitio", () => {
  test("lista las de todas las actividades, no solo las de una", () => {
    render(
      <ObservationsView
        observations={[obs(1, "Falta acero"), obs(2, "Falta andamio")]}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText("Falta acero")).toBeInTheDocument();
    expect(screen.getByText("Falta andamio")).toBeInTheDocument();
  });

  test("dice de qué actividad es cada una", () => {
    render(
      <ObservationsView
        observations={[obs(1, "Falta acero")]}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText(/Actividad 1/)).toBeInTheDocument();
  });

  test("separa lo pendiente de lo atendido", () => {
    render(
      <ObservationsView
        observations={[obs(1, "Falta acero"), obs(2, "Ya se resolvió", "done")]}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(
      within(screen.getByTestId("observations-pending")).getByText("Falta acero"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("observations-done")).getByText("Ya se resolvió"),
    ).toBeInTheDocument();
  });

  test("atender una desde aquí avisa al proyecto", () => {
    const onToggle = jest.fn();
    render(
      <ObservationsView
        observations={[obs(1, "Falta acero")]}
        onToggle={onToggle}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("observation-toggle-obs-1"));

    expect(onToggle).toHaveBeenCalledWith("obs-1");
  });

  test("sin observaciones explica el loop, con un ejemplo de obra", () => {
    render(
      <ObservationsView
        observations={[]}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("observations-empty")).toHaveTextContent(
      /acero|eje/i,
    );
  });

  test("se puede exportar el registro completo, que para eso existe", () => {
    render(
      <ObservationsView
        observations={[obs(1, "Falta acero")]}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("observations-export-lps")).toBeInTheDocument();
    expect(screen.getByTestId("observations-export-csv")).toBeInTheDocument();
  });

  test("muestra el responsable cuando lo hay", () => {
    render(
      <ObservationsView
        observations={[{ ...obs(1, "Falta acero"), responsible: "Cuadrilla 2" }]}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText(/Cuadrilla 2/)).toBeInTheDocument();
  });
});
