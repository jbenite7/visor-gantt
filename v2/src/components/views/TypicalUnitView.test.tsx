/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import TypicalUnitView from "./TypicalUnitView";

function task(overrides: Partial<GanttTask>): GanttTask {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? "Task",
    start: overrides.start ?? new Date("2026-01-01T08:00:00"),
    finish: overrides.finish ?? new Date("2026-01-02T17:00:00"),
    duration: overrides.duration ?? 2,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: overrides.outlineLevel ?? 1,
    dependencies: [],
    wbs: overrides.wbs,
  };
}

describe("TypicalUnitView", () => {
  test("renderiza el badge de familia cuando el grupo tiene familia clasificada", () => {
    render(
      <TypicalUnitView
        tasks={[
          task({ id: 1, name: "Instalacion hidraulica piso 1", wbs: "1.1" }),
          task({ id: 2, name: "Instalacion hidraulica piso 2", wbs: "1.2" }),
          task({ id: 3, name: "Instalacion hidraulica piso 3", wbs: "1.3" }),
        ]}
      />,
    );

    expect(screen.getByTestId("typical-unit-family-badge")).toHaveTextContent("Redes MEP");
  });

  test("muestra el indicador de revision cuando el grupo trae reviewReason", () => {
    render(
      <TypicalUnitView
        tasks={[
          task({ id: 1, name: "Piso 1" }),
          task({ id: 2, name: "Piso 2" }),
          task({ id: 3, name: "Piso 3" }),
        ]}
      />,
    );

    expect(screen.queryByTestId("typical-unit-family-badge")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "El nombre solo contiene una referencia de ubicacion. Falta clasificacion por WBS o capitulo.",
      ),
    ).toBeInTheDocument();
  });
});
