import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import { computeAchievedSCurve, measurePace } from "./projection";

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

/** Cuatro bloques consecutivos de 10 días; los dos primeros ejecutados. */
function obraConDosBloquesTerminados(): GanttTask[] {
  return [
    task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: 100 }),
    task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: 100 }),
    task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
    task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
  ];
}

describe("computeAchievedSCurve", () => {
  test("acumula un punto por día desde el inicio de obra hasta la fecha de corte", () => {
    const puntos = computeAchievedSCurve(
      obraConDosBloquesTerminados(),
      createProjectDate("2026-01-20"),
    );

    expect(puntos).toHaveLength(20);
    expect(puntos[0].date.getTime()).toBe(createProjectDate("2026-01-01").getTime());
    expect(puntos[19].date.getTime()).toBe(createProjectDate("2026-01-20").getTime());
  });

  test("con dos bloques de cuatro ejecutados, el avance logrado al corte es del 50 %", () => {
    const puntos = computeAchievedSCurve(
      obraConDosBloquesTerminados(),
      createProjectDate("2026-01-20"),
    );

    expect(puntos[19].cumulativeValue).toBeCloseTo(50, 6);
    expect(puntos[4].cumulativeValue).toBeCloseTo(12.5, 6);
  });

  test("el avance de una tarea no se acredita más allá del porcentaje reportado", () => {
    const puntos = computeAchievedSCurve(
      [task({ id: 1, progress: 30 })],
      createProjectDate("2026-01-10"),
    );

    expect(puntos[2].cumulativeValue).toBeCloseTo(30, 6);
    expect(puntos[9].cumulativeValue).toBeCloseTo(30, 6);
  });

  test("sin tareas la serie está vacía", () => {
    expect(computeAchievedSCurve([], createProjectDate("2026-01-20"))).toEqual([]);
  });

  test("una fecha de corte anterior al inicio de obra no produce serie", () => {
    expect(
      computeAchievedSCurve(obraConDosBloquesTerminados(), createProjectDate("2025-12-20")),
    ).toEqual([]);
  });
});

describe("measurePace", () => {
  /** Cuatro bloques de 10 días; el primero al `primero` %, el segundo al `segundo` %. */
  function obra(primero: number, segundo: number): GanttTask[] {
    return [
      task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: primero }),
      task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: segundo }),
      task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
      task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
    ];
  }

  const corte = createProjectDate("2026-01-20");

  test("ritmo constante: el ritmo medio y el reciente coinciden", () => {
    const pace = measurePace(computeAchievedSCurve(obra(100, 100), corte))!;

    expect(pace.elapsedDays).toBe(20);
    expect(pace.achievedPercent).toBeCloseTo(50, 6);
    expect(pace.overallPace).toBeCloseTo(2.5, 6);
    expect(pace.recentPace).toBeCloseTo(2.5, 6);
  });

  test("ritmo que se acelera: el reciente supera al medio", () => {
    const pace = measurePace(computeAchievedSCurve(obra(30, 100), corte))!;

    expect(pace.achievedPercent).toBeCloseTo(32.5, 6);
    expect(pace.overallPace).toBeCloseTo(1.625, 6);
    expect(pace.recentPace).toBeCloseTo(25 / 14, 6);
    expect(pace.recentPace).toBeGreaterThan(pace.overallPace);
  });

  test("ritmo que se frena: el reciente queda por debajo del medio", () => {
    const pace = measurePace(computeAchievedSCurve(obra(100, 30), corte))!;

    expect(pace.achievedPercent).toBeCloseTo(32.5, 6);
    expect(pace.overallPace).toBeCloseTo(1.625, 6);
    expect(pace.recentPace).toBeCloseTo(1.25, 6);
    expect(pace.recentPace).toBeLessThan(pace.overallPace);
  });

  test("sin avance registrado no hay ritmo que medir", () => {
    expect(measurePace(computeAchievedSCurve(obra(0, 0), corte))).toBeNull();
  });

  test("una serie vacía no produce medición", () => {
    expect(measurePace([])).toBeNull();
  });

  test("si la obra se detuvo en la ventana reciente, el ritmo reciente cae al medio en vez de a cero", () => {
    // Solo se ejecutó el primer bloque, y la fecha de corte está tan lejos que
    // los últimos 14 días son completamente planos.
    const pace = measurePace(
      computeAchievedSCurve(obra(100, 0), createProjectDate("2026-02-09")),
    )!;

    expect(pace.elapsedDays).toBe(40);
    expect(pace.achievedPercent).toBeCloseTo(25, 6);
    expect(pace.overallPace).toBeCloseTo(0.625, 6);
    expect(pace.recentPace).toBeCloseTo(pace.overallPace, 6);
  });
});
