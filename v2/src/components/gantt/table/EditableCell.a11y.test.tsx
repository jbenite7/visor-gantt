/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import EditableCell from "./EditableCell";

/**
 * La celda editable dice qué se está editando.
 *
 * Al entrar en edición aparece un `<input>` desnudo: sin etiqueta, sin
 * `aria-label`, sin nada. Un lector de pantalla anuncia «edición de texto» y se
 * calla. En una tabla de 240 tareas por siete columnas eso son mil setecientos
 * campos que no dicen ni de qué tarea ni de qué dato son.
 *
 * **El nombre lo pone quien la usa, no ella.** La celda no sabe si es una
 * duración o una fecha de fin, ni de qué tarea: eso solo lo sabe la fila. Poner
 * aquí un nombre genérico —«celda», «valor»— sería cambiar un campo mudo por un
 * campo que miente, y eso es peor: el mudo al menos no engaña.
 */
describe("la celda editable dice qué se está editando", () => {
  function editar(props: Parameters<typeof EditableCell>[0]) {
    render(<EditableCell {...props} />);
    fireEvent.doubleClick(screen.getByText("42"));
  }

  test("el campo de texto lleva el nombre que le da la fila", () => {
    editar({
      value: "42",
      type: "number",
      label: "Duración de LOCALIZACIÓN Y REPLANTEO",
      onCommit: () => {},
    });

    expect(
      screen.getByRole("spinbutton", {
        name: "Duración de LOCALIZACIÓN Y REPLANTEO",
      }),
    ).toBeInTheDocument();
  });

  test("el deslizador de avance también, que es otro camino distinto", () => {
    // El `slider` se dibuja en una rama aparte del componente. Sin esta prueba
    // el nombre llegaría a un camino y no al otro, y nadie lo notaría.
    editar({
      value: "42",
      type: "slider",
      label: "Avance de MOVIMIENTO DE TIERRA",
      onCommit: () => {},
    });

    expect(
      screen.getByRole("slider", { name: "Avance de MOVIMIENTO DE TIERRA" }),
    ).toBeInTheDocument();
  });

  test("sin nombre no se inventa uno: se queda sin `aria-label`", () => {
    // Control de que la prueba de arriba no pasa por casualidad, y decisión
    // deliberada: un nombre inventado es peor que ninguno.
    editar({ value: "42", type: "number", onCommit: () => {} });

    expect(screen.getByTestId("editable-cell")).not.toHaveAttribute(
      "aria-label",
    );
  });
});
