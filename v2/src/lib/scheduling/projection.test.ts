import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import { computeAchievedSCurve, measurePace, projectCompletion } from "./projection";

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

  test("una tarea resumen no se cuenta junto a sus hijas", () => {
    // El capítulo agrega a sus dos hijas: contarlo sumaría el trabajo dos veces.
    const conResumen = computeAchievedSCurve([
      task({ id: "cap", isSummary: true, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-20"), duration: 20, progress: 100 }),
      task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), duration: 10, progress: 100 }),
      task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), duration: 10, progress: 100 }),
    ], createProjectDate("2026-01-20"));

    const sinResumen = computeAchievedSCurve([
      task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), duration: 10, progress: 100 }),
      task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), duration: 10, progress: 100 }),
    ], createProjectDate("2026-01-20"));

    expect(conResumen).toEqual(sinResumen);
  });

  test("un proyecto que solo tiene resúmenes no inventa avance", () => {
    const puntos = computeAchievedSCurve([
      task({ id: "cap", isSummary: true, duration: 20, progress: 100 }),
    ], createProjectDate("2026-01-20"));

    expect(puntos.every((p) => p.cumulativeValue === 0)).toBe(true);
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

describe("projectCompletion", () => {
  function obra(primero: number, segundo: number): GanttTask[] {
    return [
      task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: primero }),
      task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: segundo }),
      task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
      task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
    ];
  }

  const corte = createProjectDate("2026-01-20");

  function iso(date: Date): string {
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${mes}-${dia}`;
  }

  test("ritmo constante: las tres líneas caen el mismo día", () => {
    const resultado = projectCompletion(obra(100, 100), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(iso(resultado.probable.finishDate)).toBe("2026-02-09");
    expect(iso(resultado.optimistic.finishDate)).toBe("2026-02-09");
    expect(iso(resultado.pessimistic.finishDate)).toBe("2026-02-09");
  });

  test("ritmo que se acelera: la probable coincide con la optimista y la pesimista se va más lejos", () => {
    const resultado = projectCompletion(obra(30, 100), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(iso(resultado.probable.finishDate)).toBe("2026-02-27");
    expect(iso(resultado.optimistic.finishDate)).toBe("2026-02-27");
    expect(iso(resultado.pessimistic.finishDate)).toBe("2026-03-03");
  });

  test("ritmo que se frena: la probable coincide con la pesimista", () => {
    const resultado = projectCompletion(obra(100, 30), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(iso(resultado.probable.finishDate)).toBe("2026-03-15");
    expect(iso(resultado.optimistic.finishDate)).toBe("2026-03-03");
    expect(iso(resultado.pessimistic.finishDate)).toBe("2026-03-15");
  });

  test("cada línea arranca en el avance logrado y termina en el 100 %", () => {
    const resultado = projectCompletion(obra(100, 100), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(resultado.probable.points).toHaveLength(2);
    expect(resultado.probable.points[0].cumulativeValue).toBeCloseTo(50, 6);
    expect(iso(resultado.probable.points[0].date)).toBe("2026-01-20");
    expect(resultado.probable.points[1].cumulativeValue).toBe(100);
  });

  test("avance cero: no proyecta y dice qué falta", () => {
    const resultado = projectCompletion(obra(0, 0), corte);

    expect(resultado.available).toBe(false);
    if (resultado.available) return;
    expect(resultado.reason).toBe("sinAvance");
    expect(resultado.message).toMatch(/avance/i);
  });

  test("sin tareas: no proyecta y dice qué falta", () => {
    const resultado = projectCompletion([], corte);

    expect(resultado.available).toBe(false);
    if (resultado.available) return;
    expect(resultado.reason).toBe("sinTareas");
    expect(resultado.message).toMatch(/cronograma/i);
  });

  test("por debajo del umbral mínimo de días medidos no se proyecta", () => {
    const resultado = projectCompletion(
      [task({ id: 1, start: createProjectDate("2026-01-01"), duration: 10, progress: 50 })],
      createProjectDate("2026-01-03"),
    );

    expect(resultado.available).toBe(false);
    if (resultado.available) return;
    expect(resultado.reason).toBe("pocosDias");
    expect(resultado.message).toContain("7");
  });

  test("justo en el umbral sí se proyecta", () => {
    const resultado = projectCompletion(
      [task({ id: 1, start: createProjectDate("2026-01-01"), duration: 10, progress: 50 })],
      createProjectDate("2026-01-07"),
    );

    expect(resultado.available).toBe(true);
  });
});
