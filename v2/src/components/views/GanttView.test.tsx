/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import GanttView from "./GanttView";
import type { GanttTask } from "@/components/gantt/types";
import { saveProject, type ProjectData } from "@/app/actions/project";
import { createProjectDate } from "@/lib/date/projectDate";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import { createDefaultMatrixPlan } from "@/lib/matrix/templates";

jest.mock("@/app/actions/project", () => ({
  saveProject: jest.fn(async () => ({ success: true, id: "test-project" })),
}));

const mockedSaveProject = saveProject as jest.MockedFunction<typeof saveProject>;

async function flushAutosave() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_000);
  });
}

function latestSavedProject(): ProjectData {
  const payload = mockedSaveProject.mock.calls.at(-1)?.[0];
  if (!payload) {
    throw new Error("Expected saveProject to have been called");
  }
  return payload;
}

function activeEditableInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    'input[data-testid="editable-cell"]',
  );
  if (!input) {
    throw new Error("Expected an active editable input");
  }
  return input;
}

function makeTask(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate("2026-01-10"),
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

describe("GanttView", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("keeps inline task-name edits visible after commit", async () => {
    render(<GanttView tasks={[makeTask({ id: 1, name: "Original" })]} />);

    const editableCells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(editableCells[0]);
    const input = screen.getByDisplayValue("Original");
    fireEvent.change(input, { target: { value: "Edited task" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getAllByText("Edited task").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Original")).not.toBeInTheDocument();
  });

  test("shows the loaded project name in the toolbar", () => {
    render(
      <GanttView
        projectName="Cronograma importado"
        tasks={[makeTask({ id: 1 })]}
      />,
    );

    const toolbar = screen.getByTestId("project-toolbar");
    expect(within(toolbar).getByText("Cronograma importado")).toBeInTheDocument();
    expect(within(toolbar).queryByText("Proyecto sin nombre")).not.toBeInTheDocument();
  });

  test("recalculates successor dates after inline duration edits", async () => {
    render(
      <GanttView
        tasks={[
          makeTask({
            id: 1,
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
          }),
          makeTask({
            id: 2,
            start: createProjectDate("2026-01-06"),
            finish: createProjectDate("2026-01-06"),
            duration: 1,
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
      />,
    );

    const editableCells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(editableCells[1]);
    const input = screen.getByDisplayValue("1");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/08 de ene de 2026/)).toBeInTheDocument();
    });
  });

  test("autosaves task duration edits", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[makeTask({ id: 1, duration: 1 })]}
      />,
    );

    mockedSaveProject.mockClear();

    const editableCells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(editableCells[1]);
    const input = screen.getByDisplayValue("1");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(latestSavedProject().tasks[0].duration).toBe(3);
  });

  test("autosaves task start date edits with the manual start constraint", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[makeTask({ id: 1, duration: 2 })]}
      />,
    );

    mockedSaveProject.mockClear();

    const editableCells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(editableCells[2]);
    const input = activeEditableInput();
    fireEvent.change(input, { target: { value: "2026-01-07" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const task = latestSavedProject().tasks[0];
    expect(task.start).toEqual(createProjectDate("2026-01-07"));
    expect(task.manualStart).toEqual(createProjectDate("2026-01-07"));
  });

  test("autosaves predecessor edits as canonical successor dependencies", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[
          makeTask({
            id: 1,
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
          }),
          makeTask({
            id: 2,
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
            dependencies: [],
          }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    const editableCells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(editableCells[10]);
    const input = activeEditableInput();
    fireEvent.change(input, { target: { value: "1FS" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const successor = latestSavedProject().tasks.find((task) => task.id === 2);
    expect(successor?.dependencies).toEqual([
      expect.objectContaining({ from: 1, to: 2, type: "FS" }),
    ]);
  });

  test("preserves loaded project side data when autosaving task edits", async () => {
    jest.useFakeTimers();

    const resource = {
      uid: 10,
      name: "Cuadrilla A",
      type: "work" as const,
      rate: 120,
    };
    const assignment = {
      taskId: 1,
      resourceId: 10,
      units: 100,
      cost: 960,
    };
    const budgetItem = {
      id: "budget-1",
      category: "labor" as const,
      budgetedAmount: 1000,
      spentAmount: 200,
      mappedTaskIds: [1],
    };
    const budgetMapping = {
      budgetItemId: "budget-1",
      taskId: 1,
      amount: 1000,
    };
    const baseline = {
      id: "baseline-1",
      name: "Baseline 1",
      createdAt: createProjectDate("2026-01-01"),
      tasks: [
        {
          taskId: 1,
          baselineStart: createProjectDate("2026-01-05"),
          baselineFinish: createProjectDate("2026-01-06"),
          baselineDuration: 2,
          baselineCost: 960,
        },
      ],
    };

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[makeTask({ id: 1, duration: 1 })]}
        resources={[resource]}
        assignments={[assignment]}
        budgetItems={[budgetItem]}
        budgetMappings={[budgetMapping]}
        baselines={[baseline]}
      />,
    );

    mockedSaveProject.mockClear();

    const editableCells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(editableCells[1]);
    const input = screen.getByDisplayValue("1");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    expect(saved.resources).toEqual([resource]);
    expect(saved.assignments).toEqual([assignment]);
    expect(saved.budgetItems).toEqual([budgetItem]);
    expect(saved.budgetMappings).toEqual([budgetMapping]);
    expect(saved.baselines).toEqual([baseline]);
  });

  test("autosaves added non-working days in the project calendar", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[makeTask({ id: 1 })]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getByTestId("sidebar-view-settings"));
    fireEvent.change(screen.getByLabelText("Fecha no laboral"), {
      target: { value: "2026-01-06" },
    });
    fireEvent.change(screen.getByLabelText("Nombre del día no laboral"), {
      target: { value: "Festivo de prueba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(latestSavedProject().calendar.nonWorkingDays).toEqual([
      { id: expect.any(String), date: "2026-01-06", name: "Festivo de prueba" },
    ]);
  });

  test("autosaves baseline snapshots", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[makeTask({ id: 1, duration: 2 })]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getByTitle("Guardar Baseline"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(latestSavedProject().baselines).toHaveLength(1);
    expect(latestSavedProject().baselines[0].tasks[0]).toEqual(
      expect.objectContaining({
        taskId: 1,
        baselineDuration: 2,
      }),
    );
  });

  test("integrates matrix view with project autosave", async () => {
    jest.useFakeTimers();
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-gantt",
      name: "Matriz Gantt",
      startDate: "2026-01-05",
    });

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[makeTask({ id: "mx-task-cell-piso-1-estructura-formaleta" })]}
        matrixPlan={matrixPlan}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getByTestId("sidebar-view-matrix"));
    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Piso 1"));
    fireEvent.change(screen.getByLabelText("Cantidad Formaleta"), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    await flushAutosave();

    await waitFor(() => {
      const saved = latestSavedProject();
      expect(saved.matrixPlan?.cells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            activityOverrides: expect.arrayContaining([
              expect.objectContaining({
                activityId: "formaleta",
                quantity: 250,
                lastEditedFrom: "matrix",
              }),
            ]),
          }),
        ]),
      );
      expect(saved.tasks.some((task) => task.matrixSource != null)).toBe(true);
    });
  });

  test("autosyncs linked Gantt duration edits back into the matrix plan", async () => {
    jest.useFakeTimers();
    const matrixPlan = createDefaultMatrixPlan({
      id: "matrix-gantt",
      name: "Matriz Gantt",
      startDate: "2026-01-05",
    });
    const generated = generateScheduleFromMatrix(matrixPlan);
    const formaletaTask = generated.tasks.find(
      (task) => task.matrixSource?.activityId === "formaleta" && !task.isSummary,
    );
    expect(formaletaTask).toBeDefined();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={generated.tasks}
        matrixPlan={matrixPlan}
      />,
    );

    mockedSaveProject.mockClear();

    const formaletaRow = document.querySelector(
      `[data-task-id="${formaletaTask?.id}"]`,
    );
    if (!formaletaRow) {
      throw new Error("Expected the generated Formaleta row to be visible");
    }

    const editableCells = within(formaletaRow as HTMLElement).getAllByTestId(
      "editable-cell",
    );
    fireEvent.doubleClick(editableCells[1]);
    const input = activeEditableInput();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(
      latestSavedProject()
        .matrixPlan?.cells.flatMap((cell) => cell.activityOverrides ?? []),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: "formaleta",
          lastEditedFrom: "gantt",
          productivityPerDay: expect.any(Number),
        }),
      ]),
    );
  });
});
