/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ProblemsView from "./ProblemsView";
import type { GanttTask } from "@/components/gantt/types";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Tarea ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-09T17:00:00"),
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

describe("ProblemsView (C2: Cuellos + Conflictos en una vista)", () => {
  test("muestra las dos secciones en una sola pantalla", () => {
    render(<ProblemsView tasks={[task({ id: 1 })]} issues={[]} bottlenecks={[]} />);

    expect(screen.getByTestId("problems-section-bottlenecks")).toBeInTheDocument();
    expect(screen.getByTestId("problems-section-conflicts")).toBeInTheDocument();
  });

  test("cada sección lleva su encabezado en español", () => {
    render(<ProblemsView tasks={[task({ id: 1 })]} issues={[]} bottlenecks={[]} />);

    expect(
      screen.getByRole("heading", { name: /cuellos de botella/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /conflictos/i })).toBeInTheDocument();
  });
});
