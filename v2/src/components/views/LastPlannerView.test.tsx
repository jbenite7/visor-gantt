/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import LastPlannerView from "./LastPlannerView";
import type { GanttTask } from "@/components/gantt/types";
import type { LastPlannerPreview } from "@/lib/integrations/lastPlanner";
import { createProjectDate } from "@/lib/date/projectDate";

function tarea(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Tarea ${overrides.id}`,
    start: createProjectDate("2026-08-10"),
    finish: createProjectDate("2026-08-14"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

const preview: LastPlannerPreview = {
  generatedAt: "2026-08-07T12:00:00.000Z",
  windowStart: "2026-08-10",
  windowEnd: "2026-08-23",
  weeks: [
    {
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      commitments: [
        {
          taskId: 1,
          name: "Excavación eje 3",
          wbs: "1.2",
          start: "2026-08-10",
          finish: "2026-08-14",
          duration: 5,
          percentComplete: 0,
          isCritical: true,
          weekStart: "2026-08-10",
          weekEnd: "2026-08-16",
          constraints: [
            {
              type: "predecessorIncomplete",
              taskId: 2,
              message: "La actividad anterior no está terminada",
            },
          ],
        },
      ],
    },
  ],
  summary: {
    totalCommitments: 1,
    constrainedCommitments: 1,
    criticalCommitments: 1,
  },
};

function mockFetch(respuesta: unknown, ok = true) {
  const fetchMock = jest.fn(async () => ({
    ok,
    json: async () => respuesta,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("los compromisos semanales salen de la API que ya existía (M26)", () => {
  test("llama a la API con las tareas del proyecto", async () => {
    const fetchMock = mockFetch(preview);

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/integrations/last-planner/preview");
    expect(JSON.parse(init.body as string).tasks).toHaveLength(1);
  });

  test("pinta las semanas y sus compromisos", async () => {
    mockFetch(preview);

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} />);

    expect(await screen.findByText("Excavación eje 3")).toBeInTheDocument();
    expect(screen.getByTestId("lps-summary")).toHaveTextContent("1 compromiso");
  });

  test("muestra la restricción que impide comprometer la actividad", async () => {
    mockFetch(preview);

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} />);

    expect(
      await screen.findByText(/la actividad anterior no está terminada/i),
    ).toBeInTheDocument();
  });

  test("si la API falla, lo dice en vez de quedarse en blanco", async () => {
    mockFetch({}, false);

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} />);

    expect(
      await screen.findByText(/no pudimos armar los compromisos/i),
    ).toBeInTheDocument();
  });

  test("sin tareas explica qué falta y no llama a la API", () => {
    const fetchMock = mockFetch(preview);

    render(<LastPlannerView tasks={[]} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("lps-empty")).toHaveTextContent(/cronograma/i);
  });

  test("se puede exportar el compromiso para compartirlo con la obra", async () => {
    mockFetch(preview);

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} />);

    expect(await screen.findByTestId("lps-export")).toBeInTheDocument();
  });
});
