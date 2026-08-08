/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import BaselineMenu from "./BaselineMenu";

function setup(
  overrides: Partial<React.ComponentProps<typeof BaselineMenu>> = {},
) {
  const props = {
    baselines: [
      { id: "bl-1", name: "Antes de la lluvia" },
      { id: "bl-2", name: "Línea base 2" },
    ],
    activeBaselineId: "bl-1",
    proposedName: "Línea base 3",
    onSave: jest.fn(),
    onSelect: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  render(<BaselineMenu {...props} />);
  return props;
}

describe("BaselineMenu — nombrar y borrar (M13)", () => {
  test("guardar pide un nombre y propone uno", () => {
    setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));

    expect(screen.getByTestId("baseline-name-input")).toHaveValue(
      "Línea base 3",
    );
  });

  test("guarda con el nombre que escribe el usuario", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.change(screen.getByTestId("baseline-name-input"), {
      target: { value: "Aprobada por la interventoría" },
    });
    fireEvent.click(screen.getByTestId("baseline-save-confirm"));

    expect(props.onSave).toHaveBeenCalledWith("Aprobada por la interventoría");
  });

  test("un nombre en blanco no bloquea: se guarda con el propuesto", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.change(screen.getByTestId("baseline-name-input"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByTestId("baseline-save-confirm"));

    expect(props.onSave).toHaveBeenCalledWith("Línea base 3");
  });

  test("Escape cancela sin guardar", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.keyDown(screen.getByTestId("baseline-name-input"), {
      key: "Escape",
    });

    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.queryByTestId("baseline-name-input")).not.toBeInTheDocument();
  });

  test("Enter guarda sin tener que buscar el botón", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.keyDown(screen.getByTestId("baseline-name-input"), {
      key: "Enter",
    });

    expect(props.onSave).toHaveBeenCalledWith("Línea base 3");
  });

  test("cada línea base guardada se puede borrar, con etiqueta de texto", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-menu-open"));
    const borrar = screen.getByTestId("baseline-delete-bl-2");

    expect(borrar).toHaveTextContent("Borrar");
    fireEvent.click(borrar);
    expect(props.onDelete).toHaveBeenCalledWith("bl-2");
  });

  test("borrar no se confunde con seleccionar", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-menu-open"));
    fireEvent.click(screen.getByTestId("baseline-delete-bl-2"));

    expect(props.onSelect).not.toHaveBeenCalled();
  });

  test("seleccionar avisa con el identificador de la elegida", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-menu-open"));
    fireEvent.click(screen.getByTestId("baseline-select-bl-2"));

    expect(props.onSelect).toHaveBeenCalledWith("bl-2");
  });

  test("sin líneas base guardadas no hay desplegable que abrir", () => {
    setup({ baselines: [], activeBaselineId: undefined });

    expect(screen.queryByTestId("baseline-menu-open")).not.toBeInTheDocument();
    expect(screen.getByTestId("baseline-save-open")).toBeInTheDocument();
  });
});
