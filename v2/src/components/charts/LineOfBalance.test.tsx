/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import LineOfBalance from "./LineOfBalance";
import type { LOBActivity, LOBUnit } from "@/types/lob";

describe("LineOfBalance", () => {
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

    expect(screen.getByTestId("lob-feedback")).toHaveTextContent("Estructura");
    expect(screen.getAllByTestId("lob-feedback-card").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Meses" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Semanas" }));

    expect(screen.getByRole("button", { name: "Semanas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
