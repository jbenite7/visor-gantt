/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, within, createEvent, waitFor } from "@testing-library/react";
import GanttTable from "./GanttTable";
import type { GanttTask } from "@/components/gantt/types";
import type { MppCustomFieldDefinition, MppTaskColumn, TaskColumnSettings } from "@/types/mppColumns";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05"),
    finish: new Date("2026-01-10"),
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

function fireDragEvent(
  element: HTMLElement,
  type: "dragStart" | "dragOver" | "drop",
  dataTransfer: Record<string, unknown>,
  clientY = 0,
) {
  const event = createEvent[type](element);
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  Object.defineProperty(event, "clientY", { value: clientY });
  fireEvent(element, event);
}

const summaryTask: GanttTask = makeTask({
  id: "summary-1",
  name: "Phase 1",
  isSummary: true,
  outlineLevel: 1,
});

const milestoneTask: GanttTask = makeTask({
  id: "ms-1",
  name: "Kickoff",
  isMilestone: true,
  duration: 0,
  outlineLevel: 1,
});

const regularTask: GanttTask = makeTask({
  id: "t1",
  name: "Design",
  outlineLevel: 1,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GanttTable", () => {
  // --- Rendering -----------------------------------------------------------

  test("renders all task rows", () => {
    render(<GanttTable tasks={[summaryTask, milestoneTask, regularTask]} />);

    const rows = screen.getAllByTestId("gantt-row");
    expect(rows).toHaveLength(3);
  });

  test("filters visible rows from the Gantt toolbar", () => {
    const onTaskFilterChange = jest.fn();

    const { rerender } = render(
      <GanttTable
        tasks={[summaryTask, milestoneTask, regularTask]}
        taskFilter={{ text: "", type: "all" }}
        onTaskFilterChange={onTaskFilterChange}
      />,
    );

    fireEvent.change(screen.getByTestId("gantt-task-filter-input"), {
      target: { value: "design" },
    });

    expect(onTaskFilterChange).toHaveBeenCalledWith({ text: "design", type: "all" });

    rerender(
      <GanttTable
        tasks={[summaryTask, milestoneTask, regularTask]}
        taskFilter={{ text: "design", type: "all" }}
        onTaskFilterChange={onTaskFilterChange}
      />,
    );

    expect(screen.getAllByTestId("gantt-row")).toHaveLength(1);
    expect(screen.getByTestId("gantt-task-filter-count")).toHaveTextContent("1 / 3");

    fireEvent.click(screen.getByTestId("gantt-task-filter-clear"));
    expect(onTaskFilterChange).toHaveBeenCalledWith({ text: "", type: "all" });
  });

  test("applies WBS indentation for outline level 2", () => {
    const level1Task = makeTask({ id: "l1", name: "Level 1", outlineLevel: 1 });
    const level2Task = makeTask({ id: "l2", name: "Level 2", outlineLevel: 2 });

    render(<GanttTable tasks={[level1Task, level2Task]} />);

    const expandIcons = screen.getAllByTestId("wbs-expand");

    // Level 1: marginLeft = (1-1) * 20 = 0
    // Level 2: marginLeft = (2-1) * 20 = 20
    expect(expandIcons[0]).toHaveStyle("margin-left: 0px");
    expect(expandIcons[1]).toHaveStyle("margin-left: 20px");
  });

  test("applies bold font weight for summary rows", () => {
    const child = makeTask({ id: "c1", name: "Child", outlineLevel: 2 });

    render(<GanttTable tasks={[summaryTask, child]} />);

    // Summary rows have fontWeight: 600 in the name cell
    const rows = screen.getAllByTestId("gantt-row");

    // The first row (summary) should contain the summary name
    expect(rows[0]).toHaveTextContent("Phase 1");

    // The name cell with bold font weight is the td containing the task name
    // Check that the summary row's name has the bold style
    const nameCells = rows[0].querySelectorAll("td");
    // Name is at index 3 (after ID, Unique ID and EDT)
    const nameCell = nameCells[3];
    expect(nameCell).toHaveStyle("font-weight: 600");
  });

  test("renders the default columns in the requested order", () => {
    const task = makeTask({
      id: 107,
      name: "Design",
      mppFields: {
        ID: 7,
        UID: 107,
        UNIQUE_ID: 107,
        SUMMARY: false,
      },
    });

    render(<GanttTable tasks={[task]} />);

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual([
      "ID",
      "Id. único",
      "EDT",
      "Actividad",
      "Resumen",
      "Duración",
      "Comienzo",
      "Fin",
      "Predecesora",
      "% completado",
      "Crítica",
    ]);

    const row = screen.getAllByTestId("gantt-row")[0];
    const cells = row.querySelectorAll("td");
    expect(cells[0]).toHaveTextContent("7");
    expect(cells[1]).toHaveTextContent("107");
    expect(cells[3]).toHaveTextContent("Design");
  });

  test("renders predecessors with row IDs when internal IDs are Unique IDs", () => {
    const predecessor = makeTask({
      id: 101,
      name: "Predecessor",
      mppFields: { ID: 1, UID: 101 },
    });
    const successor = makeTask({
      id: 205,
      name: "Successor",
      dependencies: [{ from: 101, to: 205, type: "FS" }],
      mppFields: { ID: 2, UID: 205 },
    });

    render(<GanttTable tasks={[predecessor, successor]} />);

    const successorCells = screen.getAllByTestId("gantt-row")[1].querySelectorAll("td");
    expect(successorCells[0]).toHaveTextContent("2");
    expect(successorCells[1]).toHaveTextContent("205");
    expect(successorCells[8]).toHaveTextContent("1FS");
  });

  test("commits inline predecessor edits by resolving row ID to internal task ID", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({
      id: 101,
      name: "Predecessor",
      mppFields: { ID: 1, UID: 101 },
    });
    const successor = makeTask({
      id: 205,
      name: "Successor",
      dependencies: [],
      mppFields: { ID: 2, UID: 205 },
    });

    render(<GanttTable tasks={[predecessor, successor]} onUpdateTask={onUpdateTask} />);

    const predecessorCell = screen.getAllByTestId("gantt-row")[1].querySelectorAll("td")[8];
    fireEvent.doubleClick(within(predecessorCell).getByTestId("editable-cell"));
    const input = within(predecessorCell).getByTestId("editable-cell");
    fireEvent.change(input, { target: { value: "1SS-2d" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTask).toHaveBeenCalledWith(205, "dependencies", [
      { from: 101, to: 205, type: "SS", lag: -2 },
    ]);
  });

  test("renders percent complete with two decimals", () => {
    render(
      <GanttTable
        tasks={[
          makeTask({
            id: 1,
            name: "Con decimales",
            progress: 33.3333,
          }),
        ]}
      />,
    );

    expect(screen.getByText("33.33%")).toBeInTheDocument();
  });

  test("renders editable percent complete with at most two decimals", () => {
    render(
      <GanttTable
        tasks={[
          makeTask({
            id: 1,
            name: "Con decimales",
            progress: 46.666666666666664,
          }),
        ]}
        onUpdateTask={jest.fn()}
      />,
    );

    expect(screen.getByText("46.67")).toBeInTheDocument();
    expect(screen.queryByText("46.666666666666664")).not.toBeInTheDocument();
  });

  test("renders imported MPP columns in Spanish by default and switches labels to English", () => {
    const columns: MppTaskColumn[] = [
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
    ];
    const settings: TaskColumnSettings = {
      visible: ["id", "name", "mpp:Text1"],
      widths: {},
      labelLocale: "es",
    };
    const task = makeTask({
      id: "mpp-1",
      name: "Imported task",
      mppFields: { Text1: "Contrato" },
    });

    render(
      <GanttTable
        tasks={[task]}
        mppTaskColumns={columns}
        columnSettings={settings}
      />,
    );

    expect(screen.getByText("Texto 1")).toBeInTheDocument();
    expect(screen.getByText("Contrato")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(screen.getAllByText("Text 1").length).toBeGreaterThan(0);
  });

  test("keeps imported MPP columns read-only in the task table", () => {
    const task = makeTask({
      id: "mpp-2",
      name: "Imported task",
      mppFields: { Text1: "Campo importado" },
    });

    render(
      <GanttTable
        tasks={[task]}
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
        columnSettings={{
          visible: ["id", "name", "mpp:Text1"],
          widths: {},
          labelLocale: "es",
        }}
        onUpdateTask={jest.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Campo importado"));

    expect(screen.queryByDisplayValue("Campo importado")).not.toBeInTheDocument();
  });

  test("shows field inspector metadata for calculated MPP columns", () => {
    const task = makeTask({
      id: "mpp-3",
      name: "Imported task",
      mppFields: {
        NUMBER_1: 12,
        NUMBER_2: 24,
        NUMBER_2_LOOKUP_ERROR: "Valor 24 no existe en la lista de valores permitidos.",
      },
    });
    const customFieldDefinitions: MppCustomFieldDefinition[] = [
      {
        fieldId: "NUMBER_2",
        recordType: "task",
        dataType: "number",
        lookupValues: [12, 18],
      },
    ];

    render(
      <GanttTable
        tasks={[task]}
        customFieldDefinitions={customFieldDefinitions}
        mppTaskColumns={[
          {
            key: "mpp:NUMBER_2",
            fieldId: "NUMBER_2",
            sourceKey: "NUMBER_2",
            labelEn: "Number 2",
            labelEs: "Número 2",
            dataType: "number",
            group: "custom",
            isCustom: true,
            isCore: false,
            isEditable: false,
            calculationSpec: {
              calculationKind: "customFormula",
              formula: "[Number1] * 2",
              dependencies: ["NUMBER_1"],
              isCalculated: true,
              isEditableWhenCalculated: false,
              lastCalculatedAt: "2026-01-05T12:00:00.000Z",
              sourceOfTruth: "customFormula",
            },
          },
        ]}
        columnSettings={{
          visible: ["id", "name", "mpp:NUMBER_2"],
          widths: {},
          labelLocale: "es",
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("button", { name: "Inspeccionar columna Número 2" }));

    const inspector = within(screen.getByTestId("field-inspector"));
    expect(inspector.getByText("Inspector de campo")).toBeInTheDocument();
    expect(inspector.getByText("Número 2")).toBeInTheDocument();
    expect(inspector.getByText("Valor")).toBeInTheDocument();
    expect(inspector.getByText("24")).toBeInTheDocument();
    expect(inspector.getByText("Formula")).toBeInTheDocument();
    expect(inspector.getByText("[Number1] * 2")).toBeInTheDocument();
    expect(inspector.getByText("Solo lectura")).toBeInTheDocument();
    expect(inspector.getAllByText("customFormula").length).toBeGreaterThan(0);
    expect(inspector.getByText("Valores lookup")).toBeInTheDocument();
    expect(inspector.getByText("12, 18")).toBeInTheDocument();
    expect(inspector.getByText("Errores")).toBeInTheDocument();
    expect(inspector.getByText("Valor 24 no existe en la lista de valores permitidos.")).toBeInTheDocument();
  });

  test("calls onTaskSelect when a row is clicked", () => {
    const onTaskSelect = jest.fn();

    render(
      <GanttTable
        tasks={[regularTask]}
        onTaskSelect={onTaskSelect}
      />,
    );

    const rows = screen.getAllByTestId("gantt-row");
    fireEvent.click(rows[0]);

    expect(onTaskSelect).toHaveBeenCalledTimes(1);
    expect(onTaskSelect).toHaveBeenCalledWith(regularTask.id, false);
  });

  test("commits inline name edits with the latest input value", () => {
    const onUpdateTask = jest.fn();

    render(
      <GanttTable
        tasks={[regularTask]}
        onUpdateTask={onUpdateTask}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Design"));
    const input = screen.getByDisplayValue("Design");
    fireEvent.change(input, { target: { value: "Edited design" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTask).toHaveBeenCalledWith("t1", "name", "Edited design");
  });

  test("calls hierarchy action handlers from the table toolbar", () => {
    const onIndentTask = jest.fn();
    const onOutdentTask = jest.fn();
    const onMoveTaskUp = jest.fn();
    const onMoveTaskDown = jest.fn();
    const onInsertTask = jest.fn();

    render(
      <GanttTable
        tasks={[regularTask]}
        selectedTaskIds={[regularTask.id]}
        onIndentTask={onIndentTask}
        onOutdentTask={onOutdentTask}
        onMoveTaskUp={onMoveTaskUp}
        onMoveTaskDown={onMoveTaskDown}
        onInsertTask={onInsertTask}
      />,
    );

    fireEvent.click(screen.getByTestId("hierarchy-move-up"));
    fireEvent.click(screen.getByTestId("hierarchy-move-down"));
    fireEvent.click(screen.getByTestId("hierarchy-outdent"));
    fireEvent.click(screen.getByTestId("hierarchy-indent"));
    fireEvent.click(screen.getByTestId("hierarchy-add-chapter"));
    fireEvent.click(screen.getByTestId("hierarchy-add-subchapter"));
    fireEvent.click(screen.getByTestId("hierarchy-add-task"));

    expect(onMoveTaskUp).toHaveBeenCalledWith(regularTask.id);
    expect(onMoveTaskDown).toHaveBeenCalledWith(regularTask.id);
    expect(onOutdentTask).toHaveBeenCalledWith(regularTask.id);
    expect(onIndentTask).toHaveBeenCalledWith(regularTask.id);
    expect(onInsertTask).toHaveBeenCalledWith({
      kind: "summary",
      afterTaskId: regularTask.id,
      parentTaskId: undefined,
      name: "Nuevo capitulo",
    });
    expect(onInsertTask).toHaveBeenCalledWith({
      kind: "summary",
      parentTaskId: regularTask.id,
      afterTaskId: undefined,
      name: "Nuevo capitulo",
    });
    expect(onInsertTask).toHaveBeenCalledWith({
      kind: "task",
      afterTaskId: regularTask.id,
      parentTaskId: undefined,
      name: "Nueva tarea",
    });
  });

  test("calls smart paste handler with tabular clipboard text", () => {
    const onSmartPasteTasks = jest.fn();

    render(
      <GanttTable
        tasks={[regularTask]}
        selectedTaskIds={[regularTask.id]}
        onSmartPasteTasks={onSmartPasteTasks}
      />,
    );

    fireEvent.click(screen.getByTestId("smart-paste-open"));
    fireEvent.change(screen.getByTestId("smart-paste-textarea"), {
      target: {
        value: "Actividad\tInicio\tDuración\nFormaleta\t2026-02-01\t3",
      },
    });
    fireEvent.click(screen.getByTestId("smart-paste-apply"));

    expect(onSmartPasteTasks).toHaveBeenCalledWith(
      "Actividad\tInicio\tDuración\nFormaleta\t2026-02-01\t3",
      { afterTaskId: regularTask.id },
    );
  });

  test("applies percent complete to multiple selected tasks after confirmation", () => {
    const onUpdateTask = jest.fn();
    const firstTask = makeTask({ id: 1, name: "Excavacion" });
    const secondTask = makeTask({ id: 2, name: "Cimentacion" });

    render(
      <GanttTable
        tasks={[firstTask, secondTask]}
        selectedTaskIds={[1, 2]}
        onUpdateTask={onUpdateTask}
      />,
    );

    fireEvent.click(screen.getByTestId("bulk-progress-open"));
    expect(screen.getByTestId("bulk-progress-panel")).toHaveTextContent(
      "Aplicar % completado a 2 tareas seleccionadas",
    );

    fireEvent.change(screen.getByTestId("bulk-progress-input"), {
      target: { value: "66.666" },
    });
    fireEvent.click(screen.getByTestId("bulk-progress-apply"));

    expect(onUpdateTask).toHaveBeenCalledWith(1, "progress", 66.666);
    expect(onUpdateTask).toHaveBeenCalledWith(2, "progress", 66.666);
    expect(screen.queryByTestId("bulk-progress-panel")).not.toBeInTheDocument();
  });

  test("copies the filtered visible schedule as Excel TSV", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <GanttTable
        tasks={[
          makeTask({ id: 1, name: "Design", progress: 33.3333, wbs: "1" }),
          makeTask({ id: 2, name: "Build", progress: 10, wbs: "2" }),
        ]}
        taskFilter={{ text: "Design", type: "all" }}
      />,
    );

    fireEvent.click(screen.getByTestId("excel-copy-export"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const exported = writeText.mock.calls[0][0] as string;
    expect(exported).toContain("Actividad\tInicio\tFin\tDuración\t% completado");
    expect(exported).toContain("Design\t2026-01-05\t2026-01-10\t5\t33.33");
    expect(exported).not.toContain("Build");
    await waitFor(() =>
      expect(screen.getByTestId("excel-export-status")).toHaveTextContent("Copiado"),
    );
  });

  test("calls row reorder handler when a row is dragged onto another row", () => {
    const onReorderTask = jest.fn();
    const first = makeTask({ id: "t1", name: "Design" });
    const second = makeTask({ id: "t2", name: "Build" });

    render(
      <GanttTable
        tasks={[first, second]}
        onReorderTask={onReorderTask}
      />,
    );

    const rows = screen.getAllByTestId("gantt-row");
    rows[1].getBoundingClientRect = () => ({
      top: -40,
      bottom: 0,
      left: 0,
      right: 240,
      width: 240,
      height: 40,
      x: 0,
      y: -40,
      toJSON: () => undefined,
    });
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: jest.fn(),
      getData: jest.fn(),
    };

    fireDragEvent(rows[0], "dragStart", dataTransfer);
    fireDragEvent(rows[1], "dragOver", dataTransfer, 32);
    fireDragEvent(rows[1], "drop", dataTransfer, 32);

    expect(onReorderTask).toHaveBeenCalledWith("t1", "t2", "after");
  });

  test("supports dropping a row as a child of the target row", () => {
    const onReorderTask = jest.fn();
    const first = makeTask({ id: "t1", name: "Design" });
    const second = makeTask({ id: "t2", name: "Build" });

    render(
      <GanttTable
        tasks={[first, second]}
        onReorderTask={onReorderTask}
      />,
    );

    const rows = screen.getAllByTestId("gantt-row");
    rows[1].getBoundingClientRect = () => ({
      top: -30,
      bottom: 30,
      left: 0,
      right: 240,
      width: 240,
      height: 60,
      x: 0,
      y: -30,
      toJSON: () => undefined,
    });
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: jest.fn(),
      getData: jest.fn(),
    };

    fireDragEvent(rows[0], "dragStart", dataTransfer);
    fireDragEvent(rows[1], "dragOver", dataTransfer, 0);
    fireDragEvent(rows[1], "drop", dataTransfer, 0);

    expect(onReorderTask).toHaveBeenCalledWith("t1", "t2", "child");
  });

  test("commits predecessors from the visual dependency popover", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({ id: 1, name: "Predecessor", wbs: "1" });
    const successor = makeTask({ id: 2, name: "Successor", wbs: "2" });

    render(
      <GanttTable
        tasks={[predecessor, successor]}
        onUpdateTask={onUpdateTask}
      />,
    );

    fireEvent.click(screen.getByTestId("dependency-popover-open-2"));
    fireEvent.change(screen.getByTestId("dependency-search"), {
      target: { value: "Predecessor" },
    });
    fireEvent.change(screen.getByTestId("dependency-type-select"), {
      target: { value: "SS" },
    });
    fireEvent.change(screen.getByTestId("dependency-lag-input"), {
      target: { value: "-2" },
    });
    fireEvent.click(screen.getByTestId("dependency-add"));
    fireEvent.click(screen.getByTestId("dependency-apply"));

    expect(onUpdateTask).toHaveBeenCalledWith(2, "dependencies", [
      { from: 1, to: 2, type: "SS", lag: -2 },
    ]);
  });

  test("shows row IDs in the visual dependency popover", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({
      id: 101,
      name: "Predecessor",
      wbs: "1",
      mppFields: { ID: 1, UID: 101 },
    });
    const successor = makeTask({
      id: 205,
      name: "Successor",
      wbs: "2",
      dependencies: [{ from: 101, to: 205, type: "FF", lag: 3 }],
      mppFields: { ID: 2, UID: 205 },
    });

    render(
      <GanttTable
        tasks={[predecessor, successor]}
        onUpdateTask={onUpdateTask}
      />,
    );

    fireEvent.click(screen.getByTestId("dependency-popover-open-205"));

    const popover = screen.getByTestId("dependency-popover");
    expect(within(popover).getByText("1FF+3d")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1 1 - Predecessor" })).toBeInTheDocument();
  });

  test("commits successors from the dependency side panel", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({
      id: 1,
      name: "Predecessor",
      wbs: "1",
      start: new Date("2026-01-05T08:00:00"),
      finish: new Date("2026-01-05T08:00:00"),
      duration: 1,
    });
    const successor = makeTask({
      id: 2,
      name: "Successor",
      wbs: "2",
      start: new Date("2026-01-05T08:00:00"),
      finish: new Date("2026-01-05T08:00:00"),
      duration: 1,
    });

    render(
      <GanttTable
        tasks={[predecessor, successor]}
        selectedTaskIds={[1]}
        onUpdateTask={onUpdateTask}
      />,
    );

    fireEvent.click(screen.getByTestId("dependency-panel-open"));
    fireEvent.click(screen.getByTestId("dependency-panel-add-successor"));

    const impact = screen.getByTestId("dependency-panel-impact");
    expect(impact).toHaveTextContent("Tareas afectadas: 1");
    expect(impact).toHaveTextContent("Fin del proyecto: +1d");

    fireEvent.click(screen.getByTestId("dependency-panel-apply"));

    expect(onUpdateTask).toHaveBeenCalledWith(1, "successors", [
      { from: 1, to: 2, type: "FS", lag: undefined },
    ]);
  });

  test("shows row IDs and commits internal IDs from the dependency side panel", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({
      id: 101,
      name: "Predecessor",
      wbs: "1",
      start: new Date("2026-01-05T08:00:00"),
      finish: new Date("2026-01-05T08:00:00"),
      duration: 1,
      mppFields: { ID: 1, UID: 101 },
    });
    const successor = makeTask({
      id: 205,
      name: "Successor",
      wbs: "2",
      start: new Date("2026-01-05T08:00:00"),
      finish: new Date("2026-01-05T08:00:00"),
      duration: 1,
      mppFields: { ID: 2, UID: 205 },
    });

    render(
      <GanttTable
        tasks={[predecessor, successor]}
        selectedTaskIds={[101]}
        onUpdateTask={onUpdateTask}
      />,
    );

    fireEvent.click(screen.getByTestId("dependency-panel-open"));

    expect(screen.getByText("1 1 - Predecessor")).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "2 2 - Successor" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("dependency-panel-add-successor"));
    fireEvent.click(screen.getByTestId("dependency-panel-apply"));

    expect(onUpdateTask).toHaveBeenCalledWith(101, "successors", [
      { from: 101, to: 205, type: "FS", lag: undefined },
    ]);
  });

  test("blocks circular dependencies from the dependency side panel", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({
      id: 1,
      name: "Predecessor",
      wbs: "1",
      dependencies: [{ from: 2, to: 1, type: "FS" }],
    });
    const successor = makeTask({ id: 2, name: "Successor", wbs: "2" });

    render(
      <GanttTable
        tasks={[predecessor, successor]}
        selectedTaskIds={[1]}
        onUpdateTask={onUpdateTask}
      />,
    );

    fireEvent.click(screen.getByTestId("dependency-panel-open"));
    fireEvent.click(screen.getByTestId("dependency-panel-add-successor"));
    fireEvent.click(screen.getByTestId("dependency-panel-apply"));

    expect(screen.getByTestId("dependency-panel-validation")).toHaveTextContent("ciclo");
    expect(onUpdateTask).not.toHaveBeenCalled();
  });
});
