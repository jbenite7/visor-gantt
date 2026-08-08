/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ResourceUsageView from "./ResourceUsageView";
import type { Resource, Assignment } from "@/types/resource";
import type { GanttTask } from "@/components/gantt/types";
import { detectOverallocation } from "@/lib/scheduling/assignments";

const recursos: Resource[] = [
  { uid: 1, name: "Cuadrilla 2", type: "work", rate: 20, availability: 100 },
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

const sobrecarga: Assignment[] = [
  { taskId: 1, resourceId: 1, units: 100, cost: 0 },
  { taskId: 2, resourceId: 1, units: 100, cost: 0 },
];

describe("Uso de Recursos y Problemas no se contradicen (M18)", () => {
  test("marca sobreasignado lo que Problemas también marca", () => {
    // Problemas detecta esta sobrecarga con el umbral diario.
    expect(
      detectOverallocation(sobrecarga, recursos, tareas).some(
        (r) => r.isOverallocated,
      ),
    ).toBe(true);

    render(
      <ResourceUsageView
        resources={recursos}
        tasks={tareas}
        assignments={sobrecarga}
      />,
    );

    expect(
      screen.getAllByTestId("usage-cell").filter(
        (cell) => cell.getAttribute("data-overallocated") === "true",
      ).length,
    ).toBeGreaterThan(0);
  });

  test("una carga que cabe no se marca", () => {
    render(
      <ResourceUsageView
        resources={recursos}
        tasks={tareas}
        assignments={[{ taskId: 1, resourceId: 1, units: 50, cost: 0 }]}
      />,
    );

    expect(
      screen.getAllByTestId("usage-cell").filter(
        (cell) => cell.getAttribute("data-overallocated") === "true",
      ),
    ).toHaveLength(0);
  });
});
