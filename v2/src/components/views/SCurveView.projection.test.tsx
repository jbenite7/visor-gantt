/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import SCurveView from "./SCurveView";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

function obraConAvance(): GanttTask[] {
  return [
    task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: 100 }),
    task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: 100 }),
    task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
    task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
  ];
}

function obraConAvanceMinusculo(): GanttTask[] {
  // 0.1% de avance en 1000 días de obra: el ritmo es tan bajo que la fecha
  // proyectada cae siglos hacia adelante, un futuro absurdamente lejano.
  return [
    task({
      id: 1,
      start: createProjectDate("2018-01-01"),
      finish: createProjectDate("2020-09-27"),
      duration: 1000,
      progress: 0.1,
    }),
  ];
}

function abrirProyeccion() {
  fireEvent.click(screen.getByRole("button", { name: "Proyección" }));
}

describe("SCurveView · sub-vista Proyección (A1)", () => {
  test("con avance suficiente muestra las tres fechas proyectadas", () => {
    render(
      <SCurveView
        tasks={obraConAvance()}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2026-01-20"
      />,
    );

    abrirProyeccion();

    expect(screen.getByTestId("s-curve-projection")).toBeInTheDocument();
    const fechas = screen.getByTestId("s-curve-projection-dates");
    expect(fechas).toHaveTextContent("Optimista");
    expect(fechas).toHaveTextContent("Probable");
    expect(fechas).toHaveTextContent("Pesimista");
    expect(fechas).toHaveTextContent("09/02/2026");
  });

  test("sin avance registrado la vista dice qué falta en vez de mostrar una línea plana", () => {
    render(
      <SCurveView
        tasks={obraConAvance().map((t) => ({ ...t, progress: 0 }))}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2026-01-20"
      />,
    );

    abrirProyeccion();

    expect(screen.queryByTestId("s-curve-projection-dates")).not.toBeInTheDocument();
    expect(screen.getByTestId("s-curve-projection-empty")).toHaveTextContent(
      /porcentaje ejecutado/i,
    );
  });

  test("sin cronograma la vista invita a importar en vez de quedarse en blanco", () => {
    render(
      <SCurveView tasks={[]} budgetMappings={[]} budgetItems={[]} statusDate="2026-01-20" />,
    );

    abrirProyeccion();

    expect(screen.getByTestId("s-curve-projection-empty")).toHaveTextContent(
      /Microsoft Project/i,
    );
  });

  test("con un ritmo minúsculo la vista dice que la obra no tiene fin previsible en vez de una fecha absurda", () => {
    render(
      <SCurveView
        tasks={obraConAvanceMinusculo()}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2020-09-27"
      />,
    );

    abrirProyeccion();

    expect(screen.queryByTestId("s-curve-projection-dates")).not.toBeInTheDocument();
    expect(screen.getByTestId("s-curve-projection-empty")).toHaveTextContent(
      /no tiene fin previsible|ritmo actual/i,
    );
  });
});
