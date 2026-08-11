/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ImportSummaryBanner from "./ImportSummaryBanner";

describe("ImportSummaryBanner", () => {
  test("dice qué se importó al llegar del .mpp", () => {
    render(
      <ImportSummaryBanner summary={{ tasks: 239, dependencies: 212, resources: 0, discardedColumns: [] }} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Se importaron 239 tareas y 212 dependencias.",
    );
  });

  test("sin resumen no ocupa espacio en la pantalla", () => {
    const { container } = render(<ImportSummaryBanner summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("se puede cerrar", () => {
    render(
      <ImportSummaryBanner summary={{ tasks: 5, dependencies: 0, resources: 0, discardedColumns: [] }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("las pérdidas de la importación se anuncian (E33)", () => {
  test("sin columnas descartadas no se habla de pérdidas", () => {
    render(
      <ImportSummaryBanner
        summary={{
          tasks: 12,
          dependencies: 4,
          resources: 2,
          discardedColumns: [],
        }}
      />,
    );

    expect(screen.queryByTestId("import-warnings-toggle")).not.toBeInTheDocument();
  });

  test("con columnas descartadas, se pueden ver cuáles", () => {
    render(
      <ImportSummaryBanner
        summary={{
          tasks: 12,
          dependencies: 4,
          resources: 2,
          discardedColumns: ["Texto27", "Número14"],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("import-warnings-toggle"));

    const warnings = screen.getByTestId("import-warnings");
    expect(warnings).toHaveTextContent("Texto27");
    expect(warnings).toHaveTextContent("Número14");
  });

  test("el aviso dice cuántas se descartaron sin abrirlo", () => {
    render(
      <ImportSummaryBanner
        summary={{
          tasks: 12,
          dependencies: 4,
          resources: 2,
          discardedColumns: ["Texto27", "Número14"],
        }}
      />,
    );

    expect(screen.getByTestId("import-warnings-toggle")).toHaveTextContent("2");
  });
});

/**
 * Si la foto del cronograma no se guardó, se dice aquí.
 *
 * El tablero de Cortes explica que «cada vez que importas … se guarda una
 * foto». Cuando no ocurre y nadie lo cuenta, el usuario se encuentra un tablero
 * vacío que contradice ese texto y no sabe por qué.
 */
describe("cuando no se pudo guardar la foto del cronograma", () => {
  test("se avisa, sin dar la importación por fallida", () => {
    render(
      <ImportSummaryBanner
        summary={{
          tasks: 239,
          dependencies: 212,
          resources: 17,
          discardedColumns: [],
          snapshotMissing: true,
        }}
      />,
    );

    expect(screen.getByTestId("import-sin-foto")).toBeInTheDocument();
    // La importación sí salió bien: el conteo sigue ahí.
    expect(screen.getByRole("status")).toHaveTextContent("239");
  });

  test("si la foto se guardó, no se dice nada", () => {
    render(
      <ImportSummaryBanner
        summary={{
          tasks: 239,
          dependencies: 212,
          resources: 17,
          discardedColumns: [],
          snapshotMissing: false,
        }}
      />,
    );

    expect(screen.queryByTestId("import-sin-foto")).not.toBeInTheDocument();
  });
});
