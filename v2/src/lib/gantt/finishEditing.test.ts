import { durationFromFinish } from "./finishEditing";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import { createProjectDate } from "@/lib/date/projectDate";
import type { GanttTask } from "@/components/gantt/types";

const tarea: GanttTask = {
  id: 1,
  name: "Excavación",
  start: createProjectDate("2026-01-05"), // lunes
  finish: createProjectDate("2026-01-09"), // viernes
  duration: 5,
  progress: 0,
  isCritical: false,
  isMilestone: false,
  isSummary: false,
  outlineLevel: 1,
  dependencies: [],
};

describe("editar el fin cambia la duración, como MS Project (Bloque B)", () => {
  test("alargar hasta el martes siguiente cuenta los días que sí se trabajan", () => {
    // El calendario por defecto trabaja de lunes a sábado: del lunes 5 al
    // martes 13 hay 9 días de calendario y 8 laborables (el domingo 11 no).
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-13"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r).toEqual({ ok: true, duration: 8 });
  });

  test("acortar al mismo día de inicio deja la duración en 1", () => {
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-05"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r).toEqual({ ok: true, duration: 1 });
  });

  test("un fin anterior al inicio se rechaza explicando", () => {
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-02"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/antes del inicio/i);
  });

  test("no cuenta los días no laborables del calendario", () => {
    // Del lunes 5 al lunes 12 hay 8 días de calendario y 7 laborables.
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-12"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r).toEqual({ ok: true, duration: 7 });
  });

  test("un fin en día no laborable se rechaza en vez de inventar una duración", () => {
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-11"), // domingo
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no se trabaja/i);
  });

  test("respeta los festivos del proyecto, no solo los domingos", () => {
    const calendario = {
      ...DEFAULT_PROJECT_CALENDAR,
      nonWorkingDays: [
        { id: "h1", date: "2026-01-07", name: "Festivo de prueba" },
      ],
    };

    // Del lunes 5 al viernes 9, con el miércoles 7 festivo: 4 laborables.
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-09"),
      calendario,
    );
    expect(r).toEqual({ ok: true, duration: 4 });
  });
});

describe("las tareas llevan hora: la cuenta va por día (Bloque B)", () => {
  test("una tarea que empieza a las 08:00 cuenta ese día entero", () => {
    const conHora: GanttTask = {
      ...tarea,
      start: new Date("2026-01-05T08:00:00"),
      finish: new Date("2026-01-09T17:00:00"),
    };

    const r = durationFromFinish(
      conHora,
      new Date("2026-01-09T00:00:00"),
      DEFAULT_PROJECT_CALENDAR,
    );

    expect(r).toEqual({ ok: true, duration: 5 });
  });

  test("un fin a las 17:00 del mismo día de inicio sigue siendo 1", () => {
    const conHora: GanttTask = {
      ...tarea,
      start: new Date("2026-01-05T08:00:00"),
    };

    const r = durationFromFinish(
      conHora,
      new Date("2026-01-05T17:00:00"),
      DEFAULT_PROJECT_CALENDAR,
    );

    expect(r).toEqual({ ok: true, duration: 1 });
  });
});
