/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ViewHelpPanel from "./ViewHelpPanel";

describe("ViewHelpPanel (E8)", () => {
  test("muestra el propósito y lo que necesita la vista", () => {
    render(<ViewHelpPanel view="lob" onClose={jest.fn()} />);

    expect(screen.getByRole("heading")).toHaveTextContent(/línea de balance/i);
    expect(screen.getByTestId("view-help-purpose")).not.toBeEmptyDOMElement();
    expect(screen.getByTestId("view-help-needs")).not.toBeEmptyDOMElement();
  });

  test("se puede cerrar", () => {
    const onClose = jest.fn();
    render(<ViewHelpPanel view="lob" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("una vista sin ayuda no rompe la pantalla", () => {
    const { container } = render(
      <ViewHelpPanel view={"no-existe" as never} onClose={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
