/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExecutivePlanningDashboard from "./ExecutivePlanningDashboard";
import type { ExecutivePlanningSummary } from "@/lib/gantt/executiveDashboard";

describe("ExecutivePlanningDashboard", () => {
  test("renders KPIs and triple-constraint signals", () => {
    const summary: ExecutivePlanningSummary = {
      health: "warning",
      kpis: [
        {
          id: "progress",
          label: "Avance",
          value: "45.0%",
          detail: "SPI 0.82",
          health: "warning",
        },
      ],
      signals: [
        {
          dimension: "schedule",
          health: "warning",
          title: "Cronograma",
          detail: "2 tareas criticas · SPI 0.82",
          recommendation: "Priorizar restricciones.",
        },
      ],
    };

    render(<ExecutivePlanningDashboard summary={summary} />);

    expect(screen.getByTestId("executive-planning-dashboard")).toHaveTextContent(
      "Dashboard ejecutivo",
    );
    expect(screen.getByTestId("executive-kpi")).toHaveTextContent("45.0%");
    expect(screen.getByTestId("executive-signal")).toHaveTextContent("Cronograma");
  });

  test("exports the executive report to clipboard and print/PDF", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const print = jest.fn();
    Object.defineProperty(window, "print", {
      configurable: true,
      value: print,
    });
    const summary: ExecutivePlanningSummary = {
      health: "warning",
      kpis: [
        {
          id: "progress",
          label: "Avance",
          value: "45.0%",
          detail: "SPI 0.82",
          health: "warning",
        },
      ],
      signals: [
        {
          dimension: "schedule",
          health: "warning",
          title: "Cronograma",
          detail: "2 tareas criticas · SPI 0.82",
          recommendation: "Priorizar restricciones.",
        },
      ],
    };

    render(<ExecutivePlanningDashboard summary={summary} />);

    fireEvent.click(screen.getByTestId("executive-report-copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("KPI,Avance,45.0%,SPI 0.82");
    await waitFor(() =>
      expect(screen.getByTestId("executive-report-export-status")).toHaveTextContent("Copiado"),
    );

    fireEvent.click(screen.getByTestId("executive-report-print"));

    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("executive-report-export-status")).toHaveTextContent("Listo para PDF");
  });
});
