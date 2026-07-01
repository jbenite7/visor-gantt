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
import type { MatrixPlan } from "@/types/matrix";

jest.mock("@/app/actions/project", () => ({
  saveProject: jest.fn(async () => ({ success: true, id: "test-project" })),
}));

const mockedSaveProject = saveProject as jest.MockedFunction<typeof saveProject>;

jest.setTimeout(30_000);

async function flushAutosave() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_000);
  });
  await act(async () => {
    await Promise.resolve();
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

function createSingleCellMatrixPlan(): MatrixPlan {
  return {
    id: "matrix-gantt",
    name: "Matriz Gantt",
    startDate: "2026-01-05",
    scopeTree: [
      {
        id: "estructura",
        name: "Estructura",
        type: "Disciplina",
        defaultRecipeId: "concreto",
      },
    ],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "concreto",
        name: "Concreto estructura",
        activities: [
          {
            id: "formaleta",
            name: "Formaleta",
            productivityPerDay: 50,
            defaultQuantity: 100,
            unit: "m2",
          },
        ],
        dependencies: [],
      },
    ],
    cells: [
      {
        id: "cell-estructura-piso-1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "concreto",
        active: true,
        activityOverrides: [
          {
            activityId: "formaleta",
            quantity: 100,
            unit: "m2",
            productivityPerDay: 50,
            lastEditedAt: "2026-01-01T00:00:00.000Z",
            lastEditedFrom: "matrix",
          },
        ],
        lastEditedAt: "2026-01-01T00:00:00.000Z",
        lastEditedFrom: "matrix",
      },
    ],
  };
}

function makeLinkedMatrixTask(): GanttTask {
  return makeTask({
    id: "mx-task-cell-estructura-piso-1-formaleta",
    name: "Estructura - Formaleta - Piso 1",
    finish: createProjectDate("2026-01-06"),
    duration: 2,
    matrixSource: {
      matrixPlanId: "matrix-gantt",
      scopeId: "estructura",
      areaId: "piso-1",
      cellId: "cell-estructura-piso-1",
      recipeId: "concreto",
      activityId: "formaleta",
    },
    matrixSync: {
      lastEditedAt: "2026-01-01T00:00:00.000Z",
      lastEditedFrom: "matrix",
    },
  });
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
      mppFields: { Text1: "Recurso importado" },
    };
    const assignment = {
      taskId: 1,
      resourceId: 10,
      units: 100,
      cost: 960,
      mppFields: { Text1: "Asignacion importada" },
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
        tasks={[
          makeTask({
            id: 1,
            duration: 1,
            mppFields: { Text1: "Contrato" },
          }),
        ]}
        resources={[resource]}
        assignments={[assignment]}
        budgetItems={[budgetItem]}
        budgetMappings={[budgetMapping]}
        baselines={[baseline]}
        mppTaskColumns={[
          {
            key: "mpp:Text1",
            fieldId: "TEXT_1",
            sourceKey: "Text1",
            labelEn: "Text 1",
            labelEs: "Texto 1",
            dataType: "string",
            group: "custom",
            isCustom: true,
            isCore: false,
            isEditable: false,
          },
        ]}
        mppResourceColumns={[
          {
            key: "mpp:resource:Text1",
            fieldId: "TEXT_1",
            sourceKey: "Text1",
            labelEn: "Text 1",
            labelEs: "Texto 1",
            dataType: "string",
            group: "custom",
            recordType: "resource",
            isCustom: true,
            isCore: false,
            isEditable: false,
          },
        ]}
        mppAssignmentColumns={[
          {
            key: "mpp:assignment:Text1",
            fieldId: "TEXT_1",
            sourceKey: "Text1",
            labelEn: "Text 1",
            labelEs: "Texto 1",
            dataType: "string",
            group: "custom",
            recordType: "assignment",
            isCustom: true,
            isCore: false,
            isEditable: false,
          },
        ]}
        taskColumnSettings={{
          visible: ["id", "name", "duration", "mpp:Text1"],
          widths: { "mpp:Text1": 160 },
          labelLocale: "es",
        }}
        resourceColumnSettings={{
          visible: ["uid", "name", "type", "mpp:resource:Text1"],
          widths: { "mpp:resource:Text1": 160 },
          labelLocale: "es",
        }}
        assignmentColumnSettings={{
          visible: ["taskId", "resourceId", "units", "mpp:assignment:Text1"],
          widths: { "mpp:assignment:Text1": 160 },
          labelLocale: "es",
        }}
        uiSettings={{ locale: "es" }}
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
    expect(saved.resources).toEqual([
      expect.objectContaining({
        uid: resource.uid,
        name: resource.name,
        mppFields: expect.objectContaining({
          Text1: "Recurso importado",
          WORK: expect.any(Number),
          COST: expect.any(Number),
          __calculationEngineVersion: "mpp-calc-v1",
        }),
      }),
    ]);
    expect(saved.assignments).toEqual([
      expect.objectContaining({
        taskId: assignment.taskId,
        resourceId: assignment.resourceId,
        mppFields: expect.objectContaining({
          Text1: "Asignacion importada",
          WORK: expect.any(Number),
          COST: expect.any(Number),
          __calculationEngineVersion: "mpp-calc-v1",
        }),
      }),
    ]);
    expect(saved.budgetItems).toEqual([budgetItem]);
    expect(saved.budgetMappings).toEqual([budgetMapping]);
    expect(saved.baselines).toEqual([baseline]);
    expect(saved.tasks[0].mppFields).toEqual(expect.objectContaining({
      Text1: "Contrato",
      START: expect.any(String),
      FINISH: expect.any(String),
      DURATION: 3,
      __calculationEngineVersion: "mpp-calc-v1",
    }));
    expect(saved.mppTaskColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "Text1",
        labelEn: "Text 1",
        labelEs: "Texto 1",
      }),
      expect.objectContaining({
        fieldId: "ACTUAL_COST",
        labelEn: "Actual Cost",
      }),
    ]));
    expect(saved.mppResourceColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "Text1",
        labelEn: "Text 1",
        labelEs: "Texto 1",
      }),
      expect.objectContaining({
        fieldId: "WINDOWS_USER_ACCOUNT",
        labelEn: "Windows User Account",
      }),
    ]));
    expect(saved.mppAssignmentColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "Text1",
        labelEn: "Text 1",
        labelEs: "Texto 1",
      }),
      expect.objectContaining({
        fieldId: "ACTUAL_WORK",
        labelEn: "Actual Work",
      }),
    ]));
    expect(saved.taskColumnSettings).toEqual({
      visible: ["id", "name", "duration", "mpp:Text1"],
      widths: { "mpp:Text1": 160 },
      labelLocale: "es",
    });
    expect(saved.resourceColumnSettings).toEqual({
      visible: ["uid", "name", "type", "mpp:resource:Text1"],
      widths: { "mpp:resource:Text1": 160 },
      labelLocale: "es",
    });
    expect(saved.assignmentColumnSettings).toEqual({
      visible: ["taskId", "resourceId", "units", "mpp:assignment:Text1"],
      widths: { "mpp:assignment:Text1": 160 },
      labelLocale: "es",
    });
    expect(saved.uiSettings).toEqual({ locale: "es" });
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

    fireEvent.click(screen.getByTitle("Guardar línea base"));

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
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={generated.tasks}
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

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    await waitFor(() => {
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
  }, 20_000);

  test("autosyncs linked Gantt duration edits back into the matrix plan", async () => {
    jest.useFakeTimers();
    const matrixPlan = createSingleCellMatrixPlan();
    const formaletaTask = makeLinkedMatrixTask();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[formaletaTask]}
        matrixPlan={matrixPlan}
      />,
    );

    mockedSaveProject.mockClear();

    const formaletaRow = document.querySelector(
      `[data-task-id="${formaletaTask.id}"]`,
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
  }, 20_000);
});
