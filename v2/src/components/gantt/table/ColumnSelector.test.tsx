/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import ColumnSelector, { type ColumnConfig } from "./ColumnSelector";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const columns: ColumnConfig[] = [
  { key: "name", label: "Actividad", width: 200, align: "left", defaultVisible: true },
  { key: "duration", label: "Duración", width: 100, align: "right", defaultVisible: true },
];

function baseProps(overrides: Partial<React.ComponentProps<typeof ColumnSelector>> = {}) {
  return {
    columns,
    visibleColumns: ["name", "duration"],
    locale: "es" as const,
    onToggle: jest.fn(),
    onReset: jest.fn(),
    onLocaleChange: jest.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ColumnSelector", () => {
  test("opens the panel when the trigger is clicked", () => {
    render(<ColumnSelector {...baseProps()} />);

    expect(screen.queryByTestId("column-selector-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("column-selector"));

    expect(screen.getByTestId("column-selector-panel")).toBeInTheDocument();
    expect(screen.getByTestId("column-selector")).toHaveAttribute("aria-expanded", "true");
  });

  test("toggles the visibility of a column", () => {
    const onToggle = jest.fn();
    render(<ColumnSelector {...baseProps({ onToggle })} />);

    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Duración" }));

    expect(onToggle).toHaveBeenCalledWith("duration");
  });

  test("repositions the panel to stay within the viewport", () => {
    // Simulate a narrow viewport (jsdom does not compute real layout, so this is
    // exercised by mocking the trigger/panel rects returned to updatePanelPosition).
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });

    render(<ColumnSelector {...baseProps()} />);
    fireEvent.click(screen.getByTestId("column-selector"));

    const trigger = screen.getByTestId("column-selector");
    const panel = screen.getByTestId("column-selector-panel");

    // Trigger sits near the right edge, and the panel is larger than the viewport,
    // which would push it off-screen unless the component clamps to the margin.
    trigger.getBoundingClientRect = () => ({
      top: 0,
      bottom: 40,
      left: 460,
      right: 500,
      width: 40,
      height: 40,
      x: 460,
      y: 0,
      toJSON: () => undefined,
    });
    panel.getBoundingClientRect = () => ({
      top: 0,
      bottom: 600,
      left: 0,
      right: 800,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    Object.defineProperty(panel, "offsetWidth", { configurable: true, value: 800 });
    Object.defineProperty(panel, "offsetHeight", { configurable: true, value: 600 });

    fireEvent(window, new Event("resize"));

    expect(panel).toHaveAttribute("data-positioned", "true");
    expect(panel.style.getPropertyValue("--gantt-column-selector-panel-left")).toBe("12px");
    expect(panel.style.getPropertyValue("--gantt-column-selector-panel-top")).toBe("12px");
  });
});
