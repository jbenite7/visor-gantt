/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import LineOfBalance from "./LineOfBalance";
import type { LOBActivity, LOBUnit } from "@/types/lob";

describe("LineOfBalance", () => {
  test("follows project toolbar scale and exposes matching scale controls", () => {
    const activities: LOBActivity[] = [
      {
        id: "act-a",
        name: "Estructura",
        taskIds: [1, 2],
        plannedRate: 1,
        unitLabel: "Piso",
        plannedStart: new Date("2026-01-05"),
        plannedFinish: new Date("2026-02-05"),
      },
    ];
    const units: LOBUnit[] = [
      {
        activityId: "act-a",
        unitIndex: 0,
        plannedDate: new Date("2026-01-05"),
      },
      {
        activityId: "act-a",
        unitIndex: 1,
        plannedDate: new Date("2026-02-05"),
      },
    ];
    const onScaleChange = jest.fn();

    const { rerender } = render(
      <LineOfBalance
        activities={activities}
        units={units}
        scale="day"
        onScaleChange={onScaleChange}
      />,
    );

    const chart = screen.getByTestId("line-of-balance");
    expect(chart).toHaveAttribute("data-scale", "day");
    expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen
        .getAllByTestId("lob-x-tick-label")
        .some((label) => label.textContent?.includes("5 ene")),
    ).toBe(true);

    fireEvent.click(screen.getByTestId("lob-scale-quarter"));

    expect(onScaleChange).toHaveBeenCalledWith("quarter");

    rerender(
      <LineOfBalance
        activities={activities}
        units={units}
        scale="quarter"
        onScaleChange={onScaleChange}
      />,
    );

    expect(chart).toHaveAttribute("data-scale", "quarter");
    expect(screen.getByRole("button", { name: "Trimestre" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen
        .getAllByTestId("lob-x-tick-label")
        .some((label) => label.textContent?.includes("T1 2026")),
    ).toBe(true);
  });

  test("keeps the first month visible when data starts after month start", () => {
    const activities: LOBActivity[] = [
      {
        id: "act-a",
        name: "Estructura",
        taskIds: [1, 2],
        plannedRate: 1,
        unitLabel: "Piso",
        plannedStart: new Date("2026-01-05"),
        plannedFinish: new Date("2026-02-05"),
      },
    ];
    const units: LOBUnit[] = [
      {
        activityId: "act-a",
        unitIndex: 0,
        plannedDate: new Date("2026-01-05"),
      },
      {
        activityId: "act-a",
        unitIndex: 1,
        plannedDate: new Date("2026-02-05"),
      },
    ];

    render(<LineOfBalance activities={activities} units={units} />);

    expect(screen.getByTestId("line-of-balance")).toHaveAttribute("data-scale", "day");
    expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByTestId("lob-scale-month"));

    const monthLabels = screen
      .getAllByTestId("lob-x-tick-label")
      .map((label) => label.textContent ?? "");

    expect(monthLabels.some((label) => label.includes("ene 2026"))).toBe(true);
    expect(monthLabels.some((label) => label.includes("feb 2026"))).toBe(true);

    fireEvent.click(screen.getByTestId("lob-scale-week"));

    const weekLabels = screen
      .getAllByTestId("lob-x-tick-label")
      .map((label) => label.textContent ?? "");

    expect(weekLabels.some((label) => /^S\d+ - /.test(label))).toBe(true);
    expect(weekLabels.join("|")).not.toBe(monthLabels.join("|"));
    expect(screen.getAllByTestId("lob-x-grid").length).toBe(weekLabels.length);
  });

  test("renders automatic feedback cards for LOB diagnostics", () => {
    const activities: LOBActivity[] = [
      {
        id: "act-a",
        name: "Estructura",
        taskIds: [1, 2, 3],
        plannedRate: 1,
        unitLabel: "Piso",
        plannedStart: new Date("2026-01-01"),
        plannedFinish: new Date("2026-01-10"),
      },
    ];
    const units: LOBUnit[] = [
      {
        activityId: "act-a",
        unitIndex: 0,
        plannedDate: new Date("2026-01-01"),
        actualDate: new Date("2026-01-01"),
      },
      {
        activityId: "act-a",
        unitIndex: 1,
        plannedDate: new Date("2026-01-02"),
        actualDate: new Date("2026-01-05"),
      },
      {
        activityId: "act-a",
        unitIndex: 2,
        plannedDate: new Date("2026-01-10"),
      },
    ];

    render(<LineOfBalance activities={activities} units={units} />);

    const chart = screen.getByTestId("line-of-balance");
    expect(chart).toHaveAttribute("data-scale", "day");
    expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByTestId("lob-scale-month"));

    const monthLabels = screen
      .getAllByTestId("lob-x-tick-label")
      .map((label) => label.textContent ?? "");

    expect(chart).toHaveAttribute("data-scale", "month");
    expect(monthLabels.some((label) => label.includes("ene 2026"))).toBe(true);
    expect(chart).toHaveAttribute("data-zoom", "1");
    expect(chart).toHaveAttribute("data-zoom-center", "0.500");
    expect(screen.getByTestId("lob-zoom-value")).toHaveTextContent("100%");
    expect(screen.getByTestId("lob-feedback")).toHaveTextContent("Estructura");
    expect(screen.getAllByTestId("lob-feedback-card").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Meses" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const initialPolyline = screen
      .getAllByTestId("lob-planned-line")[0]
      .getAttribute("points");

    fireEvent.click(screen.getByTestId("lob-zoom-in"));

    expect(chart).toHaveAttribute("data-zoom", "1.5");
    expect(chart).toHaveAttribute("data-zoom-center", "0.500");
    expect(screen.getByTestId("lob-zoom-value")).toHaveTextContent("150%");

    const zoomedPolyline = screen
      .getAllByTestId("lob-planned-line")[0]
      .getAttribute("points");

    expect(zoomedPolyline).not.toBe(initialPolyline);

    const centerBeforePan = Number(chart.getAttribute("data-zoom-center"));
    fireEvent.click(screen.getByTestId("lob-pan-right"));

    expect(Number(chart.getAttribute("data-zoom-center"))).toBeGreaterThan(
      centerBeforePan,
    );

    fireEvent.click(screen.getByTestId("lob-zoom-reset"));

    expect(chart).toHaveAttribute("data-zoom", "1");
    expect(chart).toHaveAttribute("data-zoom-center", "0.500");
    expect(screen.getByTestId("lob-zoom-value")).toHaveTextContent("100%");

    const svg = screen.getByTestId("lob-chart-svg");
    Object.defineProperty(svg, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 400,
        height: 400,
        left: 0,
        right: 980,
        top: 0,
        width: 980,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.wheel(svg, { clientX: 230, deltaY: -100 });

    expect(chart).toHaveAttribute("data-zoom", "1.5");
    expect(Number(chart.getAttribute("data-zoom-center"))).toBeLessThan(0.5);

    fireEvent.click(screen.getByTestId("lob-zoom-reset"));

    fireEvent.click(screen.getByRole("button", { name: "Semanas" }));

    expect(screen.getByRole("button", { name: "Semanas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(chart).toHaveAttribute("data-scale", "week");

    const weekLabels = screen
      .getAllByTestId("lob-x-tick-label")
      .map((label) => label.textContent ?? "");

    expect(weekLabels.some((label) => /^S\d+ - /.test(label))).toBe(true);
    expect(weekLabels.join("|")).not.toBe(monthLabels.join("|"));

    const bottleneckSwitch = screen.getByRole("switch", { name: /Cuellos/ });
    expect(bottleneckSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(bottleneckSwitch);

    expect(bottleneckSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("lob-bottleneck-markers")).toBeInTheDocument();

    const marker = screen.getAllByTestId("lob-bottleneck-marker")[0];
    fireEvent.click(marker);

    expect(screen.getByTestId("lob-bottleneck-tooltip")).toHaveTextContent(
      "Cuello de botella",
    );
  });
});
