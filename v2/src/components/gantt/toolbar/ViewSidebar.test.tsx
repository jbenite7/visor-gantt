/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ViewSidebar from "./ViewSidebar";

describe("ViewSidebar tras el recorte (C1-C5)", () => {
  test("muestra 11 vistas: las 9 del recorte, la Matriz que vuelve y Observaciones", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);
    expect(screen.getAllByRole("tab")).toHaveLength(11);
  });

  test("las vistas absorbidas ya no son entradas del menú", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.queryByTestId("sidebar-view-tracking")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-taskSheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-conflictos")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-network")).not.toBeInTheDocument();
    // La Matriz vuelve al menú (M27): ver el describe de abajo.
  });

  test("las vistas que se quedan siguen accesibles", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    for (const id of [
      "gantt",
      "executive",
      "resources",
      "lob",
      "scurve",
      "bottlenecks",
      "unidadTipica",
      "calendario",
      "settings",
    ]) {
      expect(screen.getByTestId(`sidebar-view-${id}`)).toBeInTheDocument();
    }
  });

  test("«Cuellos» pasa a llamarse «Problemas» porque ahora incluye los conflictos", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);
    expect(screen.getByTestId("sidebar-view-bottlenecks")).toHaveTextContent(
      /problemas/i,
    );
  });
});

describe("el menú se puede recorrer sin conocer atajos (E14, M27)", () => {
  test("la Matriz está en el menú, no solo tras ⌘K", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.getByTestId("sidebar-view-matrix")).toBeInTheDocument();
  });

  test("las vistas están agrupadas por intención, con títulos", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.getByText("Trabajo")).toBeInTheDocument();
    expect(screen.getByText("Análisis")).toBeInTheDocument();
    expect(screen.getByText("Ajustes")).toBeInTheDocument();
  });

  test("la Matriz vive en Trabajo, junto al Gantt", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    const trabajo = screen.getByTestId("sidebar-group-trabajo");
    expect(within(trabajo).getByTestId("sidebar-view-matrix")).toBeInTheDocument();
    expect(within(trabajo).getByTestId("sidebar-view-gantt")).toBeInTheDocument();
  });

  test("el análisis vive aparte del trabajo del día", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    const analisis = screen.getByTestId("sidebar-group-analisis");
    expect(within(analisis).getByTestId("sidebar-view-scurve")).toBeInTheDocument();
    expect(
      within(analisis).getByTestId("sidebar-view-executive"),
    ).toBeInTheDocument();
  });

  test("no se pierde ninguna vista por el camino", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    for (const id of [
      "gantt",
      "matrix",
      "observaciones",
      "executive",
      "resources",
      "lob",
      "scurve",
      "bottlenecks",
      "unidadTipica",
      "calendario",
      "settings",
    ]) {
      expect(screen.getByTestId(`sidebar-view-${id}`)).toBeInTheDocument();
    }
  });

  test("el compromiso semanal no abre otra puerta: vive dentro de Observaciones", () => {
    // Una restricción de Last Planner es una observación con responsable y
    // fecha: agrupa lo que ya estaba junto, y el menú no vuelve a crecer.
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.queryByTestId("sidebar-view-lastPlanner")).not.toBeInTheDocument();
  });

  test("la barra se anuncia como lista de pestañas", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  test("abrir la Matriz desde el menú avisa al proyecto", () => {
    const onViewChange = jest.fn();
    render(<ViewSidebar activeView="gantt" onViewChange={onViewChange} />);

    fireEvent.click(screen.getByTestId("sidebar-view-matrix"));

    expect(onViewChange).toHaveBeenCalledWith("matrix");
  });
});

describe("ViewSidebar · descripción por entrada (R0)", () => {
  test("la Matriz anuncia cuántas ubicaciones hay detrás", () => {
    render(
      <ViewSidebar
        activeView="gantt"
        onViewChange={jest.fn()}
        blurbContext={{ areaCount: 26, resourceCount: 0 }}
      />,
    );

    expect(screen.getByTestId("sidebar-blurb-matrix")).toHaveTextContent(
      "26 ubicaciones programadas",
    );
  });

  test("sin recursos, Recursos explica para qué sirve en vez de quedarse mudo", () => {
    render(
      <ViewSidebar
        activeView="gantt"
        onViewChange={jest.fn()}
        blurbContext={{ areaCount: 0, resourceCount: 0 }}
      />,
    );

    expect(screen.getByTestId("sidebar-blurb-resources")).toHaveTextContent(
      "Todavía no hay recursos",
    );
  });

  test("el nombre completo sigue siendo el rótulo accesible del botón", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.getByTestId("sidebar-view-matrix")).toHaveAttribute(
      "aria-label",
      "Matriz",
    );
  });
});
