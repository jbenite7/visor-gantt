import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import { validateDependencies } from "@/lib/scheduling/scheduleEngine";
import { addPredecessor, removeDependency } from "@/lib/gantt/dependencyEditing";

/**
 * Resolución de una dependencia dibujada en el Diagrama de Red.
 *
 * No hay validación propia: el rechazo de ciclos sale de `validateDependencies`
 * (`src/lib/scheduling/scheduleEngine.ts`), la misma función que corre el
 * recálculo cuando la dependencia se crea desde la tabla. Si hubiera dos
 * fuentes de verdad, el diagrama y la tabla podrían discrepar.
 */

export type DependencyDraftRejection =
  | "mismaTarea"
  | "tareaInexistente"
  | "duplicada"
  | "ciclo";

export interface DependencyDraftAccepted {
  ok: true;
  dependency: GanttDependency;
}

export interface DependencyDraftRejected {
  ok: false;
  reason: DependencyDraftRejection;
  /** Motivo en lenguaje de obra, para mostrarlo donde el usuario está mirando. */
  message: string;
}

export type DependencyDraftResult =
  | DependencyDraftAccepted
  | DependencyDraftRejected;

export function resolveDependencyDraft(
  tasks: GanttTask[],
  fromId: string | number,
  toId: string | number,
  type: GanttDependency["type"] = "FS",
): DependencyDraftResult {
  if (fromId === toId) {
    return {
      ok: false,
      reason: "mismaTarea",
      message: "Una actividad no puede depender de sí misma.",
    };
  }

  const from = tasks.find((task) => task.id === fromId);
  const to = tasks.find((task) => task.id === toId);
  if (!from || !to) {
    return {
      ok: false,
      reason: "tareaInexistente",
      message: "Una de las dos actividades ya no está en el cronograma.",
    };
  }

  const alreadyDrawn = to.dependencies.some(
    (dep) => dep.from === fromId && dep.to === toId && dep.type === type,
  );
  if (alreadyDrawn) {
    return {
      ok: false,
      reason: "duplicada",
      message: "Esa dependencia ya está dibujada.",
    };
  }

  const dependency: GanttDependency = { from: fromId, to: toId, type };
  const issues = validateDependencies(addPredecessor(tasks, toId, dependency));
  if (issues.some((issue) => issue.kind === "cycle")) {
    return {
      ok: false,
      reason: "ciclo",
      message:
        "Esa flecha cerraría un ciclo: la actividad terminaría dependiendo de sí misma.",
    };
  }

  return { ok: true, dependency };
}

/** Predecesoras que le quedan a la sucesora tras borrar una flecha. */
export function dependenciesAfterRemoval(
  tasks: GanttTask[],
  dependency: Pick<GanttDependency, "from" | "to">,
): GanttDependency[] {
  const next = removeDependency(tasks, dependency);
  return next.find((task) => task.id === dependency.to)?.dependencies ?? [];
}
