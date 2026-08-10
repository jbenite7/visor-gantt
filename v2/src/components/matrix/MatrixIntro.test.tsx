/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MatrixIntro from "./MatrixIntro";

function setup(overrides: Partial<React.ComponentProps<typeof MatrixIntro>> = {}) {
  const props = {
    canGenerateFromSchedule: true,
    onPickTemplate: jest.fn(),
    onGenerateFromSchedule: jest.fn(),
    onCreateBlank: jest.fn(),
    ...overrides,
  };
  render(<MatrixIntro {...props} />);
  return props;
}

describe("MatrixIntro · la puerta explica la habitación (R8)", () => {
  test("dice qué es la programación matricial antes de pedir nada", () => {
    setup();

    expect(screen.getByRole("heading", { name: /Programación matricial/i }))
      .toBeInTheDocument();
    expect(screen.getByTestId("matrix-intro-benefits")).toHaveTextContent(
      /cronograma sale solo/i,
    );
  });

  test("conserva el testid del estado vacío: nada que lo consuma se rompe", () => {
    setup();

    expect(screen.getByTestId("matrix-editor-empty")).toBeInTheDocument();
  });

  test("ofrece las plantillas de fábrica sin duplicar su copy", () => {
    setup();

    expect(screen.getByTestId("template-picker")).toBeInTheDocument();
  });

  test("elegir una plantilla avisa con la plantilla elegida", () => {
    const props = setup();

    // El botón de cada plantilla lleva su nombre, no un rótulo genérico.
    const dentroDelPicker = screen.getByTestId("template-picker");
    const primera = dentroDelPicker.querySelectorAll("li button")[0];
    fireEvent.click(primera);

    expect(props.onPickTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) }),
    );
  });

  test("crear en blanco sigue disponible, como tercera opción y no como única", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("matrix-create-blank"));

    expect(props.onCreateBlank).toHaveBeenCalledTimes(1);
  });

  test("sin cronograma, generar desde él queda deshabilitado con su motivo", () => {
    setup({ canGenerateFromSchedule: false });

    const generar = screen.getByRole("button", { name: /Generar/i });
    expect(generar).toBeDisabled();
  });
});
