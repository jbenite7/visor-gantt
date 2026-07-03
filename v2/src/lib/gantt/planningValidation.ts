import type { GanttTask } from "@/components/gantt/types";
import { validateDependencies } from "@/lib/scheduling/scheduleEngine";
import type { ScheduleIssue } from "@/lib/scheduling/types";

export type PlanningIssueKind =
  | ScheduleIssue["kind"]
  | "outlineJump"
  | "wbsMismatch"
  | "summaryWithoutChildren"
  | "invalidProgress"
  | "invalidDuration";

export interface PlanningIssue {
  kind: PlanningIssueKind;
  severity: ScheduleIssue["severity"];
  taskIds: Array<string | number>;
  message: string;
  recommendation?: string;
}
function expectedWbs(counters: number[], level: number): string {
  return counters.slice(0, level).join(".");
}

export function validatePlanningState(tasks: GanttTask[]): PlanningIssue[] {
  const dependencyIssues = validateDependencies(tasks).map((issue) => ({
    ...issue,
    recommendation:
      issue.kind === "cycle"
        ? "Elimina o cambia al menos una dependencia para romper el ciclo."
        : issue.kind === "selfDependency"
          ? "Selecciona una tarea diferente como predecesora o sucesora."
          : "Verifica que ambas tareas existan y sigan activas.",
  }));
  const issues: PlanningIssue[] = [...dependencyIssues];
  const counters: number[] = [];

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const level = Math.max(1, task.outlineLevel);
    const previousLevel = index === 0 ? 1 : Math.max(1, tasks[index - 1].outlineLevel);

    if (index === 0 && level !== 1) {
      issues.push({
        kind: "outlineJump",
        severity: "medium",
        taskIds: [task.id],
        message: `La primera tarea debe iniciar en nivel 1, no en nivel ${level}.`,
        recommendation: "Baja el nivel de la primera tarea antes de recalcular la EDT.",
      });
    } else if (index > 0 && level > previousLevel + 1) {
      issues.push({
        kind: "outlineJump",
        severity: "medium",
        taskIds: [task.id],
        message: `La tarea ${task.id} salta de nivel ${previousLevel} a nivel ${level}.`,
        recommendation: "Ajusta la jerarquia para que cada tarea solo baje un nivel frente a la anterior.",
      });
    }

    counters.length = level;
    counters[level - 1] = (counters[level - 1] ?? 0) + 1;
    for (let i = 0; i < level - 1; i += 1) {
      counters[i] = counters[i] ?? 1;
    }

    const wbs = expectedWbs(counters, level);
    if (task.wbs && task.wbs !== wbs) {
      issues.push({
        kind: "wbsMismatch",
        severity: "low",
        taskIds: [task.id],
        message: `La EDT de la tarea ${task.id} es ${task.wbs}, pero deberia ser ${wbs}.`,
        recommendation: "Recalcula la EDT despues de mover o cambiar nivel de tareas.",
      });
    }

    const next = tasks[index + 1];
    if (task.isSummary && (!next || next.outlineLevel <= level)) {
      issues.push({
        kind: "summaryWithoutChildren",
        severity: "medium",
        taskIds: [task.id],
        message: `La tarea resumen ${task.id} no tiene hijos debajo.`,
        recommendation: "Agrega tareas hijas o conviertela en tarea normal.",
      });
    }

    const progress = task.percentComplete ?? task.progress;
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      issues.push({
        kind: "invalidProgress",
        severity: "medium",
        taskIds: [task.id],
        message: `El avance de la tarea ${task.id} debe estar entre 0 y 100.`,
        recommendation: "Corrige el porcentaje completado antes de guardar.",
      });
    }

    if (!Number.isFinite(task.duration) || task.duration < 0) {
      issues.push({
        kind: "invalidDuration",
        severity: "medium",
        taskIds: [task.id],
        message: `La duracion de la tarea ${task.id} no puede ser negativa.`,
        recommendation: "Usa cero solo para hitos y valores positivos para tareas.",
      });
    }
  }

  return issues;
}
