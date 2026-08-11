/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExecutivePlanningDashboard from "./ExecutivePlanningDashboard";
import {
  buildExecutivePlanningSummary,
  type ExecutivePlanningSummary,
} from "@/lib/gantt/executiveDashboard";

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
    // Al portapapeles va TSV desde el 2026-08-11: con comas, Excel pegaba todo
    // en una sola columna. Las columnas son las mismas.
    expect(writeText.mock.calls[0][0]).toContain(
      "KPI\tAvance\t45.0%\tSPI 0.82",
    );
    await waitFor(() =>
      expect(screen.getByTestId("executive-report-export-status")).toHaveTextContent("Copiado"),
    );

    fireEvent.click(screen.getByTestId("executive-report-print"));

    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("executive-report-export-status")).toHaveTextContent("Listo para PDF");
  });
});

describe("el tablero informa bien o dice que no sabe (M1, M3, M8)", () => {
  const vacio = buildExecutivePlanningSummary({
    tasks: [],
    budgetItems: [],
    budgetMappings: [],
    scheduleIssues: [],
    bottlenecks: [],
  });

  test("un proyecto vacío muestra «aún no hay datos», no «Controlado»", () => {
    render(<ExecutivePlanningDashboard summary={vacio} />);

    expect(screen.getByTestId("executive-no-data")).toHaveTextContent(
      /aún no hay datos/i,
    );
    expect(screen.queryByText("Controlado")).not.toBeInTheDocument();
  });

  test("muestra a qué día corresponden las cifras", () => {
    render(
      <ExecutivePlanningDashboard
        summary={{ ...vacio, statusDate: "2026-08-07" }}
      />,
    );

    expect(screen.getByTestId("executive-status-date")).toHaveTextContent(
      "07/08/2026",
    );
  });

  test("sin fecha de corte lo dice, en vez de callarlo", () => {
    render(<ExecutivePlanningDashboard summary={vacio} />);

    expect(screen.getByTestId("executive-status-date")).toHaveTextContent(
      /sin fecha de corte/i,
    );
  });

  test("cada señal lleva a su detalle", () => {
    const onNavigate = jest.fn();
    render(
      <ExecutivePlanningDashboard summary={vacio} onNavigate={onNavigate} />,
    );

    fireEvent.click(screen.getAllByTestId("executive-signal")[0]);

    expect(onNavigate).toHaveBeenCalled();
  });

  test("sin forma de navegar, las tarjetas no fingen ser botones", () => {
    render(<ExecutivePlanningDashboard summary={vacio} />);

    expect(screen.getAllByTestId("executive-signal")[0].tagName).not.toBe(
      "BUTTON",
    );
  });
});

/**
 * «Copiar para Excel» mandaba el CSV con comas, y Excel al pegar lo dejaba
 * **todo en una columna**. Y el CSV descargado salía sin marca de orden de
 * bytes, así que las tildes se rompían al abrirlo.
 */
describe("el informe llega a Excel como una tabla, no como un churro", () => {
  const summary = {
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
        detail: "2 tareas críticas",
        recommendation: "Priorizar restricciones.",
      },
    ],
  } as unknown as ExecutivePlanningSummary;

  test("copiar manda tabuladores, que es lo que Excel reparte en columnas", async () => {
    const copiado: string[] = [];
    // `navigator.clipboard` es de solo lectura, igual que en el test de arriba.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: jest.fn(async (t: string) => {
          copiado.push(t);
        }),
      },
    });

    render(<ExecutivePlanningDashboard summary={summary} />);
    fireEvent.click(screen.getByTestId("executive-report-copy"));

    await waitFor(() => expect(copiado.length).toBe(1));
    expect(copiado[0]).toContain("\t");
    expect(copiado[0].split("\n")[0]).not.toContain(",");
  });

  test("la descarga lleva la marca que hace que Excel respete las tildes", () => {
    let contenido = "";
    const BlobOriginal = global.Blob;
    global.Blob = class extends BlobOriginal {
      constructor(partes: BlobPart[], opciones?: BlobPropertyBag) {
        contenido = String(partes[0]);
        super(partes, opciones);
      }
    } as unknown as typeof Blob;
    global.URL.createObjectURL = jest.fn(() => "blob:x");
    global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExecutivePlanningDashboard summary={summary} />);
    fireEvent.click(screen.getByTestId("executive-report-download"));

    expect(contenido.startsWith("﻿")).toBe(true);

    global.Blob = BlobOriginal;
    jest.restoreAllMocks();
  });
});
