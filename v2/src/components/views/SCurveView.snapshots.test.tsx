/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import SCurveView from "./SCurveView";
import { listProjectSnapshots, saveProjectSnapshot } from "@/app/actions/snapshots";

// La sub-vista Cortes solo lee/escribe fotos al abrirse; sin este mock,
// importar las acciones tira de `pg` en el entorno jsdom del test.
jest.mock("@/app/actions/snapshots", () => ({
  listProjectSnapshots: jest.fn(async () => []),
  loadProjectSnapshot: jest.fn(async () => null),
  saveProjectSnapshot: jest.fn(async () => ({ success: true })),
}));

const mockedListProjectSnapshots = listProjectSnapshots as jest.MockedFunction<
  typeof listProjectSnapshots
>;
const mockedSaveProjectSnapshot = saveProjectSnapshot as jest.MockedFunction<
  typeof saveProjectSnapshot
>;

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

function abrirCortes() {
  fireEvent.click(screen.getByRole("button", { name: "Cortes" }));
}

describe("SCurveView · sub-vista Cortes", () => {
  beforeEach(() => {
    mockedListProjectSnapshots.mockClear();
    mockedSaveProjectSnapshot.mockClear();
  });

  test("sin fotos guardadas explica qué es un corte y cómo conseguir el primero", async () => {
    render(
      <SCurveView
        tasks={[task({ id: 1 })]}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2026-01-20"
        projectId="proj-1"
      />,
    );

    abrirCortes();

    await waitFor(() => expect(mockedListProjectSnapshots).toHaveBeenCalledWith("proj-1"));
    expect(screen.getByTestId("snapshots-board-empty")).toHaveTextContent(
      /corte|Microsoft Project/i,
    );
  });

  test("con fotos guardadas, la sub-vista las lista", async () => {
    mockedListProjectSnapshots.mockResolvedValueOnce([
      {
        id: "snap-1",
        name: "Corte de enero",
        origin: "manual",
        capturedAt: createProjectDate("2026-01-10"),
        taskCount: 1,
      },
    ]);

    render(
      <SCurveView
        tasks={[task({ id: 1 })]}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2026-01-20"
        projectId="proj-1"
      />,
    );

    abrirCortes();

    expect(await screen.findByText("Corte de enero")).toBeInTheDocument();
  });

  test("marcar un corte a mano lo guarda", async () => {
    render(
      <SCurveView
        tasks={[task({ id: 1 })]}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2026-01-20"
        projectId="proj-1"
      />,
    );

    abrirCortes();
    await waitFor(() => expect(mockedListProjectSnapshots).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId("snapshots-board-mark-name"), {
      target: { value: "Corte manual" },
    });
    fireEvent.click(screen.getByTestId("snapshots-board-mark"));

    await waitFor(() => expect(mockedSaveProjectSnapshot).toHaveBeenCalled());
  });
});
