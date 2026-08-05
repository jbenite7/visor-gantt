/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { TaskBar, CriticalHatchDefs, CRITICAL_HATCH_ID } from "./index";
import type { GanttTask } from "@/components/gantt/types";

function task(overrides: Partial<GanttTask> = {}): GanttTask {
  return {
    id: 1,
    name: "Tarea",
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

function renderBar(t: GanttTask) {
  return render(
    <svg>
      <CriticalHatchDefs />
      <TaskBar task={t} x={0} y={0} width={100} height={24} color="var(--aia-corp-main)" />
    </svg>,
  );
}

describe("TaskBar — señal no cromática de ruta crítica (E39)", () => {
  test("una barra crítica lleva trama superpuesta además del color", () => {
    const { container } = renderBar(task({ isCritical: true }));
    const hatch = container.querySelector('[data-testid="task-bar-critical-hatch"]');
    expect(hatch).not.toBeNull();
    expect(hatch).toHaveAttribute("fill", `url(#${CRITICAL_HATCH_ID})`);
    expect(hatch).toHaveAttribute("stroke", "var(--aia-alert-dark)");
    // No debe robar los eventos de arrastre de la barra de abajo.
    expect(hatch).toHaveAttribute("pointer-events", "none");
  });

  test("una barra normal no lleva trama", () => {
    const { container } = renderBar(task({ isCritical: false }));
    expect(
      container.querySelector('[data-testid="task-bar-critical-hatch"]'),
    ).toBeNull();
  });

  test("el patrón existe en las defs del SVG", () => {
    const { container } = renderBar(task({ isCritical: true }));
    expect(container.querySelector(`pattern#${CRITICAL_HATCH_ID}`)).not.toBeNull();
  });
});
