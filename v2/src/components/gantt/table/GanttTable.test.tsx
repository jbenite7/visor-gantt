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
  clientX = 0,
) {
  const event = createEvent[type](element);
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  Object.defineProperty(event, "clientY", { value: clientY });
  Object.defineProperty(event, "clientX", { value: clientX });
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
    // El contador dice cuántas esconde, que es el dato que preocupa (E7).
    expect(screen.getByTestId("gantt-task-filter-count")).toHaveTextContent("2 ocultas de 3");

    fireEvent.click(screen.getByTestId("gantt-task-filter-clear"));
    expect(onTaskFilterChange).toHaveBeenCalledWith({ text: "", type: "all" });
  });

  test("applies WBS indentation for outline level 2", () => {
    const level1Task = makeTask({ id: "l1", name: "Level 1", outlineLevel: 1 });
    const level2Task = makeTask({ id: "l2", name: "Level 2", outlineLevel: 2 });

    render(<GanttTable tasks={[level1Task, level2Task]} />);

    const expandIcons = screen.getAllByTestId("wbs-expand");

    expect(expandIcons[0]).toHaveAttribute("data-level", "1");
    expect(expandIcons[1]).toHaveAttribute("data-level", "2");
    expect(expandIcons[0]).toHaveClass("gantt-wbs-expand");
    expect(expandIcons[1]).toHaveClass("gantt-wbs-expand");
  });

  test("applies bold font weight for summary rows", () => {
    const child = makeTask({ id: "c1", name: "Child", outlineLevel: 2 });

    render(<GanttTable tasks={[summaryTask, child]} />);

    const rows = screen.getAllByTestId("gantt-row");

    // The first row (summary) should contain the summary name
    expect(rows[0]).toHaveTextContent("Phase 1");
    expect(rows[0]).toHaveAttribute("data-summary", "true");

    const nameCells = rows[0].querySelectorAll("td");
    // Name is at index 3 (after ID, Unique ID and EDT)
    const nameCell = nameCells[3];
    expect(nameCell).toHaveClass("gantt-row-cell--name");
    expect(nameCell).toHaveAttribute("data-summary", "true");
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
      "Predecesoras",
      "% completado",
      "Crítica",
    ]);

    const row = screen.getAllByTestId("gantt-row")[0];
    const cells = row.querySelectorAll("td");
    expect(cells[0]).toHaveTextContent("7");
    expect(cells[1]).toHaveTextContent("107");
    expect(cells[3]).toHaveTextContent("Design");
  });

  test("uses a readable medium-width column set before the table becomes cramped", async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return {
        width: 700,
        height: 500,
        top: 0,
        right: 700,
        bottom: 500,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    };

    try {
      render(<GanttTable tasks={[regularTask]} />);

      await waitFor(() => {
        const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
        expect(headers).toContain("Comienzo");
        expect(headers).toContain("Fin");
        expect(headers).toContain("Pred.");
        expect(headers).not.toContain("Resumen");
        expect(headers).not.toContain("Crítica");
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test("marks activity dates and predecessors for compact readable wrapping", () => {
    const predecessor = makeTask({ id: 1, name: "Predecessor" });
    const successor = makeTask({
      id: 2,
      name: "Actividad con nombre deliberadamente largo para probar wrap",
      dependencies: [{ from: 1, to: 2, type: "FS" }],
    });

    render(
      <GanttTable
        tasks={[predecessor, successor]}
        onUpdateTask={jest.fn()}
      />,
    );

    const successorCells = screen.getAllByTestId("gantt-row")[1].querySelectorAll("td");
    expect(successorCells[3]).toHaveClass("gantt-row-cell--name");
    expect(successorCells[6]).toHaveClass("gantt-row-cell--date");
    expect(successorCells[7]).toHaveClass("gantt-row-cell--date");
    expect(successorCells[8]).toHaveClass("gantt-row-cell--predecessors");
    expect(successorCells[8]).toHaveTextContent("1FS");

    // El control de edición aparece al señalar la fila (E40).
    fireEvent.mouseEnter(screen.getAllByTestId("gantt-row")[1]);
    expect(within(successorCells[8]).getByRole("button", { name: "Editar predecesoras" })).toBeInTheDocument();
    expect(successorCells[8]).toHaveTextContent("Editar");
    expect(successorCells[6]).not.toHaveTextContent("2026-01-05");
  });

  test("shows an explicit empty predecessor state instead of a blank icon-only cell", () => {
    render(<GanttTable tasks={[regularTask]} onUpdateTask={jest.fn()} />);

    const cells = screen.getAllByTestId("gantt-row")[0].querySelectorAll("td");
    expect(cells[8]).toHaveTextContent("Sin pred.");

    // El control de edición aparece al señalar la fila (E40); el dato, siempre.
    fireEvent.mouseEnter(screen.getAllByTestId("gantt-row")[0]);
    expect(
      within(cells[8]).getByRole("button", { name: "Editar predecesoras" }),
    ).toBeInTheDocument();
    expect(cells[8]).toHaveTextContent("Editar");
  });

  test("renders numeric ID fallbacks for matrix tasks with string internal ids", () => {
    const task = makeTask({
      id: "mx-summary-etapa-1",
      name: "Etapa 1",
      mppFields: undefined,
    });

    render(<GanttTable tasks={[task]} />);

    const row = screen.getAllByTestId("gantt-row")[0];
    const cells = row.querySelectorAll("td");
    expect(cells[0]).toHaveTextContent("1");
    expect(cells[0]).not.toHaveTextContent("mx-summary-etapa-1");
    expect(cells[1]).toHaveTextContent("1");
    expect(cells[1]).not.toHaveTextContent("mx-summary-etapa-1");
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

  test("renders matrix predecessors with visible row fallback instead of internal string ids", () => {
    const predecessor = makeTask({
      id: "mx-task-cell-scope-1783549803757-estructura-area-formaleta",
      name: "Formaleta",
    });
    const successor = makeTask({
      id: "mx-task-cell-scope-1783549803757-estructura-area-acero",
      name: "Acero",
      dependencies: [{ from: predecessor.id, to: "mx-task-cell-scope-1783549803757-estructura-area-acero", type: "FS" }],
    });

    render(<GanttTable tasks={[predecessor, successor]} />);

    const successorCells = screen.getAllByTestId("gantt-row")[1].querySelectorAll("td");
    expect(successorCells[8]).toHaveTextContent("1FS");
    expect(successorCells[8]).not.toHaveTextContent("mx-task-cell-scope");
  });

  test("commits matrix predecessor edits by resolving visible row IDs to internal task IDs", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({
      id: "mx-task-cell-scope-1783549803757-estructura-area-formaleta",
      name: "Formaleta",
    });
    const successor = makeTask({
      id: "mx-task-cell-scope-1783549803757-estructura-area-acero",
      name: "Acero",
      dependencies: [],
    });

    render(<GanttTable tasks={[predecessor, successor]} onUpdateTask={onUpdateTask} />);

    const predecessorCell = screen.getAllByTestId("gantt-row")[1].querySelectorAll("td")[8];
    fireEvent.doubleClick(within(predecessorCell).getByTestId("editable-cell"));
    const input = within(predecessorCell).getByTestId("editable-cell");
    fireEvent.change(input, { target: { value: "1FS" } });
    fireEvent.blur(input);

    expect(onUpdateTask).toHaveBeenCalledWith(successor.id, "dependencies", [
      { from: predecessor.id, to: successor.id, type: "FS", lag: undefined },
    ]);
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

  test("commits inline percent lag edits without falling back to internal IDs", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({
      id: "mx-task-cell-scope-1783549803757-estructura-area-formaleta",
      name: "Formaleta",
    });
    const successor = makeTask({
      id: "mx-task-cell-scope-1783549803757-estructura-area-acero",
      name: "Acero",
      dependencies: [],
    });

    render(<GanttTable tasks={[predecessor, successor]} onUpdateTask={onUpdateTask} />);

    const predecessorCell = screen.getAllByTestId("gantt-row")[1].querySelectorAll("td")[8];
    fireEvent.doubleClick(within(predecessorCell).getByTestId("editable-cell"));
    const input = within(predecessorCell).getByTestId("editable-cell");
    fireEvent.change(input, { target: { value: "1SS+50%" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTask).toHaveBeenCalledWith(successor.id, "dependencies", [
      { from: predecessor.id, to: successor.id, type: "SS", lag: 50, lagUnit: "percent" },
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
      name: "Nuevo capítulo",
    });
    expect(onInsertTask).toHaveBeenCalledWith({
      kind: "summary",
      parentTaskId: regularTask.id,
      afterTaskId: undefined,
      name: "Nuevo capítulo",
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

  test("uses horizontal row drag to indent under the immediately previous activity", () => {
    const onIndentTask = jest.fn();
    const onReorderTask = jest.fn();
    const first = makeTask({ id: "t1", name: "Design" });
    const second = makeTask({ id: "t2", name: "Build" });

    render(
      <GanttTable
        tasks={[first, second]}
        onIndentTask={onIndentTask}
        onReorderTask={onReorderTask}
      />,
    );

    const rows = screen.getAllByTestId("gantt-row");
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: jest.fn(),
      getData: jest.fn(),
    };

    fireDragEvent(rows[1], "dragStart", dataTransfer, 0, 120);
    fireDragEvent(rows[1], "drop", dataTransfer, 0, 172);

    expect(onIndentTask).toHaveBeenCalledWith("t2");
    expect(onReorderTask).not.toHaveBeenCalled();
  });

  test("uses horizontal row drag to outdent a nested activity", () => {
    const onOutdentTask = jest.fn();
    const onReorderTask = jest.fn();
    const parent = makeTask({ id: "parent", name: "Parent", isSummary: true, outlineLevel: 1 });
    const child = makeTask({ id: "child", name: "Child", outlineLevel: 2 });

    render(
      <GanttTable
        tasks={[parent, child]}
        onOutdentTask={onOutdentTask}
        onReorderTask={onReorderTask}
      />,
    );

    const rows = screen.getAllByTestId("gantt-row");
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: jest.fn(),
      getData: jest.fn(),
    };

    fireDragEvent(rows[1], "dragStart", dataTransfer, 0, 160);
    fireDragEvent(rows[1], "drop", dataTransfer, 0, 108);

    expect(onOutdentTask).toHaveBeenCalledWith("child");
    expect(onReorderTask).not.toHaveBeenCalled();
  });

  // El gesto real del usuario viaja por drag-and-drop HTML5: el atributo
  // draggable de la fila hace que el navegador emita dragstart y sustituya el
  // mouseup por dragend, asi que la indentacion se aplica en handleRowDrop.
  test("uses horizontal drag distance to indent under the previous group", () => {
    const onIndentTask = jest.fn();
    const first = makeTask({ id: "t1", name: "Design" });
    const second = makeTask({ id: "t2", name: "Build" });

    render(
      <GanttTable
        tasks={[first, second]}
        onIndentTask={onIndentTask}
      />,
    );

    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: jest.fn(), getData: jest.fn() };
    const rows = screen.getAllByTestId("gantt-row");
    fireDragEvent(rows[1], "dragStart", dataTransfer, 0, 120);
    fireDragEvent(rows[1], "drop", dataTransfer, 0, 176);

    expect(onIndentTask).toHaveBeenCalledWith("t2");
  });

  test("uses horizontal drag distance to outdent a nested activity", () => {
    const onOutdentTask = jest.fn();
    const parent = makeTask({ id: "parent", name: "Parent", isSummary: true, outlineLevel: 1 });
    const child = makeTask({ id: "child", name: "Child", outlineLevel: 2 });

    render(
      <GanttTable
        tasks={[parent, child]}
        onOutdentTask={onOutdentTask}
      />,
    );

    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: jest.fn(), getData: jest.fn() };
    const rows = screen.getAllByTestId("gantt-row");
    fireDragEvent(rows[1], "dragStart", dataTransfer, 0, 176);
    fireDragEvent(rows[1], "drop", dataTransfer, 0, 120);

    expect(onOutdentTask).toHaveBeenCalledWith("child");
  });

  test("ignores a horizontal drag shorter than the threshold", () => {
    const onIndentTask = jest.fn();
    const onOutdentTask = jest.fn();
    const first = makeTask({ id: "t1", name: "Design" });
    const second = makeTask({ id: "t2", name: "Build" });

    render(
      <GanttTable
        tasks={[first, second]}
        onIndentTask={onIndentTask}
        onOutdentTask={onOutdentTask}
      />,
    );

    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: jest.fn(), getData: jest.fn() };
    const rows = screen.getAllByTestId("gantt-row");
    fireDragEvent(rows[1], "dragStart", dataTransfer, 0, 120);
    fireDragEvent(rows[1], "drop", dataTransfer, 0, 140);

    expect(onIndentTask).not.toHaveBeenCalled();
    expect(onOutdentTask).not.toHaveBeenCalled();
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

    // El control aparece al señalar la fila (E40).

    fireEvent.mouseEnter(

      screen.getByTestId("cell-predecessors-2").closest("tr")!,

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

  test("commits percent lag from the visual dependency popover", () => {
    const onUpdateTask = jest.fn();
    const predecessor = makeTask({ id: 1, name: "Predecessor", wbs: "1" });
    const successor = makeTask({ id: 2, name: "Successor", wbs: "2" });

    render(
      <GanttTable
        tasks={[predecessor, successor]}
        onUpdateTask={onUpdateTask}
      />,
    );

    // El control aparece al señalar la fila (E40).

    fireEvent.mouseEnter(

      screen.getByTestId("cell-predecessors-2").closest("tr")!,

    );

    fireEvent.click(screen.getByTestId("dependency-popover-open-2"));
    fireEvent.change(screen.getByTestId("dependency-search"), {
      target: { value: "Predecessor" },
    });
    fireEvent.change(screen.getByTestId("dependency-type-select"), {
      target: { value: "SS" },
    });
    fireEvent.change(screen.getByTestId("dependency-lag-input"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByTestId("dependency-lag-unit-select"), {
      target: { value: "percent" },
    });
    fireEvent.click(screen.getByTestId("dependency-add"));
    fireEvent.click(screen.getByTestId("dependency-apply"));

    expect(onUpdateTask).toHaveBeenCalledWith(2, "dependencies", [
      { from: 1, to: 2, type: "SS", lag: 50, lagUnit: "percent" },
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

    // El control aparece al señalar la fila (E40).

    fireEvent.mouseEnter(

      screen.getByTestId("cell-predecessors-205").closest("tr")!,

    );

    fireEvent.click(screen.getByTestId("dependency-popover-open-205"));

    const popover = screen.getByTestId("dependency-popover");
    expect(popover).toHaveClass("gantt-dependency-popover");
    expect(popover.closest(".gantt-row-cell--predecessors")).toBeNull();
    expect(within(popover).getByText("1FF+3d")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1 - Predecessor" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "1 1 - Predecessor" })).not.toBeInTheDocument();
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

    expect(screen.getByText("1 - Predecessor")).toBeInTheDocument();
    expect(screen.queryByText("1 1 - Predecessor")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "2 - Successor" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("option", { name: "2 2 - Successor" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("dependency-panel-successor-lag-input"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByTestId("dependency-panel-successor-lag-unit-select"), {
      target: { value: "percent" },
    });
    fireEvent.click(screen.getByTestId("dependency-panel-add-successor"));
    fireEvent.click(screen.getByTestId("dependency-panel-apply"));

    expect(onUpdateTask).toHaveBeenCalledWith(101, "successors", [
      { from: 101, to: 205, type: "FS", lag: 50, lagUnit: "percent" },
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

describe("estado vacío de la tabla (E6)", () => {
  test("un proyecto sin tareas invita a crear la primera, en vez de dejar la cuadrícula en blanco", () => {
    render(<GanttTable tasks={[]} />);

    const empty = screen.getByTestId("gantt-table-empty");
    expect(empty).toHaveTextContent(/todavía no hay tareas/i);
  });

  test("un filtro sin resultados lo dice y ofrece quitarlo", () => {
    render(
      <GanttTable
        tasks={[makeTask({ id: 1, isCritical: false })]}
        taskFilter={{ type: "critical" }}
        onTaskFilterChange={jest.fn()}
      />,
    );

    const empty = screen.getByTestId("gantt-table-empty");
    expect(empty).toHaveTextContent(/ninguna tarea coincide/i);
    expect(
      within(empty).getByRole("button", { name: /quitar el filtro/i }),
    ).toBeInTheDocument();
  });

  test("con tareas visibles no aparece ningún estado vacío", () => {
    render(<GanttTable tasks={[makeTask({ id: 1 })]} />);
    expect(screen.queryByTestId("gantt-table-empty")).not.toBeInTheDocument();
  });
});

describe("restablecer columnas es una acción aparte (E24)", () => {
  test("usa el manejador de restablecer cuando el padre lo ofrece, para poder deshacerlo", () => {
    const onResetColumns = jest.fn();
    const onColumnSettingsChange = jest.fn();

    render(
      <GanttTable
        tasks={[makeTask({ id: 1 })]}
        onColumnSettingsChange={onColumnSettingsChange}
        onResetColumns={onResetColumns}
      />,
    );

    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("button", { name: /restablecer/i }));

    expect(onResetColumns).toHaveBeenCalledTimes(1);
    expect(onColumnSettingsChange).not.toHaveBeenCalled();
  });

  test("sin manejador del padre sigue restableciendo por su cuenta", () => {
    const onColumnSettingsChange = jest.fn();

    render(
      <GanttTable
        tasks={[makeTask({ id: 1 })]}
        onColumnSettingsChange={onColumnSettingsChange}
      />,
    );

    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("button", { name: /restablecer/i }));

    expect(onColumnSettingsChange).toHaveBeenCalledTimes(1);
  });
});

describe("lo calculado no se edita (E27)", () => {
  test("la fecha de fin se edita, pero lo que cambia es la duración", () => {
    // Decidido en el Bloque B: escribir el fin no mueve la tarea, cambia
    // cuánto dura. El fin sigue siendo un dato que calcula el motor.
    const onUpdateTask = jest.fn();
    render(
      <GanttTable tasks={[makeTask({ id: 1 })]} onUpdateTask={onUpdateTask} />,
    );

    const fin = screen.getByTestId("cell-finish-1");
    fireEvent.doubleClick(fin.querySelector('[data-testid="editable-cell"]')!);

    expect(fin.querySelector("input")).not.toBeNull();
  });

  test("una fila resumen no deja editar la duración", () => {
    render(
      <GanttTable
        tasks={[
          makeTask({ id: 1, isSummary: true }),
          makeTask({ id: 2 }),
        ]}
        onUpdateTask={jest.fn()}
      />,
    );

    const duracion = screen.getByTestId("cell-duration-1");
    fireEvent.doubleClick(
      duracion.querySelector('[data-testid="editable-cell"]')!,
    );

    expect(duracion.querySelector("input")).toBeNull();
  });

  test("una tarea normal sí deja editar la duración: no se rompe lo que servía", () => {
    render(<GanttTable tasks={[makeTask({ id: 2 })]} onUpdateTask={jest.fn()} />);

    const duracion = screen.getByTestId("cell-duration-2");
    fireEvent.doubleClick(
      duracion.querySelector('[data-testid="editable-cell"]')!,
    );

    expect(duracion.querySelector("input")).not.toBeNull();
  });

  test("la fila resumen tampoco deja editar el avance ni las predecesoras", () => {
    render(
      <GanttTable
        tasks={[makeTask({ id: 1, isSummary: true })]}
        onUpdateTask={jest.fn()}
      />,
    );

    for (const columna of ["progress", "predecessors", "start"]) {
      const celda = screen.getByTestId(`cell-${columna}-1`);
      expect(
        celda.querySelector('[data-testid="editable-cell"]'),
      ).toHaveAttribute("data-read-only", "true");
    }
  });
});

describe("ningún dato se descarta sin decirlo (E28)", () => {
  const columnaNumerica = {
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

  test("vaciar un campo numérico lo deja vacío, no lo convierte en cero", () => {
    const onUpdateTask = jest.fn();
    const onInvalidEdit = jest.fn();
    render(
      <GanttTable
        tasks={[makeTask({ id: 1, mppFields: { Cost1: 1000 } })]}
        mppTaskColumns={[columnaNumerica]}
        columnSettings={{
          visible: ["id", "name", "mpp:Cost1"],
          widths: {},
          labelLocale: "es",
        }}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={onInvalidEdit}
      />,
    );

    const celda = screen.getByTestId("cell-mpp:Cost1-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    // Un `input[type=number]` ya impide teclear letras: lo que sí llegaba al
    // guardado era el campo vacío, que se convertía en 0 en silencio.
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTask).toHaveBeenCalledWith(1, "mppFields:Cost1", null);
    expect(onUpdateTask).not.toHaveBeenCalledWith(1, "mppFields:Cost1", 0);
  });

  test("un número válido sí se guarda: no se rompe lo que servía", () => {
    const onUpdateTask = jest.fn();
    render(
      <GanttTable
        tasks={[makeTask({ id: 1, mppFields: { Cost1: 1000 } })]}
        mppTaskColumns={[columnaNumerica]}
        columnSettings={{
          visible: ["id", "name", "mpp:Cost1"],
          widths: {},
          labelLocale: "es",
        }}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={jest.fn()}
      />,
    );

    const celda = screen.getByTestId("cell-mpp:Cost1-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "2500" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTask).toHaveBeenCalledWith(1, "mppFields:Cost1", 2500);
  });

  test("una predecesora mal escrita explica el formato en vez de desaparecer", () => {
    const onUpdateTask = jest.fn();
    const onInvalidEdit = jest.fn();
    render(
      <GanttTable
        tasks={[makeTask({ id: 1 }), makeTask({ id: 2 })]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={onInvalidEdit}
      />,
    );

    const celda = screen.getByTestId("cell-predecessors-2");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "la primera" } });
    fireEvent.blur(input);

    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(onInvalidEdit).toHaveBeenCalledWith(
      expect.stringMatching(/1FS|formato/i),
    );
  });

  test("una predecesora bien escrita sigue funcionando", () => {
    const onUpdateTask = jest.fn();
    render(
      <GanttTable
        tasks={[makeTask({ id: 1 }), makeTask({ id: 2 })]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={jest.fn()}
      />,
    );

    const celda = screen.getByTestId("cell-predecessors-2");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "1FS+2" } });
    fireEvent.blur(input);

    expect(onUpdateTask).toHaveBeenCalledWith(
      2,
      "dependencies",
      expect.arrayContaining([
        expect.objectContaining({ from: 1, to: 2, type: "FS", lag: 2 }),
      ]),
    );
  });

  test("borrar todas las predecesoras sigue siendo posible", () => {
    const onUpdateTask = jest.fn();
    render(
      <GanttTable
        tasks={[
          makeTask({ id: 1 }),
          makeTask({
            id: 2,
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={jest.fn()}
      />,
    );

    const celda = screen.getByTestId("cell-predecessors-2");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onUpdateTask).toHaveBeenCalledWith(2, "dependencies", []);
  });
});

describe("las filas afectadas por la última edición se resaltan (E31)", () => {
  test("la fila que se movió queda marcada", () => {
    render(
      <GanttTable
        tasks={[makeTask({ id: 1 }), makeTask({ id: 2 })]}
        changedTaskIds={[2]}
      />,
    );

    const filas = screen.getAllByTestId("gantt-row");
    expect(filas[1]).toHaveAttribute("data-changed", "true");
  });

  test("las que no se movieron no se marcan", () => {
    render(
      <GanttTable
        tasks={[makeTask({ id: 1 }), makeTask({ id: 2 })]}
        changedTaskIds={[2]}
      />,
    );

    expect(screen.getAllByTestId("gantt-row")[0]).toHaveAttribute(
      "data-changed",
      "false",
    );
  });

  test("sin edición reciente, ninguna fila se marca", () => {
    render(<GanttTable tasks={[makeTask({ id: 1 })]} />);

    expect(screen.getAllByTestId("gantt-row")[0]).toHaveAttribute(
      "data-changed",
      "false",
    );
  });
});

describe("editar el fin cambia la duración (Bloque B)", () => {
  test("escribir un fin más lejano sube la duración, no mueve la tarea", () => {
    const onUpdateTask = jest.fn();
    render(
      <GanttTable
        tasks={[
          makeTask({
            id: 1,
            start: new Date("2026-01-05"),
            finish: new Date("2026-01-09"),
            duration: 5,
          }),
        ]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={jest.fn()}
      />,
    );

    const celda = screen.getByTestId("cell-finish-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "2026-01-12" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTask).toHaveBeenCalledWith(1, "duration", 7);
    expect(onUpdateTask).not.toHaveBeenCalledWith(
      1,
      "finish",
      expect.anything(),
    );
  });

  test("un fin en domingo se rechaza explicando, sin tocar la tarea", () => {
    const onUpdateTask = jest.fn();
    const onInvalidEdit = jest.fn();
    render(
      <GanttTable
        tasks={[
          makeTask({
            id: 1,
            start: new Date("2026-01-05"),
            finish: new Date("2026-01-09"),
            duration: 5,
          }),
        ]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={onInvalidEdit}
      />,
    );

    const celda = screen.getByTestId("cell-finish-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);
    const input = celda.querySelector("input")!;
    fireEvent.change(input, { target: { value: "2026-01-11" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(onInvalidEdit).toHaveBeenCalledWith(
      expect.stringMatching(/no se trabaja/i),
    );
  });

  test("el fin de una fila resumen sigue sin editarse: lo calculan sus hijas", () => {
    render(
      <GanttTable
        tasks={[makeTask({ id: 1, isSummary: true })]}
        onUpdateTask={jest.fn()}
      />,
    );

    const celda = screen.getByTestId("cell-finish-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);

    expect(celda.querySelector("input")).toBeNull();
  });
});

describe("el filtro no esconde nada a escondidas (E7)", () => {
  test("el chip dice cuántas tareas quedaron fuera", () => {
    render(
      <GanttTable
        tasks={[
          makeTask({ id: 1, isCritical: true }),
          makeTask({ id: 2 }),
          makeTask({ id: 3 }),
        ]}
        taskFilter={{ type: "critical", text: "" }}
        onTaskFilterChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId("gantt-task-filter-count")).toHaveTextContent(
      "2 ocultas",
    );
  });

  test("sin filtro, el contador no habla de ocultas", () => {
    render(
      <GanttTable
        tasks={[makeTask({ id: 1 }), makeTask({ id: 2 })]}
        taskFilter={{ type: "all", text: "" }}
        onTaskFilterChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId("gantt-task-filter-count")).not.toHaveTextContent(
      /ocultas/,
    );
  });

  test("sin filtro no hay chip que quitar", () => {
    render(
      <GanttTable
        tasks={[makeTask({ id: 1 })]}
        taskFilter={{ type: "all", text: "" }}
        onTaskFilterChange={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("gantt-task-filter-clear")).not.toBeInTheDocument();
  });

  test("una tarea oculta de la que depende una visible se muestra atenuada", () => {
    render(
      <GanttTable
        tasks={[
          makeTask({ id: 1 }),
          makeTask({
            id: 2,
            isCritical: true,
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
        taskFilter={{ type: "critical", text: "" }}
        onTaskFilterChange={jest.fn()}
      />,
    );

    const fila = screen.getByTestId("cell-id-1").closest("tr");
    expect(fila).toHaveAttribute("data-filtered-context", "true");
  });

  test("una tarea oculta de la que no depende nadie no se cuela", () => {
    render(
      <GanttTable
        tasks={[
          makeTask({ id: 1 }),
          makeTask({ id: 2, isCritical: true }),
          makeTask({ id: 3 }),
        ]}
        taskFilter={{ type: "critical", text: "" }}
        onTaskFilterChange={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("cell-id-3")).not.toBeInTheDocument();
  });
});

describe("los niveles WBS hacen lo que dicen (E19)", () => {
  const jerarquia = [
    makeTask({ id: 1, name: "Capítulo", isSummary: true, outlineLevel: 1 }),
    makeTask({ id: 2, name: "Subcapítulo", isSummary: true, outlineLevel: 2 }),
    makeTask({ id: 3, name: "Detalle de obra", outlineLevel: 3 }),
  ];

  test("el botón L1 deja a la vista solo el primer nivel", () => {
    render(<GanttTable tasks={jerarquia} />);

    fireEvent.click(screen.getByRole("button", { name: "L1" }));

    expect(screen.getByText("Capítulo")).toBeInTheDocument();
    expect(screen.queryByText("Subcapítulo")).not.toBeInTheDocument();
    expect(screen.queryByText("Detalle de obra")).not.toBeInTheDocument();
  });

  test("el botón L2 deja a la vista dos niveles", () => {
    render(<GanttTable tasks={jerarquia} />);

    fireEvent.click(screen.getByRole("button", { name: "L2" }));

    expect(screen.getByText("Capítulo")).toBeInTheDocument();
    expect(screen.getByText("Subcapítulo")).toBeInTheDocument();
    expect(screen.queryByText("Detalle de obra")).not.toBeInTheDocument();
  });

  test("con muchos niveles el control sigue siendo botones, no un desplegable", () => {
    render(
      <GanttTable
        tasks={[
          ...jerarquia,
          makeTask({ id: 4, name: "Subdetalle", outlineLevel: 4 }),
        ]}
      />,
    );

    expect(screen.queryByTestId("expand-level-select")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("expand-level-button")).toHaveLength(4);
  });
});

describe("las exportaciones dicen lo que hacen (M25)", () => {
  test("descargar entrega un CSV, no un TSV", () => {
    render(
      <GanttTable tasks={[makeTask({ id: 1 })]} observations={[]} />,
    );

    expect(screen.getByTestId("excel-download-export")).toHaveAttribute(
      "title",
      expect.stringMatching(/CSV/),
    );
  });

  test("copiar dice que es para pegar en Excel, que es lo que hace", () => {
    render(<GanttTable tasks={[makeTask({ id: 1 })]} observations={[]} />);

    expect(screen.getByTestId("excel-copy-export")).toHaveAttribute(
      "title",
      expect.stringMatching(/pegar en Excel/i),
    );
  });
});

describe("la cinta se lee por grupos y los encabezados no gritan (E41, E42)", () => {
  test("cada grupo de la cinta lleva su etiqueta visible", () => {
    render(<GanttTable tasks={[makeTask({ id: 1 })]} onUpdateTask={jest.fn()} />);

    const etiquetas = screen
      .getAllByTestId("gantt-table-ribbon-group")
      .map((grupo) => grupo.getAttribute("data-label"));

    expect(etiquetas.length).toBeGreaterThanOrEqual(3);
    expect(etiquetas.every((etiqueta) => Boolean(etiqueta))).toBe(true);
  });

  test("los grupos están separados, no en una sola tira de iconos", () => {
    render(<GanttTable tasks={[makeTask({ id: 1 })]} onUpdateTask={jest.fn()} />);

    const grupos = screen.getAllByTestId("gantt-table-ribbon-group");
    expect(new Set(grupos.map((g) => g.getAttribute("data-label"))).size).toBe(
      grupos.length,
    );
  });
});

describe("la columna Predecesoras muestra el dato, no el control (E40)", () => {
  const conDependencia = [
    makeTask({ id: 1 }),
    makeTask({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS", lag: 2 }] }),
  ];

  test("de entrada se lee el vínculo, no un botón", () => {
    render(<GanttTable tasks={conDependencia} onUpdateTask={jest.fn()} />);

    const celda = screen.getByTestId("cell-predecessors-2");
    expect(celda).toHaveTextContent("1FS+2");
    expect(celda.querySelector("button")).toBeNull();
  });

  test("el control aparece al pasar por la fila", () => {
    render(<GanttTable tasks={conDependencia} onUpdateTask={jest.fn()} />);

    const celda = screen.getByTestId("cell-predecessors-2");
    fireEvent.mouseEnter(celda.closest("tr")!);

    expect(celda.querySelector("button")).not.toBeNull();
  });

  test("y también cuando la fila está seleccionada, sin ratón", () => {
    render(
      <GanttTable
        tasks={conDependencia}
        selectedTaskIds={[2]}
        onUpdateTask={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId("cell-predecessors-2").querySelector("button"),
    ).not.toBeNull();
  });
});
