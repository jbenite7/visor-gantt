/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { act, render } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import {
  ProjectProvider,
  type ProjectContextValue,
  useProject,
} from "./ProjectContext";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-05T08:00:00"),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function Harness({ onValue }: { onValue: (value: ProjectContextValue) => void }) {
  const value = useProject();
  onValue(value);
  return null;
}

describe("ProjectContext schedule recalculation", () => {
  test("duration edits recalculate successor bars", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider
        initialTasks={[
          task({ id: 1 }),
          task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
        ]}
      >
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.updateTask(1, "duration", 3));

    expect(isoDate(ctx!.tasks.find((t) => t.id === 1)!.finish)).toBe("2026-01-07");
    expect(isoDate(ctx!.tasks.find((t) => t.id === 2)!.start)).toBe("2026-01-08");
    expect(ctx!.scheduleIssues).toHaveLength(0);
  });

  test("records planning audit events for persisted planning edits", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1, duration: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.updateTask(1, "duration", 3));

    expect(ctx!.planningAuditEvents).toEqual([
      expect.objectContaining({
        kind: "taskEdit",
        summary: "Update duration on task 1",
        taskIds: [1],
      }),
    ]);
    expect(ctx!.planningAuditEvents[0].createdAt).toEqual(expect.any(String));
  });

  test("keeps progress and percentComplete in sync during edits", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1, progress: 10, percentComplete: 10 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.updateTask(1, "progress", 42.25));

    expect(ctx!.tasks.find((t) => t.id === 1)).toEqual(
      expect.objectContaining({
        progress: 42.25,
        percentComplete: 42.25,
      }),
    );

    act(() => ctx!.updateTask(1, "percentComplete", 73.5));

    expect(ctx!.tasks.find((t) => t.id === 1)).toEqual(
      expect.objectContaining({
        progress: 73.5,
        percentComplete: 73.5,
      }),
    );
  });

  test("created dependencies are stored on the successor task", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 }), task({ id: 2 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.createDependency(1, 2, "FS"));

    expect(ctx!.tasks.find((t) => t.id === 1)!.dependencies).toEqual([]);
    expect(ctx!.tasks.find((t) => t.id === 2)!.dependencies).toEqual([
      { from: 1, to: 2, type: "FS" },
    ]);
  });

  test("invalid dependencies surface issues and keep the previous schedule", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.createDependency(1, 1, "FS"));

    expect(ctx!.tasks.find((t) => t.id === 1)!.dependencies).toEqual([]);
    expect(ctx!.scheduleIssues.some((issue) => issue.kind === "selfDependency")).toBe(true);
  });

  test("structure actions update WBS through the shared project state", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 }), task({ id: 2 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.indentTask(2));

    expect(ctx!.tasks.map((item) => item.outlineLevel)).toEqual([1, 2]);
    expect(ctx!.tasks.map((item) => item.wbs)).toEqual(["1", "1.1"]);
    expect(ctx!.tasks[0].isSummary).toBe(true);

    act(() => ctx!.undo());

    expect(ctx!.tasks.map((item) => item.outlineLevel)).toEqual([1, 1]);
  });

  test("calendar edits recalculate schedule and undo restores calendar plus dates", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider
        initialCalendar={DEFAULT_PROJECT_CALENDAR}
        initialTasks={[
          task({
            id: 1,
            start: new Date("2026-01-09T08:00:00"),
            finish: new Date("2026-01-10T08:00:00"),
            duration: 2,
          }),
          task({
            id: 2,
            start: new Date("2026-01-12T08:00:00"),
            finish: new Date("2026-01-12T08:00:00"),
            duration: 1,
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
      >
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    expect(isoDate(ctx!.tasks.find((t) => t.id === 1)!.finish)).toBe("2026-01-10");
    expect(isoDate(ctx!.tasks.find((t) => t.id === 2)!.start)).toBe("2026-01-12");

    act(() =>
      ctx!.updateCalendar({
        ...ctx!.calendar,
        workDays: [1, 2, 3, 4, 5],
      }),
    );

    expect(ctx!.calendar.workDays).toEqual([1, 2, 3, 4, 5]);
    expect(isoDate(ctx!.tasks.find((t) => t.id === 1)!.finish)).toBe("2026-01-12");
    expect(isoDate(ctx!.tasks.find((t) => t.id === 2)!.start)).toBe("2026-01-13");

    act(() => ctx!.undo());

    expect(ctx!.calendar.workDays).toEqual(DEFAULT_PROJECT_CALENDAR.workDays);
    expect(isoDate(ctx!.tasks.find((t) => t.id === 1)!.finish)).toBe("2026-01-10");
    expect(isoDate(ctx!.tasks.find((t) => t.id === 2)!.start)).toBe("2026-01-12");
  });
});

describe("task creation and deletion go through history (E1)", () => {
  test("deleting tasks is undoable and restores them", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider
        initialTasks={[task({ id: 1 }), task({ id: 2 }), task({ id: 3 })]}
      >
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.deleteTasks([2, 3]));

    expect(ctx!.tasks.map((t) => t.id)).toEqual([1]);
    expect(ctx!.canUndo).toBe(true);

    act(() => ctx!.undo());

    expect(ctx!.tasks.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  test("adding a task is undoable", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.addTask());

    expect(ctx!.tasks).toHaveLength(2);

    act(() => ctx!.undo());

    expect(ctx!.tasks).toHaveLength(1);
  });

  test("deleting reports what happened so the UI can announce it", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 }), task({ id: 2 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.deleteTasks([2]));

    expect(ctx!.lastAction).toEqual(
      expect.objectContaining({ kind: "delete", count: 1 }),
    );
  });

  test("deleting nothing does not touch history", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.deleteTasks([]));

    expect(ctx!.canUndo).toBe(false);
    expect(ctx!.tasks).toHaveLength(1);
  });
});

describe("las ediciones rechazadas se anuncian (E23)", () => {
  test("una dependencia circular expone el motivo en lastRejection", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider
        initialTasks={[
          task({ id: 1 }),
          task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
        ]}
      >
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    // Cerrar el ciclo: 2 -> 1, cuando ya existe 1 -> 2.
    act(() => ctx!.createDependency(2, 1, "FS"));

    expect(ctx!.scheduleIssues.length).toBeGreaterThan(0);
    expect(ctx!.lastRejection).toEqual(
      expect.objectContaining({ reason: expect.any(String) }),
    );
    expect(ctx!.lastRejection!.reason.length).toBeGreaterThan(0);
  });

  test("una edición válida no deja rechazo pendiente", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.updateTask(1, "duration", 3));

    expect(ctx!.lastRejection).toBeNull();
  });

  test("un calendario inválido expone el motivo en vez de rechazarse en silencio (E25)", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    // Jornada imposible: empieza después de terminar.
    // (Nota: `workDays: []` no sirve como caso inválido — `normalizeProjectCalendar`
    // lo rellena con los días por defecto antes de validar.)
    act(() =>
      ctx!.updateCalendar({
        ...ctx!.calendar,
        startHour: "18:00",
        endHour: "08:00",
      }),
    );

    expect(ctx!.calendarIssues.length).toBeGreaterThan(0);
    expect(ctx!.lastRejection?.reason).toBeTruthy();
  });
});

describe("runUndoable: acciones deshacibles fuera del contexto (E24)", () => {
  test("ejecuta la acción, la registra en el historial y la revierte", () => {
    let ctx: ProjectContextValue | undefined;
    const store: string[] = ["a", "b"];

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() =>
      ctx!.runUndoable({
        description: "1 recurso eliminado",
        execute: () => {
          store.length = 0;
          store.push("a");
        },
        undo: () => {
          store.length = 0;
          store.push("a", "b");
        },
      }),
    );

    expect(store).toEqual(["a"]);
    expect(ctx!.canUndo).toBe(true);
    expect(ctx!.lastAction?.description).toBe("1 recurso eliminado");

    act(() => ctx!.undo());

    expect(store).toEqual(["a", "b"]);
  });

  test("rehacer vuelve a aplicar la acción", () => {
    let ctx: ProjectContextValue | undefined;
    let value = 10;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value_) => (ctx = value_)} />
      </ProjectProvider>,
    );

    act(() =>
      ctx!.runUndoable({
        description: "Cambio",
        execute: () => {
          value = 20;
        },
        undo: () => {
          value = 10;
        },
      }),
    );
    act(() => ctx!.undo());
    expect(value).toBe(10);

    act(() => ctx!.redo());
    expect(value).toBe(20);
  });
});

describe("observaciones de obra (E43)", () => {
  test("añadir una observación la deja pendiente y visible para la tarea", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1, name: "Excavación" })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.addObservation(1, "Falta acero de refuerzo"));

    expect(ctx!.observations).toHaveLength(1);
    expect(ctx!.observations[0]).toEqual(
      expect.objectContaining({
        taskId: 1,
        taskName: "Excavación",
        text: "Falta acero de refuerzo",
        status: "pending",
      }),
    );
  });

  test("un texto vacío no crea observación", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.addObservation(1, "   "));

    expect(ctx!.observations).toHaveLength(0);
  });

  test("atender una observación cambia su estado", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.addObservation(1, "Revisar nivel"));
    const id = ctx!.observations[0].id;
    act(() => ctx!.toggleObservation(id));

    expect(ctx!.observations[0].status).toBe("done");
  });

  test("borrar una observación es deshacible", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.addObservation(1, "Revisar nivel"));
    const id = ctx!.observations[0].id;

    act(() => ctx!.deleteObservation(id));
    expect(ctx!.observations).toHaveLength(0);

    act(() => ctx!.undo());
    expect(ctx!.observations).toHaveLength(1);
  });
});

describe("el deshacer se anuncia (E12)", () => {
  test("tras Ctrl+Z el aviso dice qué se deshizo", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 }), task({ id: 2 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.deleteTasks([2]));
    act(() => ctx!.undo());

    expect(ctx!.lastAction?.description).toMatch(/^Deshecho:/);
  });

  test("el aviso de 'deshecho' no ofrece volver a deshacer (no es kind deshacible)", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 }), task({ id: 2 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.deleteTasks([2]));
    expect(ctx!.lastAction?.kind).toBe("delete");

    act(() => ctx!.undo());

    // Un aviso "Deshecho: ..." no debe prometer un botón "Deshacer" que en
    // realidad deshace la acción anterior del historial, no la que el texto
    // describe. Se distingue por `kind`, no por el texto.
    expect(ctx!.lastAction?.kind).toBe("undone");
  });
});
