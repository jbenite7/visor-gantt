import { NextRequest } from "next/server";
import { POST } from "./route";
import { saveProject } from "@/app/actions/project";
import type { ProjectData as ParsedMppProject } from "@/lib/parser/mpp-parser";

jest.mock("@/app/actions/project", () => ({
  saveProject: jest.fn(),
}));

const parsedProject: ParsedMppProject = {
  name: "Contrato MPP",
  startDate: "2026-01-01",
  finishDate: "2026-01-08",
  tasks: [
    {
      UID: 1,
      ID: 1,
      Name: "Capitulo importado",
      Start: "2026-01-01T08:00:00",
      Finish: "2026-01-08T17:00:00",
      Duration: "P8D",
      DurationFormat: 7,
      PercentComplete: 10,
      Summary: true,
      Milestone: false,
      OutlineLevel: 1,
      WBS: "1",
    },
    {
      UID: 2,
      ID: 2,
      Name: "Actividad A",
      Start: "2026-01-01T08:00:00",
      Finish: "2026-01-02T17:00:00",
      Duration: "P2D",
      DurationFormat: 7,
      PercentComplete: 25.456,
      Summary: false,
      Milestone: false,
      OutlineLevel: 2,
      WBS: "1.1",
    },
    {
      UID: 3,
      ID: 3,
      Name: "Actividad B",
      Start: "2026-01-03T08:00:00",
      Finish: "2026-01-06T17:00:00",
      Duration: "P4D",
      DurationFormat: 7,
      PercentComplete: 50,
      Summary: false,
      Milestone: false,
      OutlineLevel: 2,
      WBS: "1.2",
      PredecessorLink: [
        {
          PredecessorUID: 2,
          Type: 1,
          LinkLag: 0,
          LagFormat: 7,
        },
      ],
    },
    {
      UID: 4,
      ID: 4,
      Name: "Hito contractual",
      Start: "2026-01-06T17:00:00",
      Finish: "2026-01-06T17:00:00",
      Duration: "P0D",
      DurationFormat: 7,
      PercentComplete: 100,
      Summary: false,
      Milestone: true,
      OutlineLevel: 2,
      WBS: "1.3",
      PredecessorLink: [
        {
          PredecessorUID: 3,
          Type: 1,
          LinkLag: 0,
          LagFormat: 7,
        },
      ],
    },
  ],
  resources: [],
  assignments: [],
};

function importRequest(fileName = "contrato.mpp"): NextRequest {
  const formData = new FormData();
  formData.set("file", new File(["mpp"], fileName));
  return new NextRequest("http://localhost/api/import-mpp", {
    method: "POST",
    body: formData,
  });
}

describe("/api/import-mpp", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn(async () =>
      Response.json(parsedProject),
    ) as jest.Mock;
    (saveProject as jest.Mock).mockResolvedValue({
      success: true,
      id: "project-123",
    });
  });

  test("builds and saves imported project with automatic matrix parity", async () => {
    const response = await POST(importRequest());
    const savedProject = (saveProject as jest.Mock).mock.calls[0][0];

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/project/project-123",
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mpp-parser:8000/api/parse-mpp",
      expect.objectContaining({ method: "POST" }),
    );
    expect(savedProject.matrixPlan).toEqual(
      expect.objectContaining({
        id: "matrix-mpp-contrato-mpp",
        templateId: "mpp-import",
        ganttDependencies: [
          { from: 2, to: 3, type: "FS", lag: 0 },
          { from: 3, to: 4, type: "FS", lag: 0 },
        ],
      }),
    );
    expect(savedProject.matrixPlan.cells).toHaveLength(3);
    expect(savedProject.matrixPlan.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cell-4",
          activityOverrides: [
            expect.objectContaining({
              sourceTaskId: 4,
              duration: 0,
              percentComplete: 100,
              isMilestone: true,
            }),
          ],
        }),
      ]),
    );
    expect(savedProject.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 2,
          name: "Actividad A",
          matrixSource: expect.objectContaining({
            matrixPlanId: "matrix-mpp-contrato-mpp",
            cellId: "cell-2",
          }),
        }),
        expect.objectContaining({
          id: 3,
          name: "Actividad B",
          dependencies: [{ from: 2, to: 3, type: "FS", lag: 0 }],
          matrixSource: expect.objectContaining({
            matrixPlanId: "matrix-mpp-contrato-mpp",
            cellId: "cell-3",
          }),
        }),
        expect.objectContaining({
          id: 4,
          name: "Hito contractual",
          duration: 0,
          isMilestone: true,
          dependencies: [{ from: 3, to: 4, type: "FS", lag: 0 }],
          matrixSource: expect.objectContaining({
            matrixPlanId: "matrix-mpp-contrato-mpp",
            cellId: "cell-4",
          }),
        }),
      ]),
    );
  });

  test("rejects non-mpp files before calling parser", async () => {
    const response = await POST(importRequest("contrato.xml"));

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(saveProject).not.toHaveBeenCalled();
  });
});
