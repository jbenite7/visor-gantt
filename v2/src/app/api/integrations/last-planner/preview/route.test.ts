import { NextRequest } from "next/server";
import { POST } from "./route";
import type { GanttTask } from "@/components/gantt/types";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/integrations/last-planner/preview", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
}

function task(overrides: Partial<GanttTask> & { id: string | number }): Record<string, unknown> {
  const base: GanttTask = {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00.000Z"),
    finish: new Date("2026-01-06T17:00:00.000Z"),
    duration: 2,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };

  return {
    ...base,
    start: base.start.toISOString(),
    finish: base.finish.toISOString(),
  };
}

describe("/api/integrations/last-planner/preview", () => {
  test("returns a weekly Last Planner preview from serialized Gantt tasks", async () => {
    const response = await POST(request({
      windowStart: "2026-01-07T00:00:00.000Z",
      statusDate: "2026-01-01T00:00:00.000Z",
      weeks: 2,
      tasks: [
        task({
          id: 1,
          name: "Predecesora",
          progress: 60,
        }),
        task({
          id: 2,
          name: "Actividad critica",
          isCritical: true,
          start: new Date("2026-01-08T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          dependencies: [{ from: 1, to: 2, type: "FS" }],
        }),
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.windowStart).toBe("2026-01-05");
    expect(body.windowEnd).toBe("2026-01-18");
    expect(body.summary).toEqual({
      totalCommitments: 2,
      constrainedCommitments: 1,
      criticalCommitments: 1,
    });
    expect(body.weeks[0].commitments[1]).toEqual(
      expect.objectContaining({
        taskId: 2,
        name: "Actividad critica",
        constraints: [
          expect.objectContaining({ type: "predecessorIncomplete", taskId: 1 }),
          expect.objectContaining({ type: "criticalPath" }),
        ],
      }),
    );
  });

  test("rejects requests without a task array", async () => {
    const response = await POST(request({ tasks: null }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("arreglo de tareas");
  });

  test("rejects invalid status dates", async () => {
    const response = await POST(request({
      tasks: [],
      statusDate: "no-es-fecha",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("statusDate");
  });
});
