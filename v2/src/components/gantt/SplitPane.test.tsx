/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import SplitPane from "./SplitPane";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SplitPane", () => {
  // --- Rendering -----------------------------------------------------------

  test("renders left and right content", () => {
    render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left={<span>LEFT</span>} right={<span>RIGHT</span>} />
      </div>,
    );

    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });

  test("renders the divider element", () => {
    render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left="LEFT" right="RIGHT" />
      </div>,
    );

    const divider = screen.getByTestId("split-divider");
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveAttribute("role", "separator");
  });

  // --- Split ratio ---------------------------------------------------------

  test("uses default split ratio of 40%", () => {
    render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left="LEFT" right="RIGHT" />
      </div>,
    );

    const splitPane = screen.getByTestId("split-pane");
    const leftPane = splitPane.firstChild as HTMLElement;

    expect(leftPane.style.width).toBe("40%");
  });

  test("uses custom split ratio when defaultSplit is provided", () => {
    render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left="LEFT" right="RIGHT" defaultSplit={60} />
      </div>,
    );

    const splitPane = screen.getByTestId("split-pane");
    const leftPane = splitPane.firstChild as HTMLElement;

    expect(leftPane.style.width).toBe("60%");
  });

  // --- Divider accessibility -----------------------------------------------

  test("divider has correct accessibility attributes", () => {
    render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left="LEFT" right="RIGHT" />
      </div>,
    );

    const divider = screen.getByTestId("split-divider");

    expect(divider).toHaveAttribute("aria-valuenow", "40");
    expect(divider).toHaveAttribute("aria-valuemin", "20");
    expect(divider).toHaveAttribute("aria-valuemax", "80");
    expect(divider).toHaveAttribute("aria-label", "Resize split pane");
  });

  test("divider has tabIndex 0 for keyboard accessibility", () => {
    render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left="LEFT" right="RIGHT" />
      </div>,
    );

    const divider = screen.getByTestId("split-divider");
    expect(divider).toHaveAttribute("tabindex", "0");
  });

  // --- Container structure -------------------------------------------------

  test("root element has data-testid split-pane", () => {
    render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left="LEFT" right="RIGHT" />
      </div>,
    );

    expect(screen.getByTestId("split-pane")).toBeInTheDocument();
  });
});

/**
 * El divisor dejaba escuchas pegadas a `document` en cada arrastre.
 *
 * `handleDividerMouseDown` añadía `mousemove` y `mouseup` **y nadie los
 * retiraba**: ni al soltar el ratón, ni al desmontar. Cada arrastre dejaba dos
 * más, para siempre, y seguían corriendo en cada movimiento del ratón por toda
 * la página aunque el componente ya no estuviera.
 *
 * No se ve —los manejadores salen enseguida por `isDraggingRef`—, que es
 * exactamente lo que lo hacía sobrevivir.
 */
describe("el divisor no deja escuchas pegadas", () => {
  function contarEscuchas() {
    const original = { add: document.addEventListener, remove: document.removeEventListener };
    const vivas = new Map<string, number>();
    document.addEventListener = ((ev: string, ...resto: unknown[]) => {
      vivas.set(ev, (vivas.get(ev) ?? 0) + 1);
      // `.call(document, ...)`: sin el enlace, el navegador rechaza la llamada.
      return (original.add as never as (...a: unknown[]) => void).call(
        document,
        ev,
        ...resto,
      );
    }) as typeof document.addEventListener;
    document.removeEventListener = ((ev: string, ...resto: unknown[]) => {
      vivas.set(ev, (vivas.get(ev) ?? 0) - 1);
      return (original.remove as never as (...a: unknown[]) => void).call(
        document,
        ev,
        ...resto,
      );
    }) as typeof document.removeEventListener;
    return {
      vivas,
      restaurar: () => {
        document.addEventListener = original.add;
        document.removeEventListener = original.remove;
      },
    };
  }

  test("al soltar el ratón, las escuchas del arrastre se retiran", () => {
    const { vivas, restaurar } = contarEscuchas();

    render(
      <SplitPane left={<div>izq</div>} right={<div>der</div>} />,
    );
    fireEvent.mouseDown(screen.getByTestId("split-divider"));
    fireEvent.mouseUp(document);

    expect(vivas.get("mousemove") ?? 0).toBe(0);
    expect(vivas.get("mouseup") ?? 0).toBe(0);

    restaurar();
  });

  test("tres arrastres no dejan seis escuchas acumuladas", () => {
    const { vivas, restaurar } = contarEscuchas();

    render(
      <SplitPane left={<div>izq</div>} right={<div>der</div>} />,
    );
    for (let i = 0; i < 3; i += 1) {
      fireEvent.mouseDown(screen.getByTestId("split-divider"));
      fireEvent.mouseUp(document);
    }

    expect(vivas.get("mousemove") ?? 0).toBe(0);

    restaurar();
  });
});
