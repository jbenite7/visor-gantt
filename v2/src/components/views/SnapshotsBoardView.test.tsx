/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import type { ProjectSnapshot, ProjectSnapshotSummary } from "@/types/snapshot";
import { createProjectDate } from "@/lib/date/projectDate";
import SnapshotsBoardView from "./SnapshotsBoardView";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

const resumen: ProjectSnapshotSummary = {
  id: "foto-1",
  name: "Importación del 5 de febrero",
  origin: "import",
  capturedAt: createProjectDate("2026-02-05"),
  taskCount: 2,
};

const foto: ProjectSnapshot = {
  id: "foto-1",
  projectId: "p1",
  name: "Importación del 5 de febrero",
  origin: "import",
  capturedAt: createProjectDate("2026-02-05"),
  tasks: [
    {
      taskId: 1,
      name: "Excavación",
      start: createProjectDate("2026-01-01"),
      finish: createProjectDate("2026-01-10"),
      duration: 10,
    },
    {
      taskId: 2,
      name: "Cimentación",
      start: createProjectDate("2026-01-11"),
      finish: createProjectDate("2026-01-20"),
      duration: 10,
    },
  ],
};

describe("SnapshotsBoardView (A2)", () => {
  test("sin ninguna foto, el tablero enseña de dónde salen en vez de quedarse en blanco", () => {
    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[]}
        isLoading={false}
        loadSnapshot={async () => null}
        onMarkSnapshot={() => {}}
      />,
    );

    const vacio = screen.getByTestId("snapshots-board-empty");
    expect(vacio).toHaveTextContent(/cada vez que importas/i);
    expect(vacio).toHaveTextContent(/marcar un corte/i);
  });

  test("lista las fotos con su fecha y de dónde salieron", () => {
    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[resumen]}
        isLoading={false}
        loadSnapshot={async () => foto}
        onMarkSnapshot={() => {}}
      />,
    );

    const lista = screen.getByTestId("snapshots-board-list");
    expect(lista).toHaveTextContent("Importación del 5 de febrero");
    expect(lista).toHaveTextContent("05/02/2026");
    expect(lista).toHaveTextContent("Importación");
  });

  test("al elegir una foto se carga y se compara contra el plan de hoy, mostrando solo lo que cambió", async () => {
    const loadSnapshot = jest.fn(async () => foto);

    render(
      <SnapshotsBoardView
        tasks={[
          task({
            id: 1,
            name: "Excavación",
            start: createProjectDate("2026-01-04"),
            finish: createProjectDate("2026-01-13"),
          }),
          task({
            id: 2,
            name: "Cimentación",
            start: createProjectDate("2026-01-11"),
            finish: createProjectDate("2026-01-20"),
          }),
        ]}
        summaries={[resumen]}
        isLoading={false}
        loadSnapshot={loadSnapshot}
        onMarkSnapshot={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Importación del 5 de febrero/ }));

    await waitFor(() =>
      expect(screen.getByTestId("snapshots-board-comparison")).toBeInTheDocument(),
    );
    expect(loadSnapshot).toHaveBeenCalledWith("foto-1");
    const comparacion = screen.getByTestId("snapshots-board-comparison");

    // La que se movió aparece.
    expect(comparacion).toHaveTextContent("Excavación");
    expect(comparacion).toHaveTextContent("+3 d");
    expect(comparacion).toHaveTextContent("1 atrasada");

    // La que no cambió NO se pinta como fila de la tabla: solo cuenta en el resumen.
    expect(screen.queryByText("Cimentación")).not.toBeInTheDocument();
  });

  test("si nada se movió desde la foto, la tabla lo dice en vez de quedar vacía", async () => {
    const loadSnapshot = jest.fn(async () => foto);

    render(
      <SnapshotsBoardView
        tasks={[
          task({
            id: 1,
            name: "Excavación",
            start: createProjectDate("2026-01-01"),
            finish: createProjectDate("2026-01-10"),
          }),
          task({
            id: 2,
            name: "Cimentación",
            start: createProjectDate("2026-01-11"),
            finish: createProjectDate("2026-01-20"),
          }),
        ]}
        summaries={[resumen]}
        isLoading={false}
        loadSnapshot={loadSnapshot}
        onMarkSnapshot={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Importación del 5 de febrero/ }));

    await waitFor(() =>
      expect(screen.getByTestId("snapshots-board-comparison")).toBeInTheDocument(),
    );
    const comparacion = screen.getByTestId("snapshots-board-comparison");
    expect(comparacion).toHaveTextContent(/el plan no se ha movido desde ese corte/i);
  });

  test("marcar un corte a mano exige un nombre", () => {
    const onMarkSnapshot = jest.fn();

    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[]}
        isLoading={false}
        loadSnapshot={async () => null}
        onMarkSnapshot={onMarkSnapshot}
      />,
    );

    fireEvent.click(screen.getByTestId("snapshots-board-mark"));
    expect(onMarkSnapshot).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("snapshots-board-mark-name"), {
      target: { value: "Corte de obra de enero" },
    });
    fireEvent.click(screen.getByTestId("snapshots-board-mark"));

    expect(onMarkSnapshot).toHaveBeenCalledWith("Corte de obra de enero");
  });

  test("mientras carga la lista lo dice, sin fingir que no hay fotos", () => {
    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[]}
        isLoading={true}
        loadSnapshot={async () => null}
        onMarkSnapshot={() => {}}
      />,
    );

    expect(screen.queryByTestId("snapshots-board-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("snapshots-board")).toHaveTextContent(/Cargando/i);
  });
});
