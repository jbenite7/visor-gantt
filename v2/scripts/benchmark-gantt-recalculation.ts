import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
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
