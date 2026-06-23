/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GanttView from "./GanttView";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";

jest.mock("@/app/actions/project", () => ({
  saveProject: jest.fn(async () => ({ success: true, id: "test-project" })),
}));

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
});
