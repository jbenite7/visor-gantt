/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ScheduleSkeleton from "./ScheduleSkeleton";

describe("abrir un proyecto no es una pantalla en blanco (E16)", () => {
  test("el esqueleto tiene la forma de lo que va a llegar: tabla y gantt", () => {
    render(<ScheduleSkeleton />);

    expect(screen.getByTestId("skeleton-table")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-chart")).toBeInTheDocument();
  });

  test("se anuncia como carga, para quien no ve la pantalla", () => {
    render(<ScheduleSkeleton />);

    const raiz = screen.getByTestId("schedule-skeleton");
    expect(raiz).toHaveAttribute("role", "status");
    expect(raiz).toHaveAttribute("aria-live", "polite");
    expect(raiz).toHaveTextContent(/cargando/i);
  });

  test("dibuja varias filas, no una sola barra genérica", () => {
    render(<ScheduleSkeleton />);

    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThanOrEqual(
      5,
    );
  });

  test("cada fila del esqueleto lleva su barra, como el Gantt real", () => {
    render(<ScheduleSkeleton />);

    expect(screen.getAllByTestId("skeleton-bar").length).toBe(
      screen.getAllByTestId("skeleton-row").length,
    );
  });
});
