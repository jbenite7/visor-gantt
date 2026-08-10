import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import { validateDependencies } from "@/lib/scheduling/scheduleEngine";
import { removeDependency } from "@/lib/gantt/dependencyEditing";

/**
 * Resolución de una dependencia dibujada en el Diagrama de Red.
 *
 * No hay validación propia para "misma tarea", "tarea inexistente" ni
 * "ciclo": las tres salen de una única llamada a `validateDependencies`
 * (`src/lib/scheduling/scheduleEngine.ts`), la misma función que corre el
 * recálculo cuando la dependencia se crea desde la tabla. Si hubiera dos
 * fuentes de verdad, el diagrama y la tabla podrían discrepar — de hecho ya
 * había pasado con la redacción del mensaje de "misma tarea" antes de este
 * refactor. Los mensajes que ve el usuario aquí siguen siendo propios (en
 * lenguaje de obra), solo la decisión de aceptar o rechazar se comparte.
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
  const dependency: GanttDependency = { from: fromId, to: toId, type };

  // Un único estado hipotético (las dependencias actuales más la flecha que
  // se está dibujando) y una única llamada a `validateDependencies`: de ahí
  // salen "misma tarea", "tarea inexistente" y "ciclo". El orden de los
  // `if` de abajo es el de precedencia: si varios motivos aplican a la vez,
  // gana el más específico para el usuario.
  const hypotheticalDependencies = [...tasks.flatMap((task) => task.dependencies), dependency];
  const issues = validateDependencies(tasks, hypotheticalDependencies);

  if (issues.some((issue) => issue.kind === "selfDependency")) {
    return {
      ok: false,
      reason: "mismaTarea",
      message: "Una actividad no puede depender de sí misma.",
    };
  }

  if (issues.some((issue) => issue.kind === "missingTask")) {
    return {
      ok: false,
      reason: "tareaInexistente",
      message: "Una de las dos actividades ya no está en el cronograma.",
    };
  }

  // La duplicidad exacta no tiene equivalente en `validateDependencies`: esa
  // función valida un cronograma completo, no si "esta flecha concreta ya
  // estaba dibujada". Es la única comprobación que se queda en esta capa.
  const to = tasks.find((task) => task.id === toId);
  const alreadyDrawn = to?.dependencies.some(
    (dep) => dep.from === fromId && dep.to === toId && dep.type === type,
  );
  if (alreadyDrawn) {
    return {
      ok: false,
      reason: "duplicada",
      message: "Esa dependencia ya está dibujada.",
    };
  }

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
