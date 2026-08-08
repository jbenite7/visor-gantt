import { MIN_LOCATIONS_FOR_RECIPE, proposeMatrixFromTasks } from "./matrixProposal";
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
    const { recipes } = proposeMatrixFromTasks(cronograma());

    for (const recipe of recipes) {
      expect(recipe.confidence).toBeGreaterThan(0);
      expect(recipe.confidence).toBeLessThanOrEqual(1);
    }
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

  test("resume lo propuesto en lenguaje de obra", () => {
    expect(proposeMatrixFromTasks(cronograma()).summary).toBe(
      "Se proponen 4 ubicaciones, 3 alcances y 2 recetas a partir de 7 tareas.",
    );
  });
});
