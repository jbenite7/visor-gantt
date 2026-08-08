import { describeAreaRemoval, removeAreaWithTasks } from "./removeArea";
import type { MatrixPlan } from "@/types/matrix";
import type { GanttTask } from "@/components/gantt/types";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [
      { id: "piso-1", name: "Piso 1", type: "Piso" },
      { id: "piso-2", name: "Piso 2", type: "Piso" },
    ],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        generatedTaskIds: ["mx-1", "mx-2"],
      },
      {
        id: "c2",
        scopeId: "estructura",
        areaId: "piso-2",
        recipeId: "r1",
        active: true,
        generatedTaskIds: ["mx-3"],
      },
    ],
  };
}

function matrixTask(id: string, areaId: string, cellId: string): GanttTask {
  return {
    id,
    name: `Columnas ${areaId}`,
    start: new Date("2026-03-02T08:00:00"),
    finish: new Date("2026-03-06T17:00:00"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 3,
    dependencies: [],
    matrixSource: {
      matrixPlanId: "p1",
      scopeId: "estructura",
      areaId,
      cellId,
      recipeId: "r1",
      activityId: "columnas",
    },
    matrixSync: { lastEditedAt: "2026-03-02T00:00:00.000Z", lastEditedFrom: "matrix" },
  };
}

const tareas: GanttTask[] = [
  matrixTask("mx-1", "piso-1", "c1"),
  matrixTask("mx-2", "piso-1", "c1"),
  matrixTask("mx-3", "piso-2", "c2"),
  { ...matrixTask("suelta", "piso-1", "c1"), matrixSource: undefined },
];

describe("describeAreaRemoval", () => {
  test("cuenta las celdas y las tareas que se llevaría por delante", () => {
    const preview = describeAreaRemoval(plan(), tareas, "piso-1");

    expect(preview.areaName).toBe("Piso 1");
    expect(preview.cellCount).toBe(1);
    expect(preview.taskIds).toEqual(["mx-1", "mx-2"]);
  });

  test("lo dice en lenguaje de obra", () => {
    expect(describeAreaRemoval(plan(), tareas, "piso-1").message).toBe(
      "«Piso 1» tiene 2 tareas ya generadas en el cronograma. Elige qué hacer con ellas antes de borrarla.",
    );
  });

  test("una ubicación sin tareas generadas lo dice también, sin alarmar", () => {
    const sinTareas = describeAreaRemoval(plan(), [], "piso-2");

    expect(sinTareas.taskIds).toEqual([]);
    expect(sinTareas.message).toBe(
      "«Piso 2» no tiene tareas en el cronograma. Se puede borrar sin más.",
    );
  });

  test("una ubicación que no existe no inventa un aviso", () => {
    expect(describeAreaRemoval(plan(), tareas, "fantasma").taskIds).toEqual([]);
  });
});

describe("removeAreaWithTasks", () => {
  test("borrar quita la ubicación, sus celdas y sus tareas", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "borrar");

    expect(result.matrixPlan.areas.map((area) => area.id)).toEqual(["piso-2"]);
    expect(result.matrixPlan.cells.map((cell) => cell.id)).toEqual(["c2"]);
    expect(result.tasks.map((task) => task.id)).toEqual(["mx-3", "suelta"]);
  });

  test("conservar deja las tareas en el cronograma, ya sin dueño en la matriz", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "conservar");

    expect(result.tasks.map((task) => task.id)).toEqual([
      "mx-1",
      "mx-2",
      "mx-3",
      "suelta",
    ]);
    const conservada = result.tasks.find((task) => task.id === "mx-1")!;
    expect(conservada.matrixSource).toBeUndefined();
    expect(conservada.matrixSync).toBeUndefined();
  });

  test("conservar no desengancha las tareas de las otras ubicaciones", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "conservar");

    expect(result.tasks.find((task) => task.id === "mx-3")?.matrixSource).toBeDefined();
  });

  test("no toca las tareas que nunca fueron de la matriz", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "borrar");

    expect(result.tasks.find((task) => task.id === "suelta")).toBeDefined();
  });

  test("borrar una ubicación que no existe devuelve todo igual", () => {
    const original = plan();
    const result = removeAreaWithTasks(original, tareas, "fantasma", "borrar");

    expect(result.matrixPlan.areas).toHaveLength(2);
    expect(result.tasks).toHaveLength(4);
  });
});
