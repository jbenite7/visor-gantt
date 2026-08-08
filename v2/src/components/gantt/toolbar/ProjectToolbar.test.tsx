/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ProjectToolbar from "./ProjectToolbar";

function renderToolbar(
  extra: Partial<React.ComponentProps<typeof ProjectToolbar>> = {},
) {
  return render(
    <ProjectToolbar
      activeView="gantt"
      onViewChange={jest.fn()}
      scale="week"
      onScaleChange={jest.fn()}
      canUndo={false}
      canRedo={false}
      onUndo={jest.fn()}
      onRedo={jest.fn()}
      onAddTask={jest.fn()}
      onDeleteTask={jest.fn()}
      hasSelection={false}
      projectName="Obra"
      projectStart={new Date("2026-01-05")}
      projectFinish={new Date("2026-03-01")}
      taskCount={8}
      durationDays={40}
      averageProgress={20}
      dependencyCount={5}
      {...extra}
    />,
  );
}

describe("la barra no se reordena bajo el dedo (E15)", () => {
  test("Deshacer y Rehacer siguen ahí cuando no hay historial, apagados", () => {
    renderToolbar();

    expect(screen.getByTestId("toolbar-undo")).toBeDisabled();
    expect(screen.getByTestId("toolbar-redo")).toBeDisabled();
  });

  test("con historial se encienden, en el mismo sitio", () => {
    renderToolbar({ canUndo: true, canRedo: false });

    expect(screen.getByTestId("toolbar-undo")).toBeEnabled();
    expect(screen.getByTestId("toolbar-redo")).toBeDisabled();
  });

  test("deshacer sigue haciendo lo suyo", () => {
    const onUndo = jest.fn();
    renderToolbar({ canUndo: true, onUndo });

    fireEvent.click(screen.getByTestId("toolbar-undo"));

    expect(onUndo).toHaveBeenCalled();
  });
});

describe("lo destructivo se separa de lo frecuente (E34)", () => {
  test("Eliminar lleva etiqueta de texto, no solo un icono", () => {
    renderToolbar({ hasSelection: true });

    expect(screen.getByTestId("toolbar-delete")).toHaveTextContent("Eliminar");
  });

  test("Eliminar no queda pegado a Agregar", () => {
    renderToolbar({ hasSelection: true });

    const agregar = screen.getByTestId("toolbar-add");
    const eliminar = screen.getByTestId("toolbar-delete");

    expect(agregar.nextElementSibling).not.toBe(eliminar);
    expect(agregar.nextElementSibling).toHaveClass(
      "gantt-project-toolbar__mini-divider",
    );
  });

  test("sin selección, Eliminar está apagado pero visible", () => {
    renderToolbar({ hasSelection: false });

    expect(screen.getByTestId("toolbar-delete")).toBeDisabled();
    expect(screen.getByTestId("toolbar-delete")).toBeInTheDocument();
  });
});
