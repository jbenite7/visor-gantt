/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
// La suite de este repositorio no tiene `user-event` instalado: se usa
// `fireEvent`, que es lo que usan las demás pruebas de componentes.
import { fireEvent, render, screen } from "@testing-library/react";
import { useDraftHistory } from "./useDraftHistory";

function Probe() {
  const {
    draft,
    commitDraft,
    resetDraft,
    undoDraft,
    redoDraft,
    canUndo,
    canRedo,
  } = useDraftHistory<{ n: number }>({ n: 0 });

  return (
    <div>
      <span data-testid="valor">{draft ? draft.n : "sin borrador"}</span>
      <span data-testid="puede-deshacer">{String(canUndo)}</span>
      <span data-testid="puede-rehacer">{String(canRedo)}</span>
      <button type="button" onClick={() => commitDraft({ n: (draft?.n ?? 0) + 1 })}>
        sumar
      </button>
      <button
        type="button"
        onClick={() =>
          commitDraft((current) => (current ? { n: current.n * 10 } : current))
        }
      >
        por diez
      </button>
      <button type="button" onClick={undoDraft}>
        deshacer
      </button>
      <button type="button" onClick={redoDraft}>
        rehacer
      </button>
      <button type="button" onClick={() => resetDraft({ n: 100 })}>
        recargar
      </button>
    </div>
  );
}

describe("useDraftHistory (R1)", () => {
  test("deshacer devuelve el borrador al estado anterior", async () => {
    render(<Probe />);

    fireEvent.click(screen.getByRole("button", { name: "sumar" }));
    fireEvent.click(screen.getByRole("button", { name: "sumar" }));
    expect(screen.getByTestId("valor")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "deshacer" }));
    expect(screen.getByTestId("valor")).toHaveTextContent("1");
    expect(screen.getByTestId("puede-rehacer")).toHaveTextContent("true");

    fireEvent.click(screen.getByRole("button", { name: "rehacer" }));
    expect(screen.getByTestId("valor")).toHaveTextContent("2");
  });

  test("la forma con función recibe el borrador actual", async () => {
    render(<Probe />);

    fireEvent.click(screen.getByRole("button", { name: "sumar" }));
    fireEvent.click(screen.getByRole("button", { name: "por diez" }));

    expect(screen.getByTestId("valor")).toHaveTextContent("10");
    fireEvent.click(screen.getByRole("button", { name: "deshacer" }));
    expect(screen.getByTestId("valor")).toHaveTextContent("1");
  });

  test("recargar el borrador tira la pila: lo deshecho ya no existe", async () => {
    render(<Probe />);

    fireEvent.click(screen.getByRole("button", { name: "sumar" }));
    fireEvent.click(screen.getByRole("button", { name: "recargar" }));

    expect(screen.getByTestId("valor")).toHaveTextContent("100");
    expect(screen.getByTestId("puede-deshacer")).toHaveTextContent("false");
    expect(screen.getByTestId("puede-rehacer")).toHaveTextContent("false");
  });
});
