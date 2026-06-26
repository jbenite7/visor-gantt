/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";
import BottlenecksView from "./BottlenecksView";

describe("BottlenecksView", () => {
  test("renders schedule issues and bottlenecks", () => {
    const issues: ScheduleIssue[] = [
      {
        kind: "cycle",
        severity: "high",
        taskIds: [1, 2],
        message: "Las dependencias contienen un ciclo.",
      },
    ];
    const bottlenecks: Bottleneck[] = [
      {
        kind: "critical",
        severity: "high",
        taskIds: [1],
        metric: "Holgura: 0d",
        message: "Excavacion esta en la ruta critica.",
      },
      {
        kind: "resourceOverallocation",
        severity: "high",
        taskIds: [1, 2],
        resourceId: 7,
        metric: "125% / 100%",
        message: "Equipo A esta sobreasignado.",
      },
    ];

    render(<BottlenecksView issues={issues} bottlenecks={bottlenecks} />);

    expect(screen.getByText("Las dependencias contienen un ciclo.")).toBeInTheDocument();
    expect(screen.getByText("Excavacion esta en la ruta critica.")).toBeInTheDocument();
    expect(screen.getByText("Equipo A esta sobreasignado.")).toBeInTheDocument();
  });
});
