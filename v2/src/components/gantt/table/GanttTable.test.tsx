/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import GanttTable from "./GanttTable";
import type { GanttTask } from "@/components/gantt/types";

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
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Finish")).toBeInTheDocument();
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
