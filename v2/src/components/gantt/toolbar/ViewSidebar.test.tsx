/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ViewSidebar from "./ViewSidebar";

describe("ViewSidebar tras el recorte (C1-C5)", () => {
  test("muestra 9 vistas, no 14", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);
    expect(screen.getAllByRole("tab")).toHaveLength(9);
  });

  test("las vistas absorbidas ya no son entradas del menú", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.queryByTestId("sidebar-view-tracking")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-taskSheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-conflictos")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-network")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-matrix")).not.toBeInTheDocument();
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
