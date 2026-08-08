import { MIN_LOCATIONS_FOR_RECIPE, planFromProposal, proposeMatrixFromTasks } from "./matrixProposal";
import type { GanttTask } from "@/components/gantt/types";

function task(
  id: number,
  name: string,
  startDay: number,
  durationDays: number,
  wbs?: string,
): GanttTask {
  const start = new Date(2026, 2, startDay);
  const finish = new Date(2026, 2, startDay + durationDays - 1);
  return {
    id,
    name,
    wbs,
    start,
    finish,
    duration: durationDays,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [],
  };
}

/** Tres pisos con mampostería y pintura, más urbanismo sin ubicación. */
function cronograma(): GanttTask[] {
  return [
    task(1, "Mampostería piso 1", 2, 5),
    task(2, "Pintura piso 1", 8, 3),
    task(3, "Mampostería piso 2", 9, 5),
    task(4, "Pintura piso 2", 15, 4),
    task(5, "Mampostería piso 3", 16, 6),
    task(6, "Pintura piso 3", 23, 3),
    task(7, "Vías internas", 2, 10),
  ];
}

describe("proposeMatrixFromTasks · ubicaciones", () => {
  test("propone una ubicación por piso detectado", () => {
    const { locations } = proposeMatrixFromTasks(cronograma());

    expect(locations.map((location) => location.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
      "Obra general",
    ]);
  });

  test("las ordena como se construye, y deja la obra general al final", () => {
    const conSotano = [...cronograma(), task(8, "Mampostería sótano 2", 1, 4)];
    const { locations } = proposeMatrixFromTasks(conSotano);

    expect(locations.map((location) => location.order)).toEqual([-2, 1, 2, 3, Infinity]);
  });

  test("cada ubicación dice cuántas tareas la sostienen", () => {
    const { locations } = proposeMatrixFromTasks(cronograma());
    const piso1 = locations.find((location) => location.name === "Piso 1")!;

    expect(piso1.taskCount).toBe(2);
    expect(piso1.evidence).toContain("2 tareas");
  });
});

describe("proposeMatrixFromTasks · alcances y recetas", () => {
  test("un alcance es la actividad sin su ubicación", () => {
    const { scopes } = proposeMatrixFromTasks(cronograma());

    expect(scopes.map((scope) => scope.name).sort()).toEqual([
      "Mampostería",
      "Pintura",
      "Vías internas",
    ]);
  });

  test("solo propone receta para lo que se repite en tres o más ubicaciones", () => {
    const { recipes } = proposeMatrixFromTasks(cronograma());

    expect(recipes.map((recipe) => recipe.name).sort()).toEqual([
      "Mampostería",
      "Pintura",
    ]);
    expect(MIN_LOCATIONS_FOR_RECIPE).toBe(3);
  });

  test("el rendimiento propuesto es la duración mediana, no la media", () => {
    // Mampostería: 5, 5 y 6 días → mediana 5. Con un paro largo la media mentiría.
    const conParo = cronograma().map((item) =>
      item.id === 5 ? task(5, "Mampostería piso 3", 16, 40) : item,
    );
    const { recipes } = proposeMatrixFromTasks(conParo);
    const mamposteria = recipes.find((recipe) => recipe.name === "Mampostería")!;

    expect(mamposteria.activities[0].medianDurationDays).toBe(5);
  });

  test("cada receta explica en qué se basa", () => {
    const { recipes } = proposeMatrixFromTasks(cronograma());
    const mamposteria = recipes.find((recipe) => recipe.name === "Mampostería")!;

    expect(mamposteria.evidence).toBe(
      "«Mampostería» aparece en 3 ubicaciones, con 5 días de mediana.",
    );
  });

  test("la confianza sube con el número de ubicaciones donde se repite", () => {
    // Comparar dos propuestas, no solo mirar el rango: un valor constante
    // también estaría entre 0 y 1 y la prueba no se enteraría.
    const enCincoPisos = [
      ...cronograma(),
      task(20, "Mampostería piso 4", 30, 5),
      task(21, "Mampostería piso 5", 36, 5),
    ];
    const enTres = proposeMatrixFromTasks(cronograma()).recipes.find(
      (recipe) => recipe.name === "Mampostería",
    )!;
    const enCinco = proposeMatrixFromTasks(enCincoPisos).recipes.find(
      (recipe) => recipe.name === "Mampostería",
    )!;

    expect(enCinco.confidence).toBeGreaterThan(enTres.confidence);
    for (const recipe of [enTres, enCinco]) {
      expect(recipe.confidence).toBeGreaterThan(0);
      expect(recipe.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("la mediana también manda dentro de una misma ubicación", () => {
    // Piso 1 tiene tres mamposterías: 5, 5 y 40 días. Por mediana el piso
    // rinde 5 y la receta sale 5; por media rendiría 16,7 y la receta 6.
    const conParoEnUnPiso = [
      ...cronograma(),
      task(30, "Mampostería piso 1", 2, 5),
      task(31, "Mampostería piso 1", 2, 40),
    ];
    const { recipes } = proposeMatrixFromTasks(conParoEnUnPiso);
    const mamposteria = recipes.find((recipe) => recipe.name === "Mampostería")!;

    expect(mamposteria.activities[0].medianDurationDays).toBe(5);
  });

  test("agrupa igual aunque la obra se organice por bloques y no por pisos", () => {
    // El alcance se limpia con los patrones del motor, así que cualquier
    // palabra que el motor aprenda a ubicar, esta función la quita sola.
    const porBloques = [
      task(40, "Mampostería bloque 1", 2, 5),
      task(41, "Mampostería bloque 2", 8, 5),
      task(42, "Mampostería bloque 3", 14, 6),
    ];
    const proposal = proposeMatrixFromTasks(porBloques);

    expect(proposal.scopes.map((scope) => scope.name)).toEqual(["Mampostería"]);
    expect(proposal.recipes.map((recipe) => recipe.name)).toEqual(["Mampostería"]);
  });
});

describe("proposeMatrixFromTasks · honestidad", () => {
  test("un cronograma sin patrón repetido no inventa una matriz", () => {
    const sinPatron = [
      task(1, "Localización y replanteo", 2, 3),
      task(2, "Construcción de campamentos", 5, 4),
      task(3, "Excavación a cota 2110", 9, 8),
    ];
    const proposal = proposeMatrixFromTasks(sinPatron);

    expect(proposal.recipes).toHaveLength(0);
    expect(proposal.summary).toBe(
      "Este cronograma no repite ninguna actividad en tres o más ubicaciones, así que no hay recetas que proponer.",
    );
  });

  test("las tareas resumen no cuentan", () => {
    const conResumen: GanttTask[] = [
      { ...task(10, "ACABADOS", 1, 30), isSummary: true, outlineLevel: 1 },
      ...cronograma(),
    ];
    const proposal = proposeMatrixFromTasks(conResumen);

    expect(proposal.scopes.map((scope) => scope.name)).not.toContain("ACABADOS");
  });

  test("la obra general no cuenta como una ubicación más para el mínimo", () => {
    // Dos pisos y una tarea sin ubicación no son tres ubicaciones: el cajón
    // de sastre no puede completar el umbral.
    const dosPisosYGeneral = [
      task(50, "Enchape piso 1", 2, 4),
      task(51, "Enchape piso 2", 7, 4),
      task(52, "Enchape", 12, 4),
    ];
    const proposal = proposeMatrixFromTasks(dosPisosYGeneral);

    expect(proposal.recipes).toHaveLength(0);
  });

  test("nombra la cubierta como cubierta, no como «Piso CUBIERTA»", () => {
    const conCubierta = [...cronograma(), task(60, "Impermeabilización cubierta", 30, 5)];
    const { locations } = proposeMatrixFromTasks(conCubierta);

    expect(locations.map((location) => location.name)).toContain("Cubierta");
  });

  test("resume lo propuesto en lenguaje de obra", () => {
    expect(proposeMatrixFromTasks(cronograma()).summary).toBe(
      "Se proponen 4 ubicaciones, 3 alcances y 2 recetas a partir de 7 tareas.",
    );
  });
});

const ENTRADA = {
  id: "plan-nuevo",
  name: "Torre 3",
  startDate: "2026-03-02",
  editedAt: "2026-08-07T12:00:00.000Z",
};

function todoAceptado(proposal: ReturnType<typeof proposeMatrixFromTasks>) {
  return {
    locationIds: proposal.locations.map((location) => location.id),
    scopeIds: proposal.scopes.map((scope) => scope.id),
    recipeIds: proposal.recipes.map((recipe) => recipe.id),
  };
}

describe("planFromProposal", () => {
  test("construye el plan con lo aceptado", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(proposal, todoAceptado(proposal), ENTRADA);

    expect(plan.id).toBe("plan-nuevo");
    expect(plan.areas.map((area) => area.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
      "Obra general",
    ]);
    expect(plan.scopeTree).toHaveLength(3);
  });

  test("lo descartado no entra en el plan", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      {
        locationIds: ["piso-1", "piso-2"],
        scopeIds: ["mamposteria"],
        recipeIds: ["receta-mamposteria"],
      },
      ENTRADA,
    );

    expect(plan.areas).toHaveLength(2);
    expect(plan.scopeTree).toHaveLength(1);
    expect(plan.recipes).toHaveLength(1);
  });

  test("crea una celda por cada cruce de alcance y ubicación aceptados", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      {
        locationIds: ["piso-1", "piso-2", "piso-3"],
        scopeIds: ["mamposteria", "pintura"],
        recipeIds: ["receta-mamposteria", "receta-pintura"],
      },
      ENTRADA,
    );

    expect(plan.cells).toHaveLength(6);
  });

  test("el rendimiento propuesto llega a la receta del plan", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(proposal, todoAceptado(proposal), ENTRADA);
    const mamposteria = plan.recipes.find((recipe) => recipe.name === "Mampostería")!;

    // 5 días de mediana con cantidad 1 → rendimiento 1/5 por día
    expect(mamposteria.activities[0].productivityPerDay).toBeCloseTo(1 / 5, 5);
    expect(mamposteria.activities[0].defaultQuantity).toBe(1);
  });

  test("un alcance sin receta aceptada queda con sus celdas inactivas, no roto", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      { locationIds: ["piso-1"], scopeIds: ["vias-internas"], recipeIds: [] },
      ENTRADA,
    );

    expect(plan.cells).toHaveLength(1);
    expect(plan.cells[0].active).toBe(false);
    expect(plan.cells[0].recipeId).toBeUndefined();
  });

  test("aceptar nada devuelve un plan vacío que se puede abrir sin reventar", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      { locationIds: [], scopeIds: [], recipeIds: [] },
      ENTRADA,
    );

    expect(plan.cells).toEqual([]);
    expect(plan.areas).toEqual([]);
    expect(plan.scopeTree).toEqual([]);
  });
});
