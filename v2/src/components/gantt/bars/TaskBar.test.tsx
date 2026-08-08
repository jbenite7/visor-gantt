/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import TaskBar from "./TaskBar";
import type { GanttTask } from "../types";
import { createProjectDate } from "@/lib/date/projectDate";

const task: GanttTask = {
  id: 1,
  name: "Excavación",
  start: createProjectDate("2026-01-05"),
  finish: createProjectDate("2026-01-09"),
  duration: 5,
  progress: 0,
  isCritical: false,
  isMilestone: false,
  isSummary: false,
  outlineLevel: 1,
  dependencies: [],
};

function renderBar(extra: Partial<React.ComponentProps<typeof TaskBar>> = {}) {
  return render(
    <svg>
      <TaskBar
        task={task}
        x={40}
        y={0}
        width={100}
        height={28}
        color="var(--aia-proj-main)"
        onDragStart={jest.fn()}
        onResizeStart={jest.fn()}
        {...extra}
      />
    </svg>,
  );
}

describe("los tiradores se ven (E29)", () => {
  test("sin ratón encima, los tiradores no distraen", () => {
    renderBar();

    expect(screen.getByTestId("task-bar-resize-right")).toHaveAttribute(
      "data-visible",
      "false",
    );
  });

  test("al pasar por la barra, los tiradores dejan de ser invisibles", () => {
    renderBar();

    fireEvent.mouseEnter(screen.getByTestId("task-bar"));

    expect(screen.getByTestId("task-bar-resize-right")).toHaveAttribute(
      "data-visible",
      "true",
    );
    expect(screen.getByTestId("task-bar-resize-left")).toHaveAttribute(
      "data-visible",
      "true",
    );
  });

  test("una barra seleccionada muestra los tiradores sin necesidad de ratón", () => {
    renderBar({ isSelected: true });

    expect(screen.getByTestId("task-bar-resize-right")).toHaveAttribute(
      "data-visible",
      "true",
    );
  });

  test("una barra que no se puede arrastrar no ofrece tiradores", () => {
    render(
      <svg>
        <TaskBar
          task={task}
          x={40}
          y={0}
          width={100}
          height={28}
          color="var(--aia-proj-main)"
        />
      </svg>,
    );

    expect(screen.queryByTestId("task-bar-resize-right")).not.toBeInTheDocument();
  });
});

describe("el arrastre dice a dónde va (E30)", () => {
  test("durante el arrastre se ve la fecha destino, no solo un rectángulo", () => {
    renderBar({
      dragState: {
        isDragging: true,
        taskId: 1,
        ghostX: 40,
        ghostY: 0,
        dayDelta: 3,
      },
    });

    expect(screen.getByTestId("drag-destination")).toHaveTextContent(
      "08/01/2026",
    );
  });

  test("sin arrastre no hay etiqueta de destino", () => {
    renderBar();

    expect(screen.queryByTestId("drag-destination")).not.toBeInTheDocument();
  });

  test("arrastrando otra barra, esta no muestra destino", () => {
    renderBar({
      dragState: {
        isDragging: true,
        taskId: 99,
        ghostX: 40,
        ghostY: 0,
        dayDelta: 3,
      },
    });

    expect(screen.queryByTestId("drag-destination")).not.toBeInTheDocument();
  });
});
