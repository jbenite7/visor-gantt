/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import UndoToast from "./UndoToast";
import type { LastAction } from "@/lib/state/ProjectContext";

function action(overrides: Partial<LastAction> = {}): LastAction {
  return {
    kind: "delete",
    count: 2,
    description: "2 tareas eliminadas",
    token: 1,
    ...overrides,
  };
}

describe("UndoToast (E1)", () => {
  test("no muestra nada sin acción previa", () => {
    const { container } = render(<UndoToast action={null} onUndo={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("anuncia la acción con region live y ofrece deshacer", () => {
    render(<UndoToast action={action()} onUndo={jest.fn()} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("2 tareas eliminadas");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: /deshacer/i })).toBeInTheDocument();
  });

  test("al pulsar Deshacer llama al callback y oculta el aviso", () => {
    const onUndo = jest.fn();
    render(<UndoToast action={action()} onUndo={onUndo} />);

    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("una acción nueva vuelve a mostrar el aviso tras haberlo cerrado", () => {
    const { rerender } = render(<UndoToast action={action()} onUndo={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /cerrar aviso/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(
      <UndoToast
        action={action({ token: 2, description: "1 tarea eliminada", count: 1 })}
        onUndo={jest.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("1 tarea eliminada");
  });

  test("usa inglés cuando el locale lo pide", () => {
    render(<UndoToast action={action()} onUndo={jest.fn()} locale="en" />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
  });
});
