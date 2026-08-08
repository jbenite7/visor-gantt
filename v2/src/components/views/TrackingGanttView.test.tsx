/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import TrackingGanttView from "./TrackingGanttView";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Tarea ${overrides.id}`,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate("2026-01-10"),
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

const baseline = {
  id: "bl-1",
  name: "Antes de la lluvia",
  createdAt: new Date("2026-08-01"),
  tasks: [
    {
      taskId: 1,
      baselineStart: createProjectDate("2026-01-05"),
      baselineFinish: createProjectDate("2026-01-08"),
      baselineDuration: 3,
    },
  ],
};

describe("Seguimiento usa las líneas base del proyecto (M13)", () => {
  test("muestra las líneas base que le llegan, sin guardar ninguna antes", () => {
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[baseline]}
        activeBaselineId="bl-1"
        onSaveBaseline={jest.fn()}
        onSelectBaseline={jest.fn()}
      />,
    );

    expect(screen.getByTestId("baseline-select")).toHaveValue("bl-1");
    expect(screen.getByText("Antes de la lluvia")).toBeInTheDocument();
  });

  test("guardar avisa al proyecto en vez de guardarse una copia propia", () => {
    const onSaveBaseline = jest.fn();
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[]}
        onSaveBaseline={onSaveBaseline}
        onSelectBaseline={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("save-baseline-btn"));

    expect(onSaveBaseline).toHaveBeenCalledTimes(1);
    // Sin líneas base previas, el nombre propuesto es el primero.
    expect(onSaveBaseline).toHaveBeenCalledWith("Línea base 1");
  });

  test("cambiar la selección avisa al proyecto", () => {
    const onSelectBaseline = jest.fn();
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[baseline]}
        onSaveBaseline={jest.fn()}
        onSelectBaseline={onSelectBaseline}
      />,
    );

    fireEvent.change(screen.getByTestId("baseline-select"), {
      target: { value: "bl-1" },
    });

    expect(onSelectBaseline).toHaveBeenCalledWith("bl-1");
  });

  test("la sub-barra habla español", () => {
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[baseline]}
        activeBaselineId="bl-1"
        onSaveBaseline={jest.fn()}
        onSelectBaseline={jest.fn()}
      />,
    );

    expect(screen.getByTestId("save-baseline-btn")).toHaveTextContent(
      "Guardar línea base",
    );
    expect(screen.queryByText(/Save Baseline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/behind/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("baseline-variance-summary")).toHaveTextContent(
      /atrasada|adelantada|en fecha/i,
    );
  });

  test("dibuja la comparación cuando hay una línea base activa", () => {
    const { container } = render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[baseline]}
        activeBaselineId="bl-1"
        onSaveBaseline={jest.fn()}
        onSelectBaseline={jest.fn()}
      />,
    );

    expect(container.querySelector("g.baseline-bars")).toBeInTheDocument();
  });
});
