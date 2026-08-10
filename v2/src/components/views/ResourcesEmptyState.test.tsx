/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ResourcesEmptyState from "./ResourcesEmptyState";

describe("ResourcesEmptyState — la vista Recursos enseña en vez de callar", () => {
  test("explica qué es una hoja de recursos con lenguaje de obra", () => {
    render(<ResourcesEmptyState onCreateResource={jest.fn()} onOpenBudget={jest.fn()} />);

    const panel = screen.getByTestId("resources-empty-state");
    expect(panel).toHaveTextContent(/cuadrillas/i);
    expect(panel).toHaveTextContent(/equipos/i);
    expect(panel).toHaveTextContent(/materiales/i);
  });

  test("dice de dónde salen los recursos: del .mpp importado o creados a mano", () => {
    render(<ResourcesEmptyState onCreateResource={jest.fn()} onOpenBudget={jest.fn()} />);

    const origen = screen.getByTestId("resources-empty-origen");
    expect(origen).toHaveTextContent(/\.mpp/);
    expect(origen).toHaveTextContent(/a mano/i);
  });

  test("enumera las cinco pestañas que aparecerán cuando haya recursos", () => {
    render(<ResourcesEmptyState onCreateResource={jest.fn()} onOpenBudget={jest.fn()} />);

    const items = screen.getAllByTestId("resources-empty-subtab");
    expect(items).toHaveLength(5);
    const texto = items.map((item) => item.textContent).join(" | ");
    expect(texto).toContain("Hoja de Recursos");
    expect(texto).toContain("Uso de Recursos");
    expect(texto).toContain("Asignaciones");
    expect(texto).toContain("Presupuesto");
    expect(texto).toContain("Mapeo");
  });

  test("las dos salidas llaman a su acción", () => {
    const onCreateResource = jest.fn();
    const onOpenBudget = jest.fn();
    render(
      <ResourcesEmptyState
        onCreateResource={onCreateResource}
        onOpenBudget={onOpenBudget}
      />,
    );

    fireEvent.click(screen.getByTestId("resources-empty-create"));
    expect(onCreateResource).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("resources-empty-budget"));
    expect(onOpenBudget).toHaveBeenCalledTimes(1);
  });

  test("en inglés el texto cambia de idioma", () => {
    render(
      <ResourcesEmptyState
        locale="en"
        onCreateResource={jest.fn()}
        onOpenBudget={jest.fn()}
      />,
    );

    expect(screen.getByTestId("resources-empty-state")).toHaveTextContent(/crews/i);
  });
});
