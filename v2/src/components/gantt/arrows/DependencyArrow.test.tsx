/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import DependencyArrow from "./DependencyArrow";
import { getArrowDirection } from "./ArrowPath";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DependencyArrow", () => {
  // --- SVG elements --------------------------------------------------------

  test("renders SVG path for FS dependency type", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FS"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("d");
  });

  test("renders arrowhead polygon", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FS"
          rowHeight={40}
        />
      </svg>,
    );

    const polygon = container.querySelector("polygon");
    expect(polygon).toBeInTheDocument();
    expect(polygon).toHaveAttribute("points");
  });

  // --- Critical color ------------------------------------------------------

  test("uses alert color when from.isCritical is true", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: true }}
          to={{ x: 300, y: 80 }}
          type="FS"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toHaveAttribute("stroke", "var(--aia-alert-main)");
  });

  test("uses mid color when from.isCritical is false", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FS"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toHaveAttribute("stroke", "var(--aia-corp-mid)");
  });

  test("uses strokeWidth 2 for critical arrows", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: true }}
          to={{ x: 300, y: 80 }}
          type="FS"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toHaveAttribute("stroke-width", "2");
  });

  // --- Lag label -----------------------------------------------------------

  test("renders lag text when lag is provided and non-zero", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FS"
          lag={5}
          rowHeight={40}
        />
      </svg>,
    );

    expect(screen.getByText("+5d")).toBeInTheDocument();
    expect(
      container.querySelector("[data-testid='dependency-lag-badge']"),
    ).toBeInTheDocument();
  });

  test("renders negative lag text correctly", () => {
    render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FS"
          lag={-3}
          rowHeight={40}
        />
      </svg>,
    );

    expect(screen.getByText("-3d")).toBeInTheDocument();
  });

  test("does not render lag text when lag is zero", () => {
    render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FS"
          lag={0}
          rowHeight={40}
        />
      </svg>,
    );

    expect(screen.queryByText("+0d")).not.toBeInTheDocument();
    expect(screen.queryByText("0d")).not.toBeInTheDocument();
  });

  test("does not render lag text when lag is undefined", () => {
    render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FS"
          rowHeight={40}
        />
      </svg>,
    );

    // There should be no <text> element at all
    const textElements = document.querySelectorAll("text");
    expect(textElements).toHaveLength(0);
  });

  // --- Arrow direction per type -------------------------------------------

  test("renders for SS dependency type", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="SS"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("d");
  });

  test("renders for FF dependency type", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="FF"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("d");
  });

  test("renders for SF dependency type", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 80 }}
          type="SF"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("d");
  });

  // --- Same-row rendering --------------------------------------------------

  test("renders when from and to are on the same row", () => {
    const { container } = render(
      <svg>
        <DependencyArrow
          from={{ x: 100, y: 40, isCritical: false }}
          to={{ x: 300, y: 40 }}
          type="FS"
          rowHeight={40}
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("d");
  });

  test("points left when the final FS segment travels left", () => {
    expect(getArrowDirection(100, 40, 100, 80, "FS")).toBe("left");
  });
});
