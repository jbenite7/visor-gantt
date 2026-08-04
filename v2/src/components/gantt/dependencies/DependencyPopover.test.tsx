/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DependencyPopover from "./DependencyPopover";
import type { GanttTask } from "@/components/gantt/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<GanttTask> & { id: string | number; name: string }): GanttTask {
  return {
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

const currentTask = makeTask({ id: 2, name: "Successor" });
const otherTasks = [
  makeTask({ id: 1, name: "Predecessor" }),
  makeTask({ id: 3, name: "Design" }),
];
const allTasks = [otherTasks[0], currentTask, otherTasks[1]];

function openPopover() {
  fireEvent.click(screen.getByTestId(`dependency-popover-open-${currentTask.id}`));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DependencyPopover", () => {
  test("filters candidate tasks with the search input", () => {
    render(<DependencyPopover task={currentTask} tasks={allTasks} locale="es" onCommit={jest.fn()} />);

    openPopover();

    const select = screen.getByTestId("dependency-task-select");
    expect(within(select).getAllByRole("option")).toHaveLength(2);

    fireEvent.change(screen.getByTestId("dependency-search"), {
      target: { value: "Design" },
    });

    const filteredOptions = within(select).getAllByRole("option");
    expect(filteredOptions).toHaveLength(1);
    expect(filteredOptions[0]).toHaveTextContent("Design");
  });

  test("never lists the current task among the candidates", () => {
    render(<DependencyPopover task={currentTask} tasks={allTasks} locale="es" onCommit={jest.fn()} />);

    openPopover();

    const select = screen.getByTestId("dependency-task-select");
    expect(within(select).queryByText(/Successor/)).not.toBeInTheDocument();

    // Even an empty search (no filtering) must exclude the task from itself.
    fireEvent.change(screen.getByTestId("dependency-search"), { target: { value: "" } });
    expect(within(select).queryByText(/Successor/)).not.toBeInTheDocument();
  });

  test("commits a dependency with the selected type and lag", () => {
    const onCommit = jest.fn();
    render(<DependencyPopover task={currentTask} tasks={allTasks} locale="es" onCommit={onCommit} />);

    openPopover();

    fireEvent.change(screen.getByTestId("dependency-task-select"), {
      target: { value: String(otherTasks[0].id) },
    });
    fireEvent.change(screen.getByTestId("dependency-type-select"), {
      target: { value: "SS" },
    });
    fireEvent.change(screen.getByTestId("dependency-lag-input"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("dependency-add"));
    fireEvent.click(screen.getByTestId("dependency-apply"));

    expect(onCommit).toHaveBeenCalledWith([
      { from: otherTasks[0].id, to: currentTask.id, type: "SS", lag: 3 },
    ]);
  });

  test.each(["FS", "SS", "FF", "SF"] as const)("supports setting relation type %s", (type) => {
    const onCommit = jest.fn();
    render(<DependencyPopover task={currentTask} tasks={allTasks} locale="es" onCommit={onCommit} />);

    openPopover();

    fireEvent.change(screen.getByTestId("dependency-task-select"), {
      target: { value: String(otherTasks[0].id) },
    });
    fireEvent.change(screen.getByTestId("dependency-type-select"), {
      target: { value: type },
    });
    fireEvent.click(screen.getByTestId("dependency-add"));
    fireEvent.click(screen.getByTestId("dependency-apply"));

    expect(onCommit).toHaveBeenCalledWith([
      expect.objectContaining({ from: otherTasks[0].id, to: currentTask.id, type }),
    ]);
  });
});
