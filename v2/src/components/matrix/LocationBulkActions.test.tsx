/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import LocationBulkActions from "./LocationBulkActions";

const ubicaciones = [
  { id: "piso-1", name: "Piso 1" },
  { id: "piso-2", name: "Piso 2" },
];

describe("LocationBulkActions", () => {
  test("duplicar avisa con la ubicación elegida", () => {
    const onDuplicate = jest.fn();
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={onDuplicate}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Ubicación a duplicar"), {
      target: { value: "piso-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duplicar ubicación" }));

    expect(onDuplicate).toHaveBeenCalledWith("piso-2");
  });

  test("crear un rango envía el patrón y los números", () => {
    const onCreateRange = jest.fn();
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={onCreateRange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre, con {n} donde va el número"), {
      target: { value: "Piso {n}" },
    });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear ubicaciones" }));

    expect(onCreateRange).toHaveBeenCalledWith({
      pattern: "Piso {n}",
      from: 3,
      to: 20,
      type: "Piso",
    });
  });

  test("anuncia cuántas se van a crear antes de pulsar", () => {
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "20" } });

    expect(screen.getByTestId("range-preview")).toHaveTextContent(
      "Se crearán 20 ubicaciones.",
    );
  });

  test("un rango descendente también se anuncia bien", () => {
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "1" } });

    expect(screen.getByTestId("range-preview")).toHaveTextContent(
      "Se crearán 3 ubicaciones.",
    );
  });

  test("sin ubicaciones no se puede duplicar", () => {
    render(
      <LocationBulkActions
        locations={[]}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Duplicar ubicación" })).toBeDisabled();
  });

  test("cuando la lista cambia, el selector sigue a la nueva lista", () => {
    const onDuplicate = jest.fn();
    const { rerender } = render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={onDuplicate}
        onCreateRange={jest.fn()}
      />,
    );

    // Seleccionar piso-2
    fireEvent.change(screen.getByLabelText("Ubicación a duplicar"), {
      target: { value: "piso-2" },
    });

    // Re-renderizar con una lista donde piso-2 ya no existe
    const nuevasUbicaciones = [
      { id: "piso-1", name: "Piso 1" },
      { id: "piso-3", name: "Piso 3" },
    ];
    rerender(
      <LocationBulkActions
        locations={nuevasUbicaciones}
        onDuplicate={onDuplicate}
        onCreateRange={jest.fn()}
      />,
    );

    // Pulsar "Duplicar ubicación"
    fireEvent.click(screen.getByRole("button", { name: "Duplicar ubicación" }));

    // Debe recibir piso-1 (la primera de la nueva lista), no piso-2 (que ya no existe)
    expect(onDuplicate).toHaveBeenCalledWith("piso-1");
  });

  test("sin {n} en el patrón, el aviso dice que se creará 1 ubicación", () => {
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre, con {n} donde va el número"), {
      target: { value: "Cubierta" },
    });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "20" } });

    expect(screen.getByTestId("range-preview")).toHaveTextContent(
      "Se creará 1 ubicación.",
    );
  });

  test("el singular de creará/ubicación sale bien", () => {
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre, con {n} donde va el número"), {
      target: { value: "Sótano {n}" },
    });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "1" } });

    expect(screen.getByTestId("range-preview")).toHaveTextContent(
      "Se creará 1 ubicación.",
    );
  });
});
