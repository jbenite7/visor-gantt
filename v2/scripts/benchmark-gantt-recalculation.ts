import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import { buildMatrixPlanFromGantt } from "@/lib/matrix/matrixFromGantt";
import { calculateMppFields } from "@/lib/mpp/mppCalculationEngine";
import { normalizeProjectCalendar } from "@/lib/scheduling/projectCalendar";
import { recalculateSchedule } from "@/lib/scheduling/scheduleEngine";
import {
  mppAssignmentsToAssignments,
  mppResourcesToResources,
  mppTasksToGanttTasks,
} from "@/components/upload/mpp-to-gantt";
import type { ProjectData as ParsedMppProject } from "@/lib/parser/mpp-parser";
import type { GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";
import type { MatrixPlan } from "@/types/matrix";

const DEFAULT_MPP_PATH =
  "/Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp";
const DEFAULT_PARSER_URL = "http://127.0.0.1:8000/api/parse-mpp";

interface Sample {
  tasks: GanttTask[];
  resources: ReturnType<typeof mppResourcesToResources>;
  assignments: ReturnType<typeof mppAssignmentsToAssignments>;
  calendar: ProjectCalendar;
  statusDate: ParsedMppProject["statusDate"];
}

interface SyntheticBenchmarkSample {
  matrixPlan: MatrixPlan;
  tasks: GanttTask[];
  calendar: ProjectCalendar;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function summarize(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    avgMs: Number((total / values.length).toFixed(3)),
    p50Ms: Number(percentile(values, 50).toFixed(3)),
    p95Ms: Number(percentile(values, 95).toFixed(3)),
    minMs: Number(Math.min(...values).toFixed(3)),
    maxMs: Number(Math.max(...values).toFixed(3)),
  };
}

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function syntheticCalendar(): ProjectCalendar {
  return {
    timeZone: "America/Bogota",
    workDays: [1, 2, 3, 4, 5],
    startHour: "08:00",
    endHour: "17:00",
    hoursPerDay: 8,
    nonWorkingDays: [],
    dateOverrides: [],
  };
}

function buildSyntheticMatrixPlan(): MatrixPlan {
  const floors = Number(process.env.BENCHMARK_SYNTHETIC_FLOORS ?? 40);
  const scopeTree = [
    {
      id: "estructura",
      name: "Estructura",
      type: "Disciplina",
      defaultRecipeId: "estructura-concreto",
    },
    {
      id: "arquitectura",
      name: "Arquitectura",
      type: "Disciplina",
      defaultRecipeId: "arquitectura-muros",
    },
    {
      id: "mep",
      name: "Redes MEP",
      type: "Disciplina",
      defaultRecipeId: "mep-rough-in",
    },
  ];
  const areas = Array.from({ length: floors }, (_, index) => ({
    id: `piso-${index + 1}`,
    name: `Piso ${String(index + 1).padStart(2, "0")}`,
    type: "Piso",
  }));
  const recipes = [
    {
      id: "estructura-concreto",
      name: "Estructura en concreto",
      activities: [
        { id: "formaleta", name: "Formaleta", productivityPerDay: 50, defaultQuantity: 100, unit: "m2" },
        { id: "acero", name: "Acero de refuerzo", productivityPerDay: 800, defaultQuantity: 1600, unit: "kg" },
        { id: "vaciado", name: "Vaciado de concreto", productivityPerDay: 40, defaultQuantity: 80, unit: "m3" },
      ],
      dependencies: [
        { predecessorActivityId: "formaleta", successorActivityId: "acero", type: "FS" as const, lagDays: 0 },
        { predecessorActivityId: "acero", successorActivityId: "vaciado", type: "FS" as const, lagDays: 0 },
      ],
      lineOfBalance: { scopeType: "Piso", offsetDays: 2 },
    },
    {
      id: "arquitectura-muros",
      name: "Muros y acabados base",
      activities: [
        { id: "mamposteria", name: "Mamposteria", productivityPerDay: 35, defaultQuantity: 140, unit: "m2" },
        { id: "panete", name: "Panete", productivityPerDay: 45, defaultQuantity: 140, unit: "m2" },
      ],
      dependencies: [
        { predecessorActivityId: "mamposteria", successorActivityId: "panete", type: "FS" as const, lagDays: 1 },
      ],
      lineOfBalance: { scopeType: "Piso", offsetDays: 3 },
    },
    {
      id: "mep-rough-in",
      name: "Redes embebidas",
      activities: [
        { id: "trazado", name: "Trazado de redes", productivityPerDay: 120, defaultQuantity: 120, unit: "m" },
        { id: "instalacion", name: "Instalacion de redes", productivityPerDay: 80, defaultQuantity: 120, unit: "m" },
      ],
      dependencies: [
        { predecessorActivityId: "trazado", successorActivityId: "instalacion", type: "FS" as const, lagDays: 0 },
      ],
      lineOfBalance: { scopeType: "Piso", offsetDays: 2 },
    },
  ];

  return {
    id: "benchmark-matrix",
    name: "Benchmark Matrix sintetico",
    templateId: "benchmark-synthetic",
    startDate: "2026-01-05",
    scopeTree,
    areas,
    recipes,
    cells: scopeTree.flatMap((scope) =>
      areas.map((area) => ({
        id: `cell-${scope.id}-${area.id}`,
        scopeId: scope.id,
        areaId: area.id,
        recipeId: scope.defaultRecipeId,
        active: true,
        quantity: 100,
        unit: "und",
        productivityOverridePerDay: 25,
        lastEditedAt: "2026-01-01T00:00:00.000Z",
        lastEditedFrom: "matrix" as const,
      })),
    ),
  };
}

function buildSyntheticSample(): SyntheticBenchmarkSample {
  const matrixPlan = buildSyntheticMatrixPlan();
  const generated = generateScheduleFromMatrix(matrixPlan);
  return {
    matrixPlan,
    tasks: generated.tasks,
    calendar: syntheticCalendar(),
  };
}

async function parseMpp(path: string, parserUrl: string): Promise<ParsedMppProject> {
  const file = await fs.readFile(path);
  const formData = new FormData();
  formData.set("file", new File([file], path.split("/").at(-1) ?? "project.mpp"));
  const response = await fetch(parserUrl, { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error(`Parser returned ${response.status}: ${await response.text()}`);
  }
  return await response.json() as ParsedMppProject;
}

function buildSample(parsed: ParsedMppProject): Sample {
  return {
    tasks: mppTasksToGanttTasks(parsed.tasks),
    resources: mppResourcesToResources(parsed.resources ?? []),
    assignments: mppAssignmentsToAssignments(parsed.assignments ?? []),
    calendar: normalizeProjectCalendar(parsed.calendar),
    statusDate: parsed.statusDate,
  };
}

function editFirstPredecessorTask(tasks: GanttTask[]): GanttTask[] {
  const target = tasks.find((task) => task.dependencies.length > 0) ?? tasks[0];
  return tasks.map((task) =>
    task.id === target.id
      ? { ...task, duration: Math.max(1, task.duration + 1) }
      : task,
  );
}

function editFirstPredecessorLink(tasks: GanttTask[]): GanttTask[] {
  const targetIndex = tasks.findIndex((task) => task.dependencies.length > 0);
  if (targetIndex < 0) return editFirstPredecessorTask(tasks);

  const target = tasks[targetIndex];
  const currentDependency = target.dependencies[0];
  const replacement = [...tasks.slice(0, targetIndex)]
    .reverse()
    .find((task) => task.id !== target.id && task.id !== currentDependency.from);

  return tasks.map((task) => {
    if (task.id !== target.id) return task;
    const [first, ...rest] = task.dependencies;
    return {
      ...task,
      dependencies: [
        {
          ...first,
          from: replacement?.id ?? first.from,
          lag: replacement ? first.lag : (first.lag ?? 0) + 1,
        },
        ...rest,
      ],
    };
  });
}

async function main() {
  if (process.env.BENCHMARK_SYNTHETIC === "1") {
    const runs = Number(process.env.BENCHMARK_RUNS ?? 30);
    const sample = buildSyntheticSample();
    const metrics = {
      matrixGenerateSchedule: [] as number[],
      matrixRoundTripFromGantt: [] as number[],
      recalculateSchedule: [] as number[],
      combinedMatrixGanttPath: [] as number[],
    };

    for (let i = 0; i < runs; i += 1) {
      metrics.matrixGenerateSchedule.push(time(() => {
        generateScheduleFromMatrix(sample.matrixPlan);
      }));

      metrics.matrixRoundTripFromGantt.push(time(() => {
        buildMatrixPlanFromGantt({
          id: `benchmark-roundtrip-${i}`,
          name: "Benchmark roundtrip",
          startDate: sample.matrixPlan.startDate,
          tasks: sample.tasks,
          generatedAt: "2026-01-01T00:00:00.000Z",
        });
      }));

      metrics.recalculateSchedule.push(time(() => {
        recalculateSchedule(sample.tasks, { calendar: sample.calendar });
      }));

      metrics.combinedMatrixGanttPath.push(time(() => {
        const generated = generateScheduleFromMatrix(sample.matrixPlan);
        const imported = buildMatrixPlanFromGantt({
          id: `benchmark-combined-${i}`,
          name: "Benchmark combined",
          startDate: sample.matrixPlan.startDate,
          tasks: generated.tasks,
          generatedAt: "2026-01-01T00:00:00.000Z",
        });
        recalculateSchedule(imported.tasks, { calendar: sample.calendar });
      }));
    }

    const operationalTasks = sample.tasks.filter((task) => !task.isSummary);
    console.log(JSON.stringify({
      mode: "synthetic",
      runs,
      matrixCells: sample.matrixPlan.cells.length,
      tasks: sample.tasks.length,
      operationalTasks: operationalTasks.length,
      dependencies: sample.tasks.reduce(
        (count, task) => count + task.dependencies.length,
        0,
      ),
      results: {
        matrixGenerateSchedule: summarize(metrics.matrixGenerateSchedule),
        matrixRoundTripFromGantt: summarize(metrics.matrixRoundTripFromGantt),
        recalculateSchedule: summarize(metrics.recalculateSchedule),
        combinedMatrixGanttPath: summarize(metrics.combinedMatrixGanttPath),
      },
    }, null, 2));
    return;
  }

  const mppPath = process.env.BENCHMARK_MPP_PATH ?? DEFAULT_MPP_PATH;
  const parserUrl = process.env.MPP_PARSER_URL ?? DEFAULT_PARSER_URL;
  const runs = Number(process.env.BENCHMARK_RUNS ?? 30);

  const parseStarted = performance.now();
  const parsed = await parseMpp(mppPath, parserUrl);
  const parseMs = performance.now() - parseStarted;
  const sample = buildSample(parsed);
  const scheduled = recalculateSchedule(sample.tasks, {
    calendar: sample.calendar,
  }).tasks;

  const metrics = {
    recalculateSchedule: [] as number[],
    calculateMppFields: [] as number[],
    durationEditCombinedPath: [] as number[],
    predecessorEditCombinedPath: [] as number[],
  };

  for (let i = 0; i < runs; i += 1) {
    metrics.recalculateSchedule.push(time(() => {
      recalculateSchedule(sample.tasks, { calendar: sample.calendar });
    }));

    metrics.calculateMppFields.push(time(() => {
      calculateMppFields({
        tasks: scheduled,
        resources: sample.resources,
        assignments: sample.assignments,
        baselines: [],
        calendar: sample.calendar,
        statusDate: sample.statusDate,
        mppTaskColumns: parsed.mppTaskColumns ?? [],
        mppResourceColumns: parsed.mppResourceColumns ?? [],
        mppAssignmentColumns: parsed.mppAssignmentColumns ?? [],
        customFieldDefinitions: parsed.customFieldDefinitions ?? [],
      });
    }));

    metrics.durationEditCombinedPath.push(time(() => {
      const edited = editFirstPredecessorTask(sample.tasks);
      const recalculated = recalculateSchedule(edited, {
        calendar: sample.calendar,
      });
      calculateMppFields({
        tasks: recalculated.tasks,
        resources: sample.resources,
        assignments: sample.assignments,
        baselines: [],
        calendar: sample.calendar,
        statusDate: sample.statusDate,
        mppTaskColumns: parsed.mppTaskColumns ?? [],
        mppResourceColumns: parsed.mppResourceColumns ?? [],
        mppAssignmentColumns: parsed.mppAssignmentColumns ?? [],
        customFieldDefinitions: parsed.customFieldDefinitions ?? [],
      });
    }));

    metrics.predecessorEditCombinedPath.push(time(() => {
      const edited = editFirstPredecessorLink(sample.tasks);
      const recalculated = recalculateSchedule(edited, {
        calendar: sample.calendar,
      });
      calculateMppFields({
        tasks: recalculated.tasks,
        resources: sample.resources,
        assignments: sample.assignments,
        baselines: [],
        calendar: sample.calendar,
        statusDate: sample.statusDate,
        mppTaskColumns: parsed.mppTaskColumns ?? [],
        mppResourceColumns: parsed.mppResourceColumns ?? [],
        mppAssignmentColumns: parsed.mppAssignmentColumns ?? [],
        customFieldDefinitions: parsed.customFieldDefinitions ?? [],
      });
    }));
  }

  const dependencyCount = sample.tasks.reduce(
    (count, task) => count + task.dependencies.length,
    0,
  );

  console.log(JSON.stringify({
    mppPath,
    parserUrl,
    runs,
    parseMs: Number(parseMs.toFixed(3)),
    tasks: sample.tasks.length,
    resources: sample.resources.length,
    assignments: sample.assignments.length,
    dependencies: dependencyCount,
    results: {
      recalculateSchedule: summarize(metrics.recalculateSchedule),
      calculateMppFields: summarize(metrics.calculateMppFields),
      durationEditCombinedPath: summarize(metrics.durationEditCombinedPath),
      predecessorEditCombinedPath: summarize(metrics.predecessorEditCombinedPath),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
