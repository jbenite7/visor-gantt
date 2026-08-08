import {
  applyMatrixUpdate,
  applyMatrixUpdate as aplicar,
  syncMatrixPlanFromTasks,
} from "@/lib/matrix/matrixSync";
import {
  generateScheduleFromMatrix,
  generateScheduleFromMatrix as generar,
} from "@/lib/matrix/matrixGenerator";
import type { GanttTask } from "@/components/gantt/types";
import type { MatrixPlan } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";

function planWithQuantity(quantity: number): MatrixPlan {
  return {
    id: "matrix-sync",
    name: "Sincronizacion",
    startDate: "2026-01-05",
    scopeTree: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    areas: [{ id: "arquitectura", name: "Arquitectura" }],
    recipes: [
      {
        id: "muros",
        name: "Muros",
        activities: [
          {
            id: "mamposteria",
            name: "Mamposteria",
            productivityPerDay: 25,
          },
        ],
        dependencies: [],
      },
    ],
    cells: [
      {
        id: "cell-muros",
        scopeId: "piso-1",
        areaId: "arquitectura",
        recipeId: "muros",
        active: true,
        quantity,
        unit: "m2",
      },
    ],
  };
}

describe("matrixSync", () => {
  test("regenerates linked matrix tasks while preserving non-matrix tasks and progress", () => {
    const previousPlan = planWithQuantity(50);
    const current = generateScheduleFromMatrix(previousPlan);
    const generatedTask = current.tasks.find((task) => !task.isSummary)!;
    const manualTask: GanttTask = {
      id: "manual-1",
      name: "Revision manual",
      start: new Date("2026-01-10T00:00:00"),
      finish: new Date("2026-01-10T00:00:00"),
      duration: 1,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    const result = applyMatrixUpdate({
      tasks: [{ ...generatedTask, progress: 35 }, manualTask],
      currentPlan: previousPlan,
      nextPlan: planWithQuantity(100),
    });

    const regenerated = result.tasks.find(
      (task) => task.matrixSource?.cellId === "cell-muros",
    );

    expect(result.conflicts).toEqual([]);
    expect(result.tasks).toContainEqual(manualTask);
    expect(regenerated).toMatchObject({
      duration: 4,
      progress: 35,
    });
    expect(result.matrixPlan.cells[0].generatedTaskIds).toEqual([
      regenerated?.id,
    ]);
  });

  test("la edición manual en el Gantt es la que produce el rendimiento observado", () => {
    const plan = planWithQuantity(50);
    const generated = generateScheduleFromMatrix(plan);
    // Así sella la app cada edición manual del Gantt: con `matrixSync`.
    const editedTasks = generated.tasks.map((task) =>
      task.matrixSource?.activityId === "mamposteria"
        ? {
            ...task,
            duration: 5,
            matrixSync: {
              lastEditedAt: "2026-01-02T00:00:00.000Z",
              lastEditedFrom: "gantt" as const,
            },
          }
        : task,
    );

    const synced = syncMatrixPlanFromTasks(plan, editedTasks);

    expect(synced.cells[0].feedback).toEqual({
      source: "gantt",
      observedDurationDays: 5,
      suggestedProductivityPerDay: 10,
      status: "pendingApproval",
    });
  });

  test("una celda que nadie tocó en el Gantt no propone ningún rendimiento", () => {
    const plan = planWithQuantity(50);
    const generated = generateScheduleFromMatrix(plan);

    const synced = syncMatrixPlanFromTasks(plan, generated.tasks);

    expect(synced.cells[0].feedback).toBeUndefined();
  });

  test("descartar un rendimiento observado lo mantiene descartado en la siguiente sincronización", () => {
    const base = planWithQuantity(50);
    // Lo que deja el panel al pulsar «Mantener lo planificado».
    const planDescartado: MatrixPlan = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          feedback: {
            source: "gantt",
            observedDurationDays: 5,
            suggestedProductivityPerDay: 10,
            status: "dismissed",
          },
        },
      ],
    };
    // La tarea sigue editada en obra y sigue durando lo mismo: nada nuevo que
    // observar, así que no hay nada que volver a preguntar.
    const editedTasks = generateScheduleFromMatrix(planDescartado).tasks.map((task) =>
      task.matrixSource?.activityId === "mamposteria"
        ? {
            ...task,
            duration: 5,
            matrixSync: {
              lastEditedAt: "2026-01-02T00:00:00.000Z",
              lastEditedFrom: "gantt" as const,
            },
          }
        : task,
    );

    const synced = syncMatrixPlanFromTasks(planDescartado, editedTasks);

    expect(synced.cells[0].feedback?.status).toBe("dismissed");
  });

  test("si la obra vuelve a editar la tarea con otra duración, el rendimiento se pregunta de nuevo", () => {
    const base = planWithQuantity(50);
    const planDescartado: MatrixPlan = {
      ...base,
      cells: [
        {
          ...base.cells[0],
          feedback: {
            source: "gantt",
            observedDurationDays: 5,
            suggestedProductivityPerDay: 10,
            status: "dismissed",
          },
        },
      ],
    };
    const editedTasks = generateScheduleFromMatrix(planDescartado).tasks.map((task) =>
      task.matrixSource?.activityId === "mamposteria"
        ? {
            ...task,
            duration: 8,
            matrixSync: {
              lastEditedAt: "2026-01-03T00:00:00.000Z",
              lastEditedFrom: "gantt" as const,
            },
          }
        : task,
    );

    const synced = syncMatrixPlanFromTasks(planDescartado, editedTasks);

    expect(synced.cells[0].feedback).toMatchObject({
      observedDurationDays: 8,
      status: "pendingApproval",
    });
  });

  test("syncs newer Gantt edits back to activity-level matrix quantities automatically", () => {
    const plan: MatrixPlan = {
      ...planWithQuantity(50),
      cells: [
        {
          ...planWithQuantity(50).cells[0],
          activityOverrides: [
            {
              activityId: "mamposteria",
              quantity: 50,
              unit: "m2",
              productivityPerDay: 25,
              lastEditedAt: "2026-01-01T00:00:00.000Z",
              lastEditedFrom: "matrix",
            },
          ],
        },
      ],
    };
    const generated = generateScheduleFromMatrix(plan);
    const editedTasks = generated.tasks.map((task) =>
      task.matrixSource?.activityId === "mamposteria"
        ? {
            ...task,
            duration: 5,
            matrixSync: {
              lastEditedAt: "2026-01-02T00:00:00.000Z",
              lastEditedFrom: "gantt" as const,
            },
          }
        : task,
    );

    const synced = syncMatrixPlanFromTasks(plan, editedTasks);

    expect(synced.cells[0].activityOverrides).toEqual([
      expect.objectContaining({
        activityId: "mamposteria",
        name: "Piso 1 - Mamposteria - Arquitectura",
        quantity: 50,
        unit: "m2",
        productivityPerDay: 10,
        sourceTaskId: "mx-task-cell-muros-mamposteria",
        duration: 5,
        progress: 0,
        lastEditedAt: "2026-01-02T00:00:00.000Z",
        lastEditedFrom: "gantt",
      }),
    ]);
    // El override se aplica y, además, queda el rendimiento observado a la
    // espera de visto bueno: son dos cosas distintas.
    expect(synced.cells[0].feedback).toMatchObject({
      source: "gantt",
      observedDurationDays: 5,
      status: "pendingApproval",
    });
  });

  test("keeps newer Gantt task edits when applying an older matrix update", () => {
    const currentPlan: MatrixPlan = {
      ...planWithQuantity(50),
      cells: [
        {
          ...planWithQuantity(50).cells[0],
          activityOverrides: [
            {
              activityId: "mamposteria",
              quantity: 50,
              unit: "m2",
              productivityPerDay: 25,
              lastEditedAt: "2026-01-01T00:00:00.000Z",
              lastEditedFrom: "matrix",
            },
          ],
        },
      ],
    };
    const generated = generateScheduleFromMatrix(currentPlan);
    const generatedTask = generated.tasks.find((task) => !task.isSummary)!;

    const result = applyMatrixUpdate({
      tasks: [
        {
          ...generatedTask,
          duration: 5,
          matrixSync: {
            lastEditedAt: "2026-01-03T00:00:00.000Z",
            lastEditedFrom: "gantt",
          },
        },
      ],
      currentPlan,
      nextPlan: {
        ...currentPlan,
        cells: [
          {
            ...currentPlan.cells[0],
            activityOverrides: [
              {
                activityId: "mamposteria",
                quantity: 100,
                unit: "m2",
                productivityPerDay: 25,
                lastEditedAt: "2026-01-02T00:00:00.000Z",
                lastEditedFrom: "matrix",
              },
            ],
          },
        ],
      },
    });

    expect(result.tasks.find((task) => !task.isSummary)).toMatchObject({
      duration: 5,
      matrixSync: {
        lastEditedAt: "2026-01-03T00:00:00.000Z",
        lastEditedFrom: "gantt",
      },
    });
  });
});

function planSimple(): MatrixPlan {
  return {
    id: "p-conflicto",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "r1",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 5 },
        ],
        dependencies: [],
      },
    ],
    cells: [
      { id: "c1", scopeId: "estructura", areaId: "piso-1", recipeId: "r1", active: true },
    ],
  };
}

describe("applyMatrixUpdate · conflictos con elección", () => {
  test("el conflicto trae las dos versiones para poder elegir con la información delante", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Columnas piso 1 (renombrada en obra)" },
    );

    const { conflicts } = aplicar({
      tasks: editadasEnGantt,
      currentPlan: plan,
      nextPlan: plan,
    });
    const conflictoDeNombre = conflicts.find((item) => item.field === "name")!;

    expect(conflictoDeNombre.ganttValue).toBe("Columnas piso 1 (renombrada en obra)");
    expect(conflictoDeNombre.matrixValue).toContain("Columnas");
    expect(conflictoDeNombre.matrixValue).not.toBe(conflictoDeNombre.ganttValue);
  });

  test("sin elección explícita gana la matriz, como hasta hoy", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Renombrada" },
    );

    const result = aplicar({ tasks: editadasEnGantt, currentPlan: plan, nextPlan: plan });
    const tarea = result.tasks.find((task) => task.matrixSource)!;

    expect(tarea.name).not.toBe("Renombrada");
  });

  test("eligiendo el Gantt se conserva lo que se editó en obra", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const tareaOriginal = tasks.find((task) => task.matrixSource)!;
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Renombrada" },
    );

    const result = aplicar({
      tasks: editadasEnGantt,
      currentPlan: plan,
      nextPlan: plan,
      resolutions: { [`${tareaOriginal.id}::name`]: "gantt" },
    });
    const tarea = result.tasks.find((task) => task.matrixSource)!;

    expect(tarea.name).toBe("Renombrada");
  });

  test("elegir la matriz explícitamente hace lo mismo que no elegir", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const tareaOriginal = tasks.find((task) => task.matrixSource)!;
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Renombrada" },
    );

    const result = aplicar({
      tasks: editadasEnGantt,
      currentPlan: plan,
      nextPlan: plan,
      resolutions: { [`${tareaOriginal.id}::name`]: "matriz" },
    });
    const tarea = result.tasks.find((task) => task.matrixSource)!;

    expect(tarea.name).toBe(tareaOriginal.name);
  });

  test("elegir el Gantt solo para la duración trae también el inicio y el fin, para que cuadren entre sí", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const tareaOriginal = tasks.find((task) => task.matrixSource)!;
    const editadasEnGantt = tasks.map((task) => {
      if (task.isSummary) return task;
      const nuevoInicio = new Date(task.start.getTime() + 3 * 24 * 60 * 60 * 1000);
      const nuevoFin = new Date(task.finish.getTime() + 3 * 24 * 60 * 60 * 1000);
      return { ...task, start: nuevoInicio, finish: nuevoFin, duration: task.duration + 2 };
    });
    const tareaEditada = editadasEnGantt.find((task) => task.matrixSource)!;

    const result = aplicar({
      tasks: editadasEnGantt,
      currentPlan: plan,
      nextPlan: plan,
      resolutions: { [`${tareaOriginal.id}::duration`]: "gantt" },
    });
    const tarea = result.tasks.find((task) => task.matrixSource)!;

    expect(tarea.duration).toBe(tareaEditada.duration);
    expect(tarea.start.getTime()).toBe(tareaEditada.start.getTime());
    expect(tarea.finish.getTime()).toBe(tareaEditada.finish.getTime());
  });
});

describe("aplicar usa el mismo calendario que la vista previa (M26)", () => {
  /** Un festivo justo en medio de la tarea: si no se respeta, se nota. */
  const calendarioConFestivo: ProjectCalendar = {
    ...DEFAULT_PROJECT_CALENDAR,
    nonWorkingDays: [
      { id: "f1", date: "2026-01-06", name: "Reyes" },
      { id: "f2", date: "2026-01-07", name: "Puente" },
    ],
  };

  test("el fin que se aplica es el que prometía la vista previa", () => {
    const plan = planWithQuantity(200);
    const previsto = generateScheduleFromMatrix(plan, {
      calendar: calendarioConFestivo,
    }).tasks.find((task) => !task.isSummary)!;

    const resultado = applyMatrixUpdate({
      tasks: [],
      currentPlan: plan,
      nextPlan: plan,
      calendar: calendarioConFestivo,
    });
    const aplicada = resultado.tasks.find((task) => task.id === previsto.id)!;

    expect(aplicada.finish.getTime()).toBe(previsto.finish.getTime());
  });

  test("con calendario no aparecen conflictos fantasma", () => {
    const plan = planWithQuantity(200);
    const generadas = generateScheduleFromMatrix(plan, {
      calendar: calendarioConFestivo,
    }).tasks;

    const resultado = applyMatrixUpdate({
      tasks: generadas,
      currentPlan: plan,
      nextPlan: plan,
      calendar: calendarioConFestivo,
    });

    expect(resultado.conflicts).toEqual([]);
  });

  test("sin calendario todo se comporta como siempre", () => {
    const plan = planWithQuantity(200);
    const deSiempre = generateScheduleFromMatrix(plan).tasks.find(
      (task) => !task.isSummary,
    )!;

    const resultado = applyMatrixUpdate({
      tasks: [],
      currentPlan: plan,
      nextPlan: plan,
    });
    const aplicada = resultado.tasks.find((task) => task.id === deSiempre.id)!;

    expect(aplicada.finish.getTime()).toBe(deSiempre.finish.getTime());
  });
});
