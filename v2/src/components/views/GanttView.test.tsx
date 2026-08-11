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
import {
  EMPTY_DETECTION_DICTIONARY,
  rememberCorrection,
} from "@/lib/scheduling/detection/dictionary";

jest.mock("@/app/actions/project", () => ({
  saveProject: jest.fn(async () => ({ success: true, id: "test-project" })),
  // El editor de Matriz pide sus plantillas al servidor desde el 2026-08-11:
  // antes «Guardar como plantilla» solo tocaba memoria y se perdía al recargar.
  listMatrixTemplates: jest.fn(async () => []),
  saveMatrixTemplate: jest.fn(async () => ({ success: true, id: "t1" })),
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

    expect(screen.getByTestId("gantt-task-filter-count")).toHaveTextContent("1 oculta de 2");

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
          makeTask({ id: 1, name: "Ruta crítica", isCritical: true, cost: 1000 }),
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
          makeTask({ id: 1, name: "Ruta crítica", isCritical: true }),
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
          makeTask({ id: 1, name: "Ruta crítica", isCritical: true }),
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
          makeTask({ id: 1, name: "Ruta crítica", isCritical: true }),
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

    // El control aparece al señalar la fila (E40).
    fireEvent.mouseEnter(
      screen.getByTestId("cell-predecessors-2").closest("tr")!,
    );
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

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.change(screen.getByTestId("baseline-name-input"), {
      target: { value: "Antes de la lluvia" },
    });
    fireEvent.click(screen.getByTestId("baseline-save-confirm"));

    await flushAutosave();

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(latestSavedProject().baselines).toHaveLength(1);
    expect(latestSavedProject().baselines[0].name).toBe("Antes de la lluvia");
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

describe("ayuda de la vista activa (E8)", () => {
  test("el botón de ayuda abre el panel de la vista en la que estás", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("open-view-help"));

    expect(await screen.findByRole("dialog", { name: /ayuda/i })).toHaveTextContent(
      /gantt/i,
    );
  });

  test("al cambiar de vista, la ayuda muestra la de la vista activa, no la de Gantt", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("sidebar-view-calendario"));
    fireEvent.click(screen.getByTestId("open-view-help"));

    const dialog = await screen.findByRole("dialog", { name: /ayuda/i });
    expect(dialog).toHaveTextContent(/calendario/i);
  });
});

describe("indicador de guardado (E13)", () => {
  test("está visible desde que se abre el proyecto, no solo al guardar", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    const status = screen.getByTestId("save-status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent(/guardado automático/i);
  });
});

describe("restablecer columnas se puede deshacer (E24)", () => {
  test("Ctrl+Z devuelve las columnas que el usuario tenía", async () => {
    render(
      <GanttView
        tasks={[makeTask({ id: 1 })]}
        taskColumnSettings={{ visible: ["id", "name"], widths: {}, labelLocale: "es" }}
      />,
    );

    // Restablecer borra la configuración: es la acción destructiva a cubrir.
    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("button", { name: /restablecer/i }));

    expect(
      await screen.findByText(/columnas del cronograma restablecidas/i),
    ).toBeInTheDocument();

    // Y deshacerlo devuelve exactamente lo que había.
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    expect(
      await screen.findByText(/deshecho: columnas del cronograma restablecidas/i),
    ).toBeInTheDocument();
  });
});

describe("las observaciones no se pierden (M24)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("anotar guarda al instante, sin esperar al temporizador", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Obra con observaciones"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    fireEvent.click(screen.getAllByTestId("editable-cell")[0]);
    fireEvent.click(screen.getByTestId("open-observations"));

    fireEvent.change(screen.getByTestId("observation-text"), {
      target: { value: "Falta acero de refuerzo en el eje 3" },
    });

    mockedSaveProject.mockClear();
    fireEvent.click(screen.getByTestId("observation-save"));

    // Sin avanzar ni un milisegundo: el guardado tiene que haber salido ya.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSaveProject).toHaveBeenCalled();
    expect(latestSavedProject().observations).toEqual([
      expect.objectContaining({
        taskId: 1,
        text: "Falta acero de refuerzo en el eje 3",
        status: "pending",
      }),
    ]);
  });

  test("atender una observación también guarda al instante", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Obra con observaciones"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
        observations={[
          {
            id: "obs-1",
            taskId: 1,
            taskName: "Excavación",
            text: "Falta acero",
            status: "pending",
            createdAt: "2026-08-07T08:00:00.000Z",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getAllByTestId("editable-cell")[0]);
    fireEvent.click(screen.getByTestId("open-observations"));

    mockedSaveProject.mockClear();
    fireEvent.click(screen.getByTestId("observation-toggle-obs-1"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSaveProject).toHaveBeenCalled();
    expect(latestSavedProject().observations[0].status).toBe("done");
  });

  test("abrir el proyecto con observaciones ya guardadas no dispara un guardado", async () => {
    jest.useFakeTimers();

    mockedSaveProject.mockClear();
    render(
      <GanttView
        projectId="1"
        projectName="Obra con observaciones"
        tasks={[makeTask({ id: 1 })]}
        observations={[
          {
            id: "obs-1",
            taskId: 1,
            taskName: "Excavación",
            text: "Falta acero",
            status: "pending",
            createdAt: "2026-08-07T08:00:00.000Z",
          },
        ]}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSaveProject).not.toHaveBeenCalled();
  });
});

describe("aviso al cerrar con cambios pendientes (M33)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("sin tocar nada, cerrar no pregunta", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  test("tras editar y antes de que guarde, cerrar pregunta", async () => {
    jest.useFakeTimers();
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    const cells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(cells[0]);
    const input = screen.getByDisplayValue("Excavación");
    fireEvent.change(input, { target: { value: "Excavación manual" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => {
      await Promise.resolve();
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe("reintentar el guardado es un botón", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("aparece solo cuando falla y vuelve a guardar al pulsarlo", async () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    expect(screen.queryByTestId("save-retry")).not.toBeInTheDocument();

    mockedSaveProject.mockResolvedValueOnce({
      success: false,
      error: "sin conexión",
    });

    // La app ofrece «Guardar ahora» desde la paleta de comandos.
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.click(screen.getByText("Guardar ahora"));

    const retry = await screen.findByTestId("save-retry");
    expect(retry.tagName).toBe("BUTTON");
    expect(retry).toHaveTextContent("Reintentar");

    mockedSaveProject.mockClear();
    mockedSaveProject.mockResolvedValueOnce({ success: true, id: "1" });
    fireEvent.click(retry);

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId("save-retry")).not.toBeInTheDocument(),
    );
  });
});

describe("la línea base se dibuja donde se guarda (M13)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("al guardar y seleccionar una línea base, el Gantt principal la dibuja", async () => {
    const { container } = render(
      <GanttView
        projectId="1"
        projectName="Obra"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    expect(container.querySelector("g.baseline-bars")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.click(screen.getByTestId("baseline-save-confirm"));

    await waitFor(() =>
      expect(container.querySelector("g.baseline-bars")).toBeInTheDocument(),
    );
    expect(container.querySelectorAll("g.baseline-bars rect")).toHaveLength(1);
  });

  test("una línea base cargada del proyecto no se dibuja hasta seleccionarla", () => {
    const { container } = render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        baselines={[
          {
            id: "bl-1",
            name: "Línea base 1",
            createdAt: new Date("2026-08-01"),
            tasks: [
              {
                taskId: 1,
                baselineStart: createProjectDate("2026-01-05"),
                baselineFinish: createProjectDate("2026-01-10"),
                baselineDuration: 5,
              },
            ],
          },
        ]}
      />,
    );

    expect(container.querySelector("g.baseline-bars")).not.toBeInTheDocument();
  });
});

describe("borrar una línea base es deshacible (M13)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("Ctrl+Z devuelve la línea base borrada", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        baselines={[
          {
            id: "bl-1",
            name: "Antes de la lluvia",
            createdAt: new Date("2026-08-01"),
            tasks: [
              {
                taskId: 1,
                baselineStart: createProjectDate("2026-01-05"),
                baselineFinish: createProjectDate("2026-01-10"),
                baselineDuration: 5,
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("baseline-menu-open"));
    fireEvent.click(screen.getByTestId("baseline-delete-bl-1"));

    expect(screen.queryByTestId("baseline-menu-open")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    await waitFor(() =>
      expect(screen.getByTestId("baseline-menu-open")).toBeInTheDocument(),
    );
  });
});

describe("un guardado fallido deja el trabajo pendiente (M33)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("si el guardado falla, cerrar sigue preguntando", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    mockedSaveProject.mockResolvedValueOnce({
      success: false,
      error: "sin conexión",
    });

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.click(screen.getByText("Guardar ahora"));

    await screen.findByTestId("save-retry");

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  test("y sigue preguntando cuando el indicador ya volvió a su estado normal", async () => {
    jest.useFakeTimers();
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    mockedSaveProject.mockResolvedValueOnce({
      success: false,
      error: "sin conexión",
    });

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.click(screen.getByText("Guardar ahora"));

    // El indicador vuelve a «idle» a los 3 s: el trabajo sigue sin guardarse.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4000);
    });

    expect(screen.queryByTestId("save-retry")).not.toBeInTheDocument();

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe("se ve qué se movió y cuánto (E31)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("tras editar, la app dice cuántas actividades se movieron", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[
          makeTask({ id: 1, name: "Excavación", duration: 2 }),
          makeTask({
            id: 2,
            name: "Cimentación",
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
      />,
    );

    const celda = screen.getByTestId("cell-duration-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByTestId("impact-summary")).toHaveTextContent(
      /actividades se movieron/i,
    );
  });

  test("al abrir el proyecto no hay recuento que mostrar", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    expect(screen.queryByTestId("impact-summary")).not.toBeInTheDocument();
  });

  test("si el fin de obra se corre, se avisa sin que nadie lo pida", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[
          makeTask({ id: 1, name: "Excavación", duration: 2 }),
          makeTask({
            id: 2,
            name: "Cimentación",
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
      />,
    );

    const celda = screen.getByTestId("cell-duration-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByTestId("deep-change-finish")).toHaveTextContent(
      /el fin de obra se corrió/i,
    );
  });
});

describe("el modo Simple esconde lo avanzado de verdad (E36)", () => {
  const columnaMpp = {
    key: "mpp:Cost1",
    fieldId: "COST_1",
    sourceKey: "Cost1",
    labelEn: "Cost 1",
    labelEs: "Costo unitario",
    dataType: "number" as const,
    group: "custom" as const,
    isCustom: true,
    isCore: false,
    isEditable: true,
  };

  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("en modo Simple no se ven las columnas importadas del .mpp", () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        mppTaskColumns={[columnaMpp]}
        taskColumnSettings={{
          visible: ["id", "name", "mpp:Cost1"],
          widths: {},
          labelLocale: "es",
        }}
        uiSettings={{
          locale: "es",
          interactionMode: "simple",
          taskFilter: { text: "", type: "all" },
        }}
      />,
    );

    expect(screen.queryByText("Costo unitario")).not.toBeInTheDocument();
  });

  test("y al pasar a Avanzado vuelven, sin perder nada", () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        mppTaskColumns={[columnaMpp]}
        taskColumnSettings={{
          visible: ["id", "name", "mpp:Cost1"],
          widths: {},
          labelLocale: "es",
        }}
        uiSettings={{
          locale: "es",
          interactionMode: "simple",
          taskFilter: { text: "", type: "all" },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("interaction-mode-advanced"));

    expect(screen.getByText("Costo unitario")).toBeInTheDocument();
  });

  test("un proyecto que ya tiene historial arranca en Avanzado, no en Simple", () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        planningAuditEvents={[
          {
            id: "ev-1",
            kind: "taskEdit",
            summary: "Duración de Excavación",
            taskIds: [1],
            createdAt: "2026-08-01T10:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("interaction-mode-advanced")).toHaveAttribute(
      "data-active",
      "true",
    );
  });
});

describe("la paleta de comandos se deja encontrar (E20, M36)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("el botón enseña el atajo, para que se aprenda solo", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    expect(screen.getByTestId("command-palette-open")).toHaveTextContent("⌘K");
  });

  test("una errata al teclear sigue encontrando el comando", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "cruva" },
    });

    // Acotado a la paleta: «Curva S» también es una entrada del menú lateral.
    expect(
      within(screen.getByTestId("command-palette")).getByText(/curva s/i),
    ).toBeInTheDocument();
  });

  test("lo que no existe sigue sin aparecer: tolerar no es adivinar", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "zzzzzz" },
    });

    expect(screen.getByText(/no hay comandos coincidentes/i)).toBeInTheDocument();
  });

  test("la paleta conoce la exportación y la configuración", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const paleta = within(screen.getByTestId("command-palette"));
    expect(paleta.getByText("Configuración")).toBeInTheDocument();
    expect(paleta.getByText(/exportar el cronograma/i)).toBeInTheDocument();
  });

  test("la Matriz sigue en la paleta además de estar en el menú", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(
      within(screen.getByTestId("command-palette")).getByText(/matriz/i),
    ).toBeInTheDocument();
  });
});

describe("el modo Simple no borra lo que esconde (E36)", () => {
  const columnaMpp = {
    key: "mpp:Cost1",
    fieldId: "COST_1",
    sourceKey: "Cost1",
    labelEn: "Cost 1",
    labelEs: "Costo unitario",
    dataType: "number" as const,
    group: "custom" as const,
    isCustom: true,
    isCore: false,
    isEditable: true,
  };

  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("guardar en modo Simple conserva las columnas del .mpp", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Importado"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
        mppTaskColumns={[columnaMpp]}
        uiSettings={{
          locale: "es",
          interactionMode: "simple",
          taskFilter: { text: "", type: "all" },
        }}
      />,
    );

    mockedSaveProject.mockClear();

    // Cualquier edición dispara el autoguardado.
    const celda = screen.getByTestId("cell-duration-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await flushAutosave();
    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());

    // Esconderlas de la tabla no puede borrarlas del proyecto.
    expect(latestSavedProject().mppTaskColumns).toEqual([
      expect.objectContaining({ key: "mpp:Cost1" }),
    ]);
  });
});

describe("el aviso al cerrar no se queda encendido de más (M28)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("salir de la matriz con un borrador pregunta antes de destruirlo", async () => {
    // Este test afirmaba lo contrario: que perder el borrador al cambiar de
    // vista era aceptable «porque ya no hay nada pendiente». La revisión en
    // frío del 2026-08-08 lo señaló como lo que era —un test defendiendo una
    // pérdida de datos— y M28 dice «avisa antes de salir», no «antes de cerrar».
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(false);

    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("sidebar-view-matrix"));
    await screen.findByRole("button", { name: /Crear matriz/i });
    fireEvent.click(screen.getByRole("button", { name: /Crear matriz/i }));

    fireEvent.click(screen.getByTestId("sidebar-view-gantt"));

    expect(confirmar).toHaveBeenCalledWith(
      expect.stringMatching(/sin aplicar/i),
    );
    // Y al decir que no, el borrador sigue vivo.
    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();

    confirmar.mockRestore();
  });
});

describe("deshacer un alta de asignación no borra de más (M14)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("con dos asignaciones iguales, Ctrl+Z quita solo la última", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
        resources={[
          { uid: 7, name: "Cuadrilla 2", type: "work", rate: 20, availability: 100 },
        ]}
        assignments={[{ taskId: 1, resourceId: 7, units: 20, cost: 0 }]}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-view-resources"));
    fireEvent.click(await screen.findByRole("button", { name: /Asignaciones/i }));

    // Se crea una segunda del mismo par: nada lo impide hoy.
    fireEvent.click(await screen.findByTestId("assignment-add"));
    fireEvent.change(screen.getByTestId("assignment-task"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByTestId("assignment-resource"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByTestId("assignment-confirm"));

    // Dos asignaciones del mismo par, más la fila de encabezado.
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
    // eslint-disable-next-line no-console
    console.log("FILAS TRAS CREAR", screen.getAllByRole("row").length);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    await new Promise((r) => setTimeout(r, 100));
    // eslint-disable-next-line no-console
    console.log("FILAS TRAS DESHACER", screen.getAllByRole("row").length);
    // Deshacer quita una, no las dos.
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
  });
});

describe("la matriz y el calendario del proyecto (M26)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  async function abrirMatriz() {
    fireEvent.click(screen.getByTestId("command-palette-open"));
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "matriz" },
    });
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("matrix-editor");
  }

  test("el calendario del proyecto llega al editor y avisa antes de aplicar", async () => {
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);

    render(
      <GanttView
        projectId="1"
        projectName="Calendario"
        tasks={generated.tasks}
        matrixPlan={matrixPlan}
        calendar={{
          timeZone: "America/Bogota",
          workDays: [1],
          startHour: "08:00",
          endHour: "17:00",
          hoursPerDay: 8,
          nonWorkingDays: [],
          dateOverrides: [],
        }}
      />,
    );

    await abrirMatriz();
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(screen.getByTestId("matrix-calendar-warning")).toBeInTheDocument();
  });

  test("con el calendario por defecto no se supera el umbral y se aplica directo", async () => {
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);

    render(
      <GanttView
        projectId="1"
        projectName="Calendario por defecto"
        tasks={generated.tasks}
        matrixPlan={matrixPlan}
      />,
    );

    await abrirMatriz();
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    expect(screen.queryByTestId("matrix-calendar-warning")).not.toBeInTheDocument();
  });
});

describe("los conflictos de la matriz los decide el usuario (M26)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  async function renderConConflicto() {
    const matrixPlan = createSingleCellMatrixPlan();
    const renombrada = {
      ...makeLinkedMatrixTask(),
      name: "Formaleta como se llama en obra",
    };

    render(
      <GanttView
        projectId="1"
        projectName="Conflictos"
        tasks={[renombrada]}
        matrixPlan={matrixPlan}
      />,
    );

    fireEvent.click(screen.getByTestId("command-palette-open"));
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "matriz" },
    });
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("matrix-editor");
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    return { renombrada };
  }

  test("con conflictos no se aplica a ciegas: se pregunta", async () => {
    await renderConConflicto();

    expect(await screen.findByTestId("conflict-chooser")).toBeInTheDocument();
  });

  test("elegir «Gantt» conserva el nombre puesto en obra", async () => {
    jest.useFakeTimers();
    const { renombrada } = await renderConConflicto();

    fireEvent.click(
      await screen.findByLabelText(
        `Conservar lo del Gantt en el nombre de ${renombrada.id}`,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    expect(screen.queryByTestId("conflict-chooser")).not.toBeInTheDocument();

    await flushAutosave();
    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(
      latestSavedProject().tasks.find((task) => task.id === renombrada.id)?.name,
    ).toBe("Formaleta como se llama en obra");
  }, 20_000);

  test("«No aplicar» deja el cronograma como estaba", async () => {
    const { renombrada } = await renderConConflicto();

    fireEvent.click(await screen.findByRole("button", { name: "No aplicar" }));

    expect(screen.queryByTestId("conflict-chooser")).not.toBeInTheDocument();

    // Lo que importa no es que el diálogo se cierre, sino que la tarea siga
    // llamándose como la puso la obra.
    fireEvent.click(screen.getByTestId("sidebar-view-gantt"));
    const fila = document.querySelector(`[data-task-id="${renombrada.id}"]`);
    if (!fila) throw new Error("Se esperaba la fila de la tarea renombrada");
    expect(within(fila as HTMLElement).getByText(renombrada.name)).toBeInTheDocument();
  });
});

describe("borrar una ubicación de la matriz se puede deshacer (M26)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function abrirUbicaciones(matrixPlan: MatrixPlan, tasks: GanttTask[]) {
    jest.useFakeTimers();
    render(
      <GanttView
        projectId="1"
        projectName="Ubicaciones"
        tasks={tasks}
        matrixPlan={matrixPlan}
      />,
    );

    fireEvent.click(screen.getByTestId("command-palette-open"));
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "matriz" },
    });
    fireEvent.keyDown(window, { key: "Enter" });
    await flushAutosave();
    screen.getByTestId("matrix-editor");
    fireEvent.click(screen.getByRole("button", { name: "Ubicaciones" }));
    mockedSaveProject.mockClear();
  }

  function tareasGuardadasDePiso1(): number {
    return latestSavedProject().tasks.filter(
      (task) => task.matrixSource?.areaId === "piso-1",
    ).length;
  }

  test("borrar también las tareas las quita del cronograma y Ctrl+Z las devuelve", async () => {
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);
    const generadas = generated.tasks.filter((task) => task.matrixSource);
    expect(generadas.length).toBeGreaterThan(0);

    await abrirUbicaciones(matrixPlan, generated.tasks);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Piso 1" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Borrar también sus tareas" }),
    );

    await flushAutosave();
    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
    expect(tareasGuardadasDePiso1()).toBe(0);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    await flushAutosave();
    await waitFor(() => expect(tareasGuardadasDePiso1()).toBe(generadas.length));
  }, 20_000);

  test("conservarlas deja las tareas en el cronograma, sueltas de la matriz", async () => {
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);
    const generadas = generated.tasks.filter((task) => task.matrixSource);

    await abrirUbicaciones(matrixPlan, generated.tasks);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Piso 1" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Conservarlas en el cronograma" }),
    );

    await flushAutosave();
    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());

    // Siguen en el cronograma, pero ya no cuelgan de la matriz.
    const guardadas = latestSavedProject().tasks;
    expect(guardadas.filter((task) => generadas.some((t) => t.id === task.id))).toHaveLength(
      generadas.length,
    );
    expect(tareasGuardadasDePiso1()).toBe(0);
  }, 20_000);
});

describe("el diálogo de conflictos no se queda viejo (M26)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  /** Dos actividades: así una tarea puede tener conflicto y la otra no. */
  function planDeDosTareas(): MatrixPlan {
    const plan = createSingleCellMatrixPlan();
    return {
      ...plan,
      recipes: [
        {
          ...plan.recipes[0],
          activities: [
            ...plan.recipes[0].activities,
            {
              id: "acero",
              name: "Acero",
              productivityPerDay: 50,
              defaultQuantity: 100,
              unit: "kg",
            },
          ],
        },
      ],
    };
  }

  function renombrar(task: GanttTask, nombre: string): GanttTask {
    return { ...task, name: nombre };
  }

  async function abrirMatriz() {
    fireEvent.click(screen.getByTestId("sidebar-view-matrix"));
    await screen.findByTestId("matrix-editor");
  }

  test("si los conflictos cambiaron mientras decidía, no se aplica y se vuelve a preguntar", async () => {
    const matrixPlan = planDeDosTareas();
    const generadas = generateScheduleFromMatrix(matrixPlan).tasks.filter(
      (task) => !task.isSummary,
    );
    expect(generadas).toHaveLength(2);
    const [uno, dos] = generadas;

    render(
      <GanttView
        projectId="1"
        projectName="Conflictos vivos"
        tasks={generateScheduleFromMatrix(matrixPlan).tasks.map((task) =>
          task.isSummary
            ? task
            : renombrar(task, `${task.name} (obra)`),
        )}
        matrixPlan={matrixPlan}
      />,
    );

    // La segunda vuelve a llamarse como la matriz: su conflicto desaparece.
    const filaDos = document.querySelector(`[data-task-id="${dos.id}"]`);
    if (!filaDos) throw new Error("Se esperaba la fila de la segunda tarea");
    const celdas = within(filaDos as HTMLElement).getAllByTestId("editable-cell");
    fireEvent.doubleClick(celdas[0]);
    const input = activeEditableInput();
    fireEvent.change(input, { target: { value: dos.name } });
    fireEvent.keyDown(input, { key: "Enter" });

    await abrirMatriz();
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    // Solo la primera tiene conflicto.
    expect(
      await screen.findByTestId(`conflict-${uno.id}-name`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`conflict-${dos.id}-name`),
    ).not.toBeInTheDocument();

    // El cronograma cambia por debajo: Ctrl+Z devuelve el nombre de obra.
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    // No se aplica: se vuelve a preguntar con el conflicto que había aparecido.
    expect(await screen.findByTestId("conflicts-changed")).toBeInTheDocument();
    expect(screen.getByTestId("conflict-chooser")).toBeInTheDocument();
    expect(screen.getByTestId(`conflict-${dos.id}-name`)).toBeInTheDocument();
  }, 20_000);

  test("salir de la matriz cierra el diálogo, no lo deja esperando", async () => {
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);

    render(
      <GanttView
        projectId="1"
        projectName="Cambio de vista"
        tasks={generated.tasks.map((task) =>
          task.isSummary ? task : { ...task, name: `${task.name} (obra)` },
        )}
        matrixPlan={matrixPlan}
      />,
    );

    await abrirMatriz();
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));
    expect(await screen.findByTestId("conflict-chooser")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-view-gantt"));
    await abrirMatriz();

    expect(screen.queryByTestId("conflict-chooser")).not.toBeInTheDocument();
  }, 20_000);
});

describe("salir de la Matriz con un borrador sin aplicar (M28)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function abrirMatriz() {
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);
    render(
      <GanttView
        projectId="1"
        projectName="Con matriz"
        tasks={generated.tasks}
        matrixPlan={matrixPlan}
      />,
    );
    fireEvent.click(screen.getByTestId("command-palette-open"));
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "matriz" },
    });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();
  }

  /** Desactivar una celda basta: el borrador deja de coincidir con lo aplicado. */
  function ensuciarElBorrador() {
    // La celda de la matriz de prueba: alcance «Estructura» × ubicación «Piso 1».
    fireEvent.click(screen.getByTestId("matrix-cell-select-cell-estructura-piso-1"));
    const casilla = within(screen.getByTestId("matrix-cell-panel")).getByRole(
      "checkbox",
    );
    fireEvent.click(casilla);
    expect(screen.getByTestId("matrix-dirty")).toBeInTheDocument();
  }

  test("sin cambios, cambiar de vista no pregunta nada", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    abrirMatriz();

    fireEvent.click(screen.getByTestId("sidebar-view-gantt"));

    expect(confirmar).not.toHaveBeenCalled();
    expect(screen.queryByTestId("matrix-editor")).not.toBeInTheDocument();
  });

  test("con un borrador sin aplicar, salir pregunta antes", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    abrirMatriz();

    ensuciarElBorrador();
    fireEvent.click(screen.getByTestId("sidebar-view-gantt"));

    expect(confirmar).toHaveBeenCalledWith(
      expect.stringMatching(/sin aplicar/i),
    );
  });

  test("si el usuario dice que no, se queda en la Matriz y conserva el borrador", () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    abrirMatriz();

    ensuciarElBorrador();
    fireEvent.click(screen.getByTestId("sidebar-view-gantt"));

    // El editor sigue montado: el borrador no se ha destruido.
    expect(screen.getByTestId("matrix-editor")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-dirty")).toBeInTheDocument();
  });
});

describe("GanttView · el menú refleja el proyecto real (R0)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("la Matriz del menú cuenta las ubicaciones del plan cargado", () => {
    const matrixPlan = createSingleCellMatrixPlan();
    const generated = generateScheduleFromMatrix(matrixPlan);

    render(
      <GanttView
        projectId="1"
        tasks={generated.tasks}
        matrixPlan={matrixPlan}
      />,
    );

    // El fixture tiene una sola ubicación: exigir el número es lo que prueba
    // que el conteo llega de verdad. Con `/ubicaciones/` a secas, este test
    // pasaría igual con el cableado roto, porque el texto de «todavía no hay
    // matriz» también la menciona.
    expect(screen.getByTestId("sidebar-blurb-matrix")).toHaveTextContent(
      "1 ubicación programada",
    );
  });

  test("sin matriz, la entrada explica para qué sirve en vez de contar cero", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    expect(screen.getByTestId("sidebar-blurb-matrix")).toHaveTextContent(
      /Sin matriz todavía/,
    );
  });

  test("Recursos cuenta los que trae el proyecto", () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        resources={[
          { uid: 1, name: "Oficial", type: "work" },
          { uid: 2, name: "Ayudante", type: "work" },
        ]}
      />,
    );

    expect(screen.getByTestId("sidebar-blurb-resources")).toHaveTextContent(
      "2 recursos asignados",
    );
  });
});

describe("GanttView · corregir ubicaciones desde la Línea de Balance (R4)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  const tareasDeObra = () => [
    makeTask({ id: 1, name: "Mampostería Piso 1" }),
    makeTask({ id: 2, name: "Mampostería Piso 2" }),
    makeTask({ id: 3, name: "Mampostería" }),
  ];

  test("la Línea de Balance ofrece el panel de correcciones", () => {
    render(<GanttView projectId="1" tasks={tareasDeObra()} />);

    fireEvent.click(screen.getByTestId("sidebar-view-lob"));

    expect(screen.getByTestId("location-correction-panel")).toBeInTheDocument();
  });

  test("corregir una ubicación se guarda con el proyecto", async () => {
    render(<GanttView projectId="1" tasks={tareasDeObra()} />);

    fireEvent.click(screen.getByTestId("sidebar-view-lob"));
    mockedSaveProject.mockClear();

    fireEvent.change(
      screen.getByLabelText("Nivel corregido de Mampostería"),
      { target: { value: "3" } },
    );
    fireEvent.change(
      screen.getByLabelText("Motivo de la corrección de Mampostería"),
      { target: { value: "Va en el piso 3" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Corregir Mampostería" }));

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());

    const guardado = latestSavedProject();
    expect(guardado.detectionDictionary?.corrections).toEqual([
      expect.objectContaining({
        kind: "ubicacion",
        value: "3",
        note: "Va en el piso 3",
      }),
    ]);
  });

  test("la corrección cambia lo que el panel muestra, no solo lo que se guarda", async () => {
    render(<GanttView projectId="1" tasks={tareasDeObra()} />);

    fireEvent.click(screen.getByTestId("sidebar-view-lob"));

    expect(screen.getByTestId("correction-detected-3")).toHaveTextContent(
      "Obra general",
    );

    fireEvent.change(
      screen.getByLabelText("Nivel corregido de Mampostería"),
      { target: { value: "3" } },
    );
    fireEvent.change(
      screen.getByLabelText("Motivo de la corrección de Mampostería"),
      { target: { value: "Va en el piso 3" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Corregir Mampostería" }));

    await waitFor(() =>
      expect(screen.getByTestId("correction-detected-3")).toHaveTextContent(
        "Piso 3",
      ),
    );
    expect(screen.getByTestId("correction-source-3")).toHaveTextContent(
      "Corregida a mano",
    );
  });

  test("un proyecto que ya traía correcciones las respeta al abrir", () => {
    render(
      <GanttView
        projectId="1"
        tasks={tareasDeObra()}
        detectionDictionary={rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
          kind: "ubicacion",
          name: "Mampostería",
          value: "5",
          note: "Corregido en obra",
          recordedAt: "2026-08-08T10:00:00.000Z",
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-view-lob"));

    expect(screen.getByTestId("correction-detected-3")).toHaveTextContent(
      "Piso 5",
    );
  });
});

describe("Recursos sin recursos: la vista enseña en vez de mostrar cinco pestañas vacías (F7)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("sin recursos muestra el estado vacío y esconde las cinco sub-pestañas", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
        resources={[]}
        assignments={[]}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-view-resources"));

    expect(await screen.findByTestId("resources-empty-state")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uso de Recursos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Asignaciones" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("resource-sheet-view")).not.toBeInTheDocument();
  });

  test("crear el primer recurso desde el estado vacío abre la hoja con sus pestañas", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
        resources={[]}
        assignments={[]}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-view-resources"));
    fireEvent.click(await screen.findByTestId("resources-empty-create"));

    expect(screen.queryByTestId("resources-empty-state")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Uso de Recursos" })).toBeInTheDocument();
  });

  test("con recursos importados del .mpp no hay estado vacío", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
        resources={[
          { uid: 145, name: "Ayudante armado", type: "work", rate: 0, availability: 100 },
        ]}
        assignments={[]}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-view-resources"));

    expect(await screen.findByRole("button", { name: "Uso de Recursos" })).toBeInTheDocument();
    expect(screen.queryByTestId("resources-empty-state")).not.toBeInTheDocument();
  });
});

describe("Recursos: la segunda salida existe porque el presupuesto no los necesita (R9)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("«Abrir el presupuesto» lleva al presupuesto, no a la hoja de recursos", async () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} resources={[]} />);

    fireEvent.click(screen.getByTestId("sidebar-view-resources"));
    // La vista se carga con `next/dynamic`: hay que esperar a que monte.
    fireEvent.click(await screen.findByTestId("resources-empty-budget"));

    // Presupuesto y Mapeo funcionan con cero cuadrillas: esconder las cinco
    // pestañas en bloque taparía dos pantallas que sí sirven.
    expect(screen.queryByTestId("resources-empty-state")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Presupuesto/i }),
    ).toBeInTheDocument();
  });

  test("una vez elegida la salida, el estado vacío no vuelve a interponerse", async () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} resources={[]} />);

    fireEvent.click(screen.getByTestId("sidebar-view-resources"));
    fireEvent.click(await screen.findByTestId("resources-empty-create"));
    fireEvent.click(screen.getByTestId("sidebar-view-gantt"));
    fireEvent.click(screen.getByTestId("sidebar-view-resources"));

    expect(screen.queryByTestId("resources-empty-state")).not.toBeInTheDocument();
  });
});

describe("Recursos: el recurso fantasma de MS Project no llega a la pantalla (R9)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("un recurso sin nombre no cuenta como recurso ni pinta fila", async () => {
    // Los tres .mpp reales del repositorio traen el recurso nulo de MS Project
    // (UID 0, nombre vacío) — DA PORTO tiene 213 asignaciones colgando de él.
    // Contarlo daría «1 recurso» y una fila en blanco sin explicación.
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        resources={[{ uid: 0, name: "", type: "work" }]}
      />,
    );

    fireEvent.click(screen.getByTestId("sidebar-view-resources"));

    expect(await screen.findByTestId("resources-empty-state")).toBeInTheDocument();
  });

  test("el menú tampoco lo cuenta", () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        resources={[{ uid: 0, name: "", type: "work" }]}
      />,
    );

    expect(screen.getByTestId("sidebar-blurb-resources")).toHaveTextContent(
      /Sin recursos todavía/,
    );
  });
});

/**
 * El modo mirador de E51.
 *
 * Es la **cortesía**, no la cerradura: la garantía de que un temporal no se
 * modifica es que quien llega por `/ver/<token>` no tiene sesión, y toda
 * escritura exige sesión con permiso —y un temporal, además, no tiene dueño—.
 * Aquí solo se esconde lo que no aplica, para no prometer lo que no se puede
 * hacer. Si a alguien se le escapara un control, el servidor lo rechaza igual.
 */
describe("GanttView en solo lectura (E51)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (saveProject as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("no ofrece agregar ni eliminar tareas", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} readOnly />);

    expect(screen.getByTestId("toolbar-add")).toBeDisabled();
    expect(screen.getByTestId("toolbar-delete")).toBeDisabled();
  });

  test("aunque algo marque el proyecto como sucio, no guarda", async () => {
    // La primera versión de este test solo montaba el componente y comprobaba
    // que no guardaba. Pasaba SIN la guarda puesta —sin cambios no hay guardado
    // de todos modos—, así que no protegía nada: lo cazó la mutación.
    //
    // Cambiar la escala toca `uiSettings`, que sí marca el proyecto como sucio
    // y dispara el autoguardado. Con `readOnly` no debe salir nada.
    render(<GanttView tasks={[makeTask({ id: 1 })]} readOnly />);

    fireEvent.change(screen.getByTestId("role-view-preset-select"), {
      target: { value: "tracking" },
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(saveProject as jest.Mock).not.toHaveBeenCalled();
  });

  test("y sin readOnly ese mismo cambio SÍ guarda: el test de arriba no pasa en vacío", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} projectId="p1" />);

    fireEvent.change(screen.getByTestId("role-view-preset-select"), {
      target: { value: "tracking" },
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(saveProject as jest.Mock).toHaveBeenCalled();
  });

  test("sin readOnly todo sigue como estaba", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    expect(screen.getByTestId("toolbar-add")).toBeEnabled();
  });

  test("lo de mirar sigue estando: las vistas de análisis no se esconden", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} readOnly />);

    expect(screen.getByTestId("sidebar-view-lob")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-view-executive")).toBeInTheDocument();
  });
});

/**
 * El comando ⌘K «Exportar el cronograma — descarga en CSV» era un no-op:
 * cambiaba de vista y no descargaba nada. Un comando que no hace lo que anuncia
 * es peor que no tenerlo.
 */
describe("el comando de exportar descarga de verdad", () => {
  test("al ejecutarlo, se dispara la descarga", () => {
    const descargas: string[] = [];
    jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        descargas.push(this.download);
      });
    global.URL.createObjectURL = jest.fn(() => "blob:x");
    global.URL.revokeObjectURL = jest.fn();

    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("command-palette-open"));
    fireEvent.change(screen.getByTestId("command-palette-input"), {
      target: { value: "Exportar" },
    });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(descargas.length).toBeGreaterThan(0);
    expect(descargas[0]).toMatch(/\.csv$/);

    jest.restoreAllMocks();
  });
});

/**
 * Lo que ve quien está en obra cuando el guardado falla.
 *
 * `saveProject` puede devolver el error crudo de la base, y esto se pinta tal
 * cual en pantalla: un fallo de conexión enseñaba `ECONNREFUSED 127.0.0.1:5432`
 * a un jefe de obra.
 */
describe("un fallo de guardado se cuenta en cristiano", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (saveProject as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("el error crudo de la base no llega a pantalla", async () => {
    (saveProject as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: "connect ECONNREFUSED 127.0.0.1:5432",
    });

    render(<GanttView tasks={[makeTask({ id: 1 })]} projectId="p1" />);

    fireEvent.change(screen.getByTestId("role-view-preset-select"), {
      target: { value: "tracking" },
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(document.body.textContent).not.toContain("ECONNREFUSED");
    expect(document.body.textContent).not.toContain("127.0.0.1");
  });

  test("el aviso de conflicto entre pestañas sobrevive intacto", async () => {
    const conflicto =
      "Otra pestaña guardó este proyecto mientras lo editabas. Recarga para no perder lo suyo ni lo tuyo.";
    (saveProject as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: conflicto,
    });

    render(<GanttView tasks={[makeTask({ id: 1 })]} projectId="p1" />);

    fireEvent.change(screen.getByTestId("role-view-preset-select"), {
      target: { value: "tracking" },
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Otra pestaña guardó");
  });
});
