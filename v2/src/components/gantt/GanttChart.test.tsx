/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import GanttChart from "./GanttChart";
import type { GanttTask } from "./types";

function task(
  overrides: Partial<GanttTask> & { id: string | number },
): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05"),
    finish: new Date("2026-01-05"),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("GanttChart labels", () => {
  test("renders dependency arrows below the final labels layer", () => {
    const tasks = [
      task({ id: 1, name: "Short", finish: new Date("2026-01-06") }),
      task({
        id: 2,
        name: "Successor",
        start: new Date("2026-01-07"),
        finish: new Date("2026-01-07"),
        dependencies: [{ from: 1, to: 2, type: "FS" }],
      }),
    ];

    const { container } = render(<GanttChart tasks={tasks} />);

    const dependencies = container.querySelector("g.dependencies");
    const labels = container.querySelector("g.labels");
    expect(dependencies).toBeInTheDocument();
    expect(labels).toBeInTheDocument();
    expect(dependencies!.compareDocumentPosition(labels!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("renders summary labels as chips outside the summary line", () => {
    const { container } = render(
      <GanttChart
        tasks={[
          task({
            id: 1,
            name: "CAPÍTULO 1: PRELIMINARES",
            isSummary: true,
            finish: new Date("2026-01-20"),
          }),
        ]}
      />,
    );

    expect(screen.getByTestId("summary-label-chip")).toHaveTextContent(
      "CAPÍTULO 1: PRELIMINARES",
    );
    const summaryLine = container.querySelector("[data-testid='summary-line']");
    expect(Number(summaryLine?.getAttribute("x1"))).toBeGreaterThan(0);
  });

  test("moves short task labels outside the bar with a tooltip", () => {
    render(
      <GanttChart
        tasks={[
          task({
            id: 1,
            name: "Trazo y nivelación",
            finish: new Date("2026-01-05"),
          }),
        ]}
      />,
    );

    const label = screen.getByTestId("task-label-outside");
    expect(label).toHaveTextContent("Trazo y nivelación");
    expect(label.querySelector("title")).toHaveTextContent(
      "Trazo y nivelación",
    );
  });

  test("renders milestone labels outside with a readable halo", () => {
    render(
      <GanttChart
        tasks={[
          task({
            id: 1,
            name: "ITO: Inicio de obra",
            isMilestone: true,
            duration: 0,
          }),
        ]}
      />,
    );

    const label = screen.getByTestId("milestone-label-outside");
    expect(label).toHaveTextContent("ITO: Inicio de obra");
    expect(label.querySelector("rect")).toBeInTheDocument();
  });

  test("shades project non-working days from the configured calendar", () => {
    const { container } = render(
      <GanttChart
        tasks={[
          task({
            id: 1,
            start: new Date("2026-01-09T08:00:00"),
            finish: new Date("2026-01-12T08:00:00"),
          }),
        ]}
        calendar={{
          ...DEFAULT_PROJECT_CALENDAR,
          workDays: [1, 2, 3, 4, 5],
        }}
      />,
    );

    expect(
      container.querySelector("[data-non-working-date='2026-01-10']"),
    ).toBeInTheDocument();
  });
});

describe("comparación con la línea base en el Gantt principal (M13)", () => {
  const withBaseline = task({
    id: 1,
    name: "Excavación",
    start: new Date("2026-01-08"),
    finish: new Date("2026-01-12"),
    baselineStart: new Date("2026-01-05"),
    baselineFinish: new Date("2026-01-09"),
    baselineDuration: 5,
  });

  test("sin activar la comparación no se dibuja nada nuevo", () => {
    const { container } = render(<GanttChart tasks={[withBaseline]} />);

    expect(container.querySelector("g.baseline-bars")).not.toBeInTheDocument();
  });

  test("con la comparación activa dibuja una barra fantasma por tarea", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline]} showBaseline />,
    );

    const layer = container.querySelector("g.baseline-bars");
    expect(layer).toBeInTheDocument();
    expect(layer!.querySelectorAll("rect")).toHaveLength(1);
  });

  test("la barra fantasma va detrás de la barra real", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline]} showBaseline />,
    );

    const baseline = container.querySelector("g.baseline-bars");
    const tasks = container.querySelector("g.tasks");
    expect(baseline!.compareDocumentPosition(tasks!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("una tarea sin línea base no aporta barra fantasma", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline, task({ id: 2 })]} showBaseline />,
    );

    expect(container.querySelectorAll("g.baseline-bars rect")).toHaveLength(1);
  });

  test("la barra fantasma ocupa las fechas de la línea base, no las reales", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline]} showBaseline />,
    );

    const ghost = container.querySelector<SVGRectElement>(
      "g.baseline-bars rect",
    )!;
    const real = container.querySelector<SVGRectElement>(
      'g.tasks [data-testid="task-bar"]',
    );

    // La línea base empieza 3 días antes que lo real: queda a la izquierda.
    expect(Number(ghost.getAttribute("x"))).toBeLessThan(
      Number(real?.getAttribute("x") ?? Number.POSITIVE_INFINITY),
    );
  });
});

describe("el arrastre de dependencias dice qué va a crear (E35)", () => {
  // jsdom no implementa la geometría SVG; el gesto sí existe en el navegador.
  beforeAll(() => {
    const proto = window.SVGSVGElement.prototype as unknown as {
      createSVGPoint: () => { x: number; y: number; matrixTransform: () => { x: number; y: number } };
      getScreenCTM: () => { inverse: () => unknown };
    };
    proto.createSVGPoint = () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: 120, y: 40 }),
    });
    proto.getScreenCTM = () => ({ inverse: () => ({}) });
  });

  const dosTareas = [
    task({ id: 1, name: "Excavación", finish: new Date("2026-01-08") }),
    task({
      id: 2,
      name: "Cimentación",
      start: new Date("2026-01-09"),
      finish: new Date("2026-01-12"),
    }),
  ];

  test("sin arrastre no hay etiqueta de tipo", () => {
    render(<GanttChart tasks={dosTareas} onCreateDependency={jest.fn()} />);

    expect(screen.queryByTestId("dep-preview-type")).not.toBeInTheDocument();
  });

  test("al arrastrar desde el fin, anuncia el tipo y su nombre en obra", () => {
    render(<GanttChart tasks={dosTareas} onCreateDependency={jest.fn()} />);

    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[0]);
    fireEvent.mouseDown(screen.getByTestId("dep-point-right"));

    const etiqueta = screen.getByTestId("dep-preview-type");
    expect(etiqueta).toHaveTextContent("FS");
    expect(etiqueta).toHaveTextContent(/fin a inicio/i);
  });

  test("si el puntero se posa sobre el fin del destino, anuncia FF, no FS", () => {
    render(<GanttChart tasks={dosTareas} onCreateDependency={jest.fn()} />);

    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[0]);
    fireEvent.mouseDown(screen.getByTestId("dep-point-right"));

    // La segunda barra muestra sus puntos porque el arrastre está en curso.
    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[1]);
    fireEvent.mouseEnter(screen.getAllByTestId("dep-point-right")[1]);

    const etiqueta = screen.getByTestId("dep-preview-type");
    expect(etiqueta).toHaveTextContent("FF");
    expect(etiqueta).toHaveTextContent(/fin a fin/i);
  });

  test("soltar sobre el fin del destino crea un vínculo FF, que antes era inalcanzable", () => {
    const onCreateDependency = jest.fn();
    render(
      <GanttChart tasks={dosTareas} onCreateDependency={onCreateDependency} />,
    );

    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[0]);
    fireEvent.mouseDown(screen.getByTestId("dep-point-right"));
    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[1]);
    fireEvent.mouseUp(screen.getAllByTestId("dep-point-right")[1]);

    expect(onCreateDependency).toHaveBeenCalledWith(1, 2, "FF");
  });
});
