/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import EditableCell from "./EditableCell";

describe("entrar en edición sin ratón (E37)", () => {
  test("Enter sobre la celda enfocada abre la edición", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    const celda = screen.getByTestId("editable-cell");
    celda.focus();
    fireEvent.keyDown(celda, { key: "Enter" });

    expect(screen.getByDisplayValue("Excavación")).toBeInTheDocument();
  });

  test("F2 hace lo mismo, como en una hoja de cálculo", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    const celda = screen.getByTestId("editable-cell");
    celda.focus();
    fireEvent.keyDown(celda, { key: "F2" });

    expect(screen.getByDisplayValue("Excavación")).toBeInTheDocument();
  });

  test("una celda de solo lectura no se abre con el teclado", () => {
    render(
      <EditableCell type="text" value="Excavación" readOnly onCommit={jest.fn()} />,
    );

    const celda = screen.getByTestId("editable-cell");
    fireEvent.keyDown(celda, { key: "Enter" });

    expect(screen.queryByDisplayValue("Excavación")).not.toBeInTheDocument();
  });

  test("la celda editable es alcanzable con el tabulador; la de solo lectura no", () => {
    const { rerender } = render(
      <EditableCell type="text" value="A" onCommit={jest.fn()} />,
    );
    expect(screen.getByTestId("editable-cell")).toHaveAttribute("tabindex", "0");

    rerender(<EditableCell type="text" value="A" readOnly onCommit={jest.fn()} />);
    expect(screen.getByTestId("editable-cell")).not.toHaveAttribute("tabindex");
  });

  test("otra tecla cualquiera no abre la edición", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    fireEvent.keyDown(screen.getByTestId("editable-cell"), { key: "a" });

    expect(screen.queryByDisplayValue("Excavación")).not.toBeInTheDocument();
  });

  test("el doble clic sigue funcionando: no se pierde nada", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    fireEvent.doubleClick(screen.getByTestId("editable-cell"));

    expect(screen.getByDisplayValue("Excavación")).toBeInTheDocument();
  });
});

describe("la edición aceptada se confirma en la propia celda (E44)", () => {
  test("tras guardar, la celda queda marcada como aceptada", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    fireEvent.doubleClick(screen.getByTestId("editable-cell"));
    const input = screen.getByDisplayValue("Excavación");
    fireEvent.change(input, { target: { value: "Excavación manual" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("editable-cell")).toHaveAttribute(
      "data-accepted",
      "true",
    );
  });

  test("cancelar con Escape no confirma nada", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    fireEvent.doubleClick(screen.getByTestId("editable-cell"));
    fireEvent.keyDown(screen.getByDisplayValue("Excavación"), { key: "Escape" });

    expect(screen.getByTestId("editable-cell")).not.toHaveAttribute(
      "data-accepted",
      "true",
    );
  });
});
