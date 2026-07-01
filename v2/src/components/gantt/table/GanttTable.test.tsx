/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
    // Name is at index 2 (after ID and WBS)
    const nameCell = nameCells[2];
    expect(nameCell).toHaveStyle("font-weight: 600");
  });

  test("renders column headers", () => {
    render(<GanttTable tasks={[regularTask]} />);

    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Duración")).toBeInTheDocument();
    expect(screen.getByText("Comienzo")).toBeInTheDocument();
    expect(screen.getByText("Fin")).toBeInTheDocument();
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
});
