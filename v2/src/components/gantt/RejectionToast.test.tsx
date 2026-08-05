/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import RejectionToast from "./RejectionToast";

describe("RejectionToast (E23)", () => {
  test("no muestra nada si no hubo rechazo", () => {
    const { container } = render(<RejectionToast rejection={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("explica el motivo con role=alert", () => {
    render(
      <RejectionToast
        rejection={{
          reason: "Las dependencias contienen un ciclo y no se pueden recalcular.",
          token: 1,
        }}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("El cambio no se aplicó");
    expect(alert).toHaveTextContent("ciclo");
  });

  test("añade el detalle cuando hay más de un conflicto", () => {
    render(
      <RejectionToast
        rejection={{ reason: "Conflicto principal", detail: "y 2 conflicto(s) más", token: 1 }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("y 2 conflicto(s) más");
  });

  test("se puede cerrar y un rechazo nuevo lo vuelve a mostrar", () => {
    const { rerender } = render(
      <RejectionToast rejection={{ reason: "Primero", token: 1 }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar aviso/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<RejectionToast rejection={{ reason: "Segundo", token: 2 }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Segundo");
  });
});
