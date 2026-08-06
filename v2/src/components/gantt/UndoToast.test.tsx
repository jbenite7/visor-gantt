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

  test("un aviso de tipo 'undone' anuncia el texto pero no ofrece el botón Deshacer", () => {
    render(
      <UndoToast
        action={action({ kind: "undone", description: "Deshecho: 1 tarea eliminada" })}
        onUndo={jest.fn()}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Deshecho: 1 tarea eliminada");
    expect(screen.queryByRole("button", { name: /deshacer/i })).not.toBeInTheDocument();
  });
});

describe("el aviso no sobrevive a la acción que lo contradice", () => {
  test("al rehacer, el aviso «Deshecho» desaparece en vez de quedarse mintiendo", () => {
    const { rerender } = render(
      <UndoToast
        action={{ kind: "undone", count: 1, description: "Deshecho: 1 tarea eliminada", token: 5 }}
        onUndo={jest.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Deshecho:");

    // Rehacer limpia la última acción: el aviso ya no describe el estado real.
    rerender(<UndoToast action={null} onUndo={jest.fn()} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
