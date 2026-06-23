/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
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
    const { container } = render(
      <div style={{ width: 1000, height: 500 }}>
        <SplitPane left="LEFT" right="RIGHT" />
      </div>,
    );

    const splitPane = screen.getByTestId("split-pane");
    const leftPane = splitPane.firstChild as HTMLElement;

    expect(leftPane.style.width).toBe("40%");
  });

  test("uses custom split ratio when defaultSplit is provided", () => {
    const { container } = render(
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
