/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import ProblemsView from "./ProblemsView";
import type { GanttTask } from "@/components/gantt/types";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";

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
    // Se busca dentro de la sección: con datos reales hay más de un encabezado
    // que contiene «conflictos», y una búsqueda global sería ambigua.
    expect(
      within(screen.getByTestId("problems-section-conflicts")).getByRole("heading", {
        name: /conflictos/i,
      }),
    ).toBeInTheDocument();
  });

  test("con problemas reales sigue mostrando las dos secciones sin ambigüedad", () => {
    const issues: ScheduleIssue[] = [
      {
        kind: "cycle",
        severity: "high",
        taskIds: [1, 2],
        message: "Las dependencias contienen un ciclo.",
      },
    ];
    const bottlenecks: Bottleneck[] = [
      {
        kind: "critical",
        severity: "high",
        taskIds: [1],
        metric: "Holgura: 0d",
        message: "Excavación está en la ruta crítica.",
      },
    ];

    render(
      <ProblemsView
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        issues={issues}
        bottlenecks={bottlenecks}
      />,
    );

    const cuellos = within(screen.getByTestId("problems-section-bottlenecks"));
    expect(cuellos.getByText(/está en la ruta crítica/i)).toBeInTheDocument();

    expect(screen.getByTestId("problems-section-conflicts")).toBeInTheDocument();
  });
});
