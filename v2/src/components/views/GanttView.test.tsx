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
import * as mppCalculationEngine from "@/lib/mpp/mppCalculationEngine";
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

  test("opens the command palette with keyboard and switches views", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "matriz" },
    });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
    expect(await screen.findByTestId("matrix-editor-empty")).toBeInTheDocument();
  });

  test("offers the network diagram view from the command palette", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "red" },
    });

    fireEvent.click(screen.getByTestId("command-palette-item-view-network"));

    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
    expect(await screen.findByTestId("network-diagram-view")).toBeInTheDocument();
  });

  test("runs editing commands from the command palette", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("command-palette-open"));
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "agregar" },
    });
    fireEvent.click(screen.getByTestId("command-palette-item-add-task"));

    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("gantt-row")).toHaveLength(2);
  });

  test("skips full MPP calculation on Gantt view when MPP columns are hidden", () => {
    const calculateSpy = jest.spyOn(mppCalculationEngine, "calculateMppFields");

    render(
      <GanttView
        projectName="Cronograma importado"
        tasks={[makeTask({ id: 1, mppFields: { DURATION: 5 } })]}
        calculationEngineVersion="mpp-calc-v1"
        mppTaskColumns={[
          {
            key: "mpp:DURATION",
            fieldId: "DURATION",
            label: "Duration",
            dataType: "DURATION",
            isEditable: false,
            recordType: "task",
          },
        ]}
      />,
    );

    expect(calculateSpy).not.toHaveBeenCalled();
    calculateSpy.mockRestore();
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
      expect(screen.getAllByText(/08\/01\/2026/).length).toBeGreaterThan(0);
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
    expect(latestSavedProject().planningAuditEvents).toEqual([
      expect.objectContaining({
        kind: "taskEdit",
        summary: "Update duration on task 1",
        taskIds: [1],
      }),
    ]);
  });

  test("autosaves persistent Gantt task filters in ui settings", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Filtros"
        tasks={[
          makeTask({ id: 1, name: "Cimentacion", isCritical: true }),
          makeTask({ id: 2, name: "Pintura" }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.change(screen.getByTestId("gantt-task-filter-input"), {
      target: { value: "ciment" },
    });
    fireEvent.change(screen.getByTestId("gantt-task-filter-type"), {
      target: { value: "critical" },
    });

    expect(screen.getByTestId("gantt-task-filter-count")).toHaveTextContent("1 / 2");

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(latestSavedProject().uiSettings).toEqual({
      locale: "es",
      taskFilter: { text: "ciment", type: "critical" },
    });
  });

  test("applies and autosaves role-based view presets", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Presets por rol"
        tasks={[
          makeTask({ id: 1, name: "Ruta critica", isCritical: true, cost: 1000 }),
          makeTask({ id: 2, name: "Actividad normal", cost: 500 }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.change(screen.getByTestId("role-view-preset-select"), {
      target: { value: "executive" },
    });

    expect(
      await screen.findByTestId("executive-planning-dashboard"),
    ).toBeInTheDocument();

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    expect(saved.uiSettings).toEqual({
      locale: "es",
      roleViewPreset: "executive",
      taskFilter: { text: "", type: "critical" },
    });
    expect(saved.taskColumnSettings.visible).toEqual([
      "wbs",
      "name",
      "finish",
      "progress",
      "critical",
      "budgetedCost",
      "actualCost",
      "variance",
    ]);
  });

  test("hydrates the active view from a persisted role preset", async () => {
    render(
      <GanttView
        projectId="1"
        projectName="Preset persistido"
        tasks={[
          makeTask({ id: 1, name: "Ruta critica", isCritical: true }),
          makeTask({ id: 2, name: "Actividad normal" }),
        ]}
        uiSettings={{
          locale: "es",
          roleViewPreset: "executive",
          taskFilter: { text: "", type: "critical" },
        }}
      />,
    );

    expect(screen.getByTestId("role-view-preset-select")).toHaveValue("executive");
    expect(
      await screen.findByTestId("executive-planning-dashboard"),
    ).toBeInTheDocument();
  });

  test("autosaves simple interaction mode and hides advanced panels", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Modo simple"
        tasks={[
          makeTask({ id: 1, name: "Ruta critica", isCritical: true }),
          makeTask({ id: 2, name: "Actividad normal" }),
        ]}
      />,
    );

    expect(screen.getByTestId("planning-assistant-panel")).toBeInTheDocument();
    expect(screen.getByTestId("what-if-scenario-panel")).toBeInTheDocument();

    mockedSaveProject.mockClear();
    fireEvent.click(screen.getByTestId("interaction-mode-simple"));

    expect(screen.queryByTestId("planning-assistant-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("what-if-scenario-panel")).not.toBeInTheDocument();

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(latestSavedProject().uiSettings).toEqual({
      locale: "es",
      interactionMode: "simple",
      taskFilter: { text: "", type: "all" },
    });
  });

  test("hydrates simple interaction mode from project data", () => {
    render(
      <GanttView
        projectId="1"
        projectName="Modo simple persistido"
        tasks={[
          makeTask({ id: 1, name: "Ruta critica", isCritical: true }),
          makeTask({ id: 2, name: "Actividad normal" }),
        ]}
        uiSettings={{
          locale: "es",
          interactionMode: "simple",
          taskFilter: { text: "", type: "all" },
        }}
      />,
    );

    expect(screen.getByTestId("interaction-mode-simple")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("interaction-mode-simple")).toHaveAttribute("data-active", "true");
    expect(screen.queryByTestId("planning-assistant-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("what-if-scenario-panel")).not.toBeInTheDocument();
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

    const view = render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[
          makeTask({
            id: 101,
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
            mppFields: { ID: 1, UID: 101 },
          }),
          makeTask({
            id: 205,
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
            dependencies: [],
            mppFields: { ID: 2, UID: 205 },
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
    const successor = latestSavedProject().tasks.find((task) => task.id === 205);
    expect(successor?.dependencies).toEqual([
      expect.objectContaining({ from: 101, to: 205, type: "FS" }),
    ]);

    const savedProject = latestSavedProject();
    view.unmount();
    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={savedProject.tasks}
      />,
    );

    const reloadedSuccessorCells = screen.getAllByTestId("gantt-row")[1].querySelectorAll("td");
    expect(reloadedSuccessorCells[8]).toHaveTextContent("1FS");
  });

  test("shows deterministic planning recommendations in the gantt view", () => {
    render(
      <GanttView
        projectId="1"
        projectName="Asistente"
        tasks={[
          makeTask({ id: 1, name: "Inicio" }),
          makeTask({ id: 2, name: "Excavacion", dependencies: [] }),
        ]}
      />,
    );

    expect(screen.getByTestId("planning-assistant-panel")).toHaveTextContent(
      "Asistente de planificacion",
    );
    expect(screen.getByTestId("planning-assistant-panel")).toHaveTextContent(
      "Excavacion no tiene predecesoras",
    );
  });

  test("renders the executive dashboard from the view sidebar", async () => {
    render(
      <GanttView
        projectId="1"
        projectName="Ejecutivo"
        tasks={[
          makeTask({ id: 1, name: "Actividad critica", isCritical: true }),
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-view-executive"));

    expect(await screen.findByTestId("executive-planning-dashboard")).toHaveTextContent(
      "Dashboard ejecutivo",
    );
    expect(screen.getAllByTestId("executive-kpi").length).toBeGreaterThan(0);
  });

  test("previews and applies structure normalization from the planning assistant", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Asistente"
        tasks={[
          makeTask({ id: 1, name: "Capitulo", wbs: "9", isSummary: false }),
          makeTask({ id: 2, name: "Actividad", wbs: "9.9", outlineLevel: 2 }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getByTestId("planning-preview-structure"));
    expect(screen.getByTestId("planning-structure-action")).toHaveTextContent("tareas cambiaran");
    fireEvent.click(screen.getByTestId("planning-cancel-structure"));
    expect(screen.queryByTestId("planning-apply-structure")).not.toBeInTheDocument();
    expect(mockedSaveProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("planning-preview-structure"));
    fireEvent.click(screen.getByTestId("planning-apply-structure"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    expect(saved.tasks.map((task) => task.wbs)).toEqual(["1", "1.1"]);
    expect(saved.tasks[0].isSummary).toBe(true);
  });

  test("compares, discards and applies a what-if duration scenario", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="What-if"
        tasks={[
          makeTask({
            id: 1,
            name: "Actividad base",
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
          }),
          makeTask({
            id: 2,
            name: "Sucesora",
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getAllByTestId("gantt-row")[0]);
    fireEvent.change(screen.getByTestId("what-if-duration-delta"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("what-if-preview"));
    expect(screen.getByTestId("what-if-summary")).toHaveTextContent("Tareas impactadas");
    fireEvent.click(screen.getByTestId("what-if-discard"));
    expect(screen.queryByTestId("what-if-summary")).not.toBeInTheDocument();
    expect(mockedSaveProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("what-if-preview"));
    fireEvent.click(screen.getByTestId("what-if-apply"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    expect(saved.tasks.find((task) => task.id === 1)?.duration).toBe(3);
  });

  test("autosaves predecessors created with the visual dependency popover", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[
          makeTask({
            id: 1,
            name: "Predecesora",
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
          }),
          makeTask({
            id: 2,
            name: "Sucesora",
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
            dependencies: [],
          }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getByTestId("dependency-popover-open-2"));
    fireEvent.change(screen.getByTestId("dependency-search"), {
      target: { value: "Predecesora" },
    });
    fireEvent.change(screen.getByTestId("dependency-type-select"), {
      target: { value: "FF" },
    });
    fireEvent.change(screen.getByTestId("dependency-lag-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("dependency-add"));
    fireEvent.click(screen.getByTestId("dependency-apply"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const successor = latestSavedProject().tasks.find((task) => task.id === 2);
    expect(successor?.dependencies).toEqual([
      expect.objectContaining({ from: 1, to: 2, type: "FF", lag: 2 }),
    ]);
  });

  test("autosaves successors created with the dependency side panel", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[
          makeTask({
            id: 1,
            name: "Predecesora",
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
          }),
          makeTask({
            id: 2,
            name: "Sucesora",
            start: createProjectDate("2026-01-05"),
            finish: createProjectDate("2026-01-05"),
            duration: 1,
            dependencies: [],
          }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getAllByTestId("gantt-row")[0]);
    fireEvent.click(screen.getByTestId("dependency-panel-open"));
    fireEvent.change(screen.getByTestId("dependency-panel-successor-type-select"), {
      target: { value: "SF" },
    });
    fireEvent.change(screen.getByTestId("dependency-panel-successor-lag-input"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByTestId("dependency-panel-add-successor"));
    fireEvent.click(screen.getByTestId("dependency-panel-apply"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const successor = latestSavedProject().tasks.find((task) => task.id === 2);
    expect(successor?.dependencies).toEqual([
      expect.objectContaining({ from: 1, to: 2, type: "SF", lag: 4 }),
    ]);
  });

  test("autosaves hierarchy edits from the table toolbar", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Persistencia"
        tasks={[
          makeTask({ id: 1, name: "Capitulo" }),
          makeTask({ id: 2, name: "Actividad" }),
        ]}
      />,
    );

    mockedSaveProject.mockClear();

    const rows = screen.getAllByTestId("gantt-row");
    fireEvent.click(rows[1]);
    fireEvent.click(screen.getByTestId("hierarchy-indent"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    expect(saved.tasks.map((task) => task.outlineLevel)).toEqual([1, 2]);
    expect(saved.tasks.map((task) => task.wbs)).toEqual(["1", "1.1"]);
    expect(saved.tasks[0].isSummary).toBe(true);
  });

  test("autosaves construction structure templates from the table toolbar", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Plantillas"
        tasks={[makeTask({ id: 1, name: "Actividad base" })]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getByTestId("hierarchy-apply-template"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    expect(saved.tasks.map((task) => task.name)).toEqual(
      expect.arrayContaining([
        "Obra gris",
        "Preliminares",
        "Cimentacion",
        "Estructura",
        "Vaciado de concreto",
      ]),
    );
    expect(saved.tasks.find((task) => task.name === "Vaciado de concreto")?.dependencies).toEqual([
      expect.objectContaining({ type: "FS", lag: 0 }),
    ]);
    expect(saved.planningAuditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "structureEdit",
          summary: "Apply structure template obra-gris-basica",
        }),
      ]),
    );
  });

  test("autosaves smart pasted Excel rows as project tasks", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Smart paste"
        tasks={[makeTask({ id: 1, name: "Existente" })]}
      />,
    );

    mockedSaveProject.mockClear();

    fireEvent.click(screen.getByTestId("smart-paste-open"));
    fireEvent.change(screen.getByTestId("smart-paste-textarea"), {
      target: {
        value: "Actividad\tInicio\tDuración\t% completado\tNivel\nCapitulo\t2026-02-01\t1\t0\t1\nFormaleta\t2026-02-02\t3\t25\t2",
      },
    });
    fireEvent.click(screen.getByTestId("smart-paste-apply"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    const saved = latestSavedProject();
    expect(saved.tasks.map((task) => task.name)).toEqual([
      "Existente",
      "Capitulo",
      "Formaleta",
    ]);
    expect(saved.tasks[1]).toEqual(
      expect.objectContaining({ isSummary: true, wbs: "2" }),
    );
    expect(saved.tasks[2]).toEqual(
      expect.objectContaining({ duration: 3, progress: 25, wbs: "2.1" }),
    );
    expect(saved.planningAuditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "taskEdit",
          summary: "Smart paste tasks from Excel",
        }),
      ]),
    );
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
        }),
      }),
    ]);
    expect(saved.assignments).toEqual([
      expect.objectContaining({
        taskId: assignment.taskId,
        resourceId: assignment.resourceId,
        mppFields: expect.objectContaining({
          Text1: "Asignacion importada",
        }),
      }),
    ]);
    expect(saved.budgetItems).toEqual([budgetItem]);
    expect(saved.budgetMappings).toEqual([budgetMapping]);
    expect(saved.baselines).toEqual([baseline]);
    expect(saved.tasks[0].mppFields).toEqual(
      expect.objectContaining({ Text1: "Contrato" }),
    );
    expect(saved.mppTaskColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "Text1",
        labelEn: "Text 1",
        labelEs: "Texto 1",
      }),
    ]));
    expect(saved.mppResourceColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "Text1",
        labelEn: "Text 1",
        labelEs: "Texto 1",
      }),
    ]));
    expect(saved.mppAssignmentColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "Text1",
        labelEn: "Text 1",
        labelEs: "Texto 1",
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
    fireEvent.change(await screen.findByLabelText("Fecha no laboral"), {
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

    fireEvent.click(screen.getByTestId("command-palette-open"));
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "matriz" },
    });
    fireEvent.keyDown(window, { key: "Enter" });
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

describe("recorte del menú: nada se pierde (C3, C5)", () => {
  test("la vista Problemas monta las dos secciones", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("sidebar-view-bottlenecks"));

    expect(
      await screen.findByTestId("problems-section-bottlenecks"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("problems-section-conflicts")).toBeInTheDocument();
  });

  test("Diagrama de Red sigue accesible desde la paleta de comandos", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByTestId("command-palette-item-view-network")).toBeInTheDocument();
  });
});
