import type { GanttDependency, GanttTask } from "@/components/gantt/types";

export function dependencyKey(dep: GanttDependency): string {
  return `${String(dep.from)}->${String(dep.to)}:${dep.type}:${dep.lag ?? 0}`;
}

export function normalizeDependency(dep: GanttDependency, fallbackTo?: string | number): GanttDependency {
  return {
    ...dep,
    to: dep.to ?? fallbackTo ?? dep.to,
    lag: dep.lag === undefined ? undefined : Number(dep.lag),
  };
}

export function normalizeDependencyList(
  dependencies: GanttDependency[],
  fallbackTo?: string | number,
): GanttDependency[] {
  const seen = new Set<string>();
  const result: GanttDependency[] = [];

  for (const dep of dependencies) {
    const normalized = normalizeDependency(dep, fallbackTo);
    const key = dependencyKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

export function addPredecessor(
  tasks: GanttTask[],
  successorId: string | number,
  dependency: Omit<GanttDependency, "to"> & { to?: string | number },
): GanttTask[] {
  return tasks.map((task) => {
    if (task.id !== successorId) return task;
    return {
      ...task,
      dependencies: normalizeDependencyList(
        [...task.dependencies, { ...dependency, to: successorId }],
        successorId,
      ),
    };
  });
}

export function replacePredecessors(
  tasks: GanttTask[],
  successorId: string | number,
  dependencies: Array<Omit<GanttDependency, "to"> & { to?: string | number }>,
): GanttTask[] {
  return tasks.map((task) =>
    task.id === successorId
      ? {
          ...task,
          dependencies: normalizeDependencyList(
            dependencies.map((dep) => ({ ...dep, to: successorId })),
            successorId,
          ),
        }
      : task,
  );
}

export function replaceSuccessors(
  tasks: GanttTask[],
  predecessorId: string | number,
  successors: GanttDependency[],
): GanttTask[] {
  const normalizedSuccessors = normalizeDependencyList(
    successors.map((dep) => ({ ...dep, from: predecessorId })),
  );
  const successorTargets = new Set(normalizedSuccessors.map((dep) => dep.to));

  return tasks.map((task) => {
    const retained = task.dependencies.filter(
      (dep) => dep.from !== predecessorId || successorTargets.has(dep.to),
    );
    const additions = normalizedSuccessors.filter((dep) => dep.to === task.id);
    return {
      ...task,
      dependencies: normalizeDependencyList([...retained, ...additions], task.id),
    };
  });
}

export function removeDependency(
  tasks: GanttTask[],
  dependency: Pick<GanttDependency, "from" | "to"> & Partial<Pick<GanttDependency, "type" | "lag">>,
): GanttTask[] {
  return tasks.map((task) => {
    if (task.id !== dependency.to) return task;
    return {
      ...task,
      dependencies: task.dependencies.filter((dep) => {
        if (dep.from !== dependency.from || dep.to !== dependency.to) return true;
        if (dependency.type !== undefined && dep.type !== dependency.type) return true;
        if (dependency.lag !== undefined && (dep.lag ?? 0) !== dependency.lag) return true;
        return false;
      }),
    };
  });
}

