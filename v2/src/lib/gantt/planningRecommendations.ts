import type { GanttTask } from "@/components/gantt/types";
import { validatePlanningState, type PlanningIssue } from "./planningValidation";

export type PlanningRecommendationKind =
  | PlanningIssue["kind"]
  | "missingPredecessor"
  | "criticalOpenEnd"
  | "dependencyConvergence"
  | "resourceOverlap"
  | "deadlineMissed"
  | "constraintViolated"
  | "baselineSlip";

export interface PlanningRecommendation {
  id: string;
  kind: PlanningRecommendationKind;
  severity: "low" | "medium" | "high";
  taskIds: Array<string | number>;
  title: string;
  detail: string;
  action: string;
  priority: number;
}

const SEVERITY_WEIGHT: Record<PlanningRecommendation["severity"], number> = {
  high: 300,
  medium: 200,
  low: 100,
};

function recommendationId(kind: PlanningRecommendationKind, taskIds: Array<string | number>): string {
  return `${kind}:${taskIds.map(String).join(",")}`;
}

function fromIssue(issue: PlanningIssue): PlanningRecommendation {
  return {
    id: recommendationId(issue.kind, issue.taskIds),
    kind: issue.kind,
    severity: issue.severity,
    taskIds: issue.taskIds,
    title: issue.message,
    detail: issue.recommendation ?? "Revisa este punto antes de confirmar cambios en el cronograma.",
    action: issue.recommendation ?? "Revisar",
    priority: SEVERITY_WEIGHT[issue.severity],
  };
}

function hasSuccessor(tasks: GanttTask[], taskId: string | number): boolean {
  return tasks.some((task) => task.dependencies.some((dep) => dep.from === taskId));
}

function isOperationalTask(task: GanttTask): boolean {
  return !task.isSummary && !task.isMilestone;
}

function dateOnlyTime(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function tasksOverlap(first: GanttTask, second: GanttTask): boolean {
  return dateOnlyTime(first.start) <= dateOnlyTime(second.finish)
    && dateOnlyTime(second.start) <= dateOnlyTime(first.finish);
}

function normalizedResourceNames(task: GanttTask): string[] {
  return [...new Set(
    (task.resourceNames ?? [])
      .map((name) => name.trim())
      .filter(Boolean),
  )];
}

function constraintViolation(task: GanttTask): { label: string; days: number } | undefined {
  if (!task.constraintType || !task.constraintDate) return undefined;
  const constraintTime = dateOnlyTime(task.constraintDate);

  if (
    (task.constraintType === "startNoLaterThan" || task.constraintType === "mustStartOn") &&
    dateOnlyTime(task.start) > constraintTime
  ) {
    return {
      label: task.constraintType === "mustStartOn" ? "Debe comenzar el" : "Comenzar no mas tarde de",
      days: Math.max(1, Math.round((dateOnlyTime(task.start) - constraintTime) / (24 * 60 * 60 * 1000))),
    };
  }

  if (
    (task.constraintType === "finishNoLaterThan" || task.constraintType === "mustFinishOn") &&
    dateOnlyTime(task.finish) > constraintTime
  ) {
    return {
      label: task.constraintType === "mustFinishOn" ? "Debe finalizar el" : "Finalizar no mas tarde de",
      days: Math.max(1, Math.round((dateOnlyTime(task.finish) - constraintTime) / (24 * 60 * 60 * 1000))),
    };
  }

  return undefined;
}

export function buildPlanningRecommendations(tasks: GanttTask[]): PlanningRecommendation[] {
  const recommendations = new Map<string, PlanningRecommendation>();

  for (const issue of validatePlanningState(tasks)) {
    const recommendation = fromIssue(issue);
    recommendations.set(recommendation.id, recommendation);
  }

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (!isOperationalTask(task)) continue;

    if (index > 0 && task.dependencies.length === 0 && !task.manualStart) {
      const recommendation: PlanningRecommendation = {
        id: recommendationId("missingPredecessor", [task.id]),
        kind: "missingPredecessor",
        severity: "medium",
        taskIds: [task.id],
        title: `${task.name} no tiene predecesoras.`,
        detail: "Una actividad sin predecesoras puede quedar desconectada de la logica real de obra.",
        action: "Agrega una predecesora o confirma que la tarea debe iniciar libremente.",
        priority: SEVERITY_WEIGHT.medium + 20,
      };
      recommendations.set(recommendation.id, recommendation);
    }

    if (task.dependencies.length >= 3 && (task.totalFloat ?? Number.POSITIVE_INFINITY) <= 0) {
      const recommendation: PlanningRecommendation = {
        id: recommendationId("dependencyConvergence", [task.id, ...task.dependencies.map((dep) => dep.from)]),
        kind: "dependencyConvergence",
        severity: "high",
        taskIds: [task.id, ...task.dependencies.map((dep) => dep.from)],
        title: `${task.name} concentra ${task.dependencies.length} predecesoras en ruta critica.`,
        detail: "Las convergencias criticas son puntos probables de espera, reprogramacion o interferencia.",
        action: "Revisa lags, restricciones y responsables antes de aprobar la secuencia.",
        priority: SEVERITY_WEIGHT.high + 40,
      };
      recommendations.set(recommendation.id, recommendation);
    }

    if (task.isCritical && !hasSuccessor(tasks, task.id) && index < tasks.length - 1) {
      const recommendation: PlanningRecommendation = {
        id: recommendationId("criticalOpenEnd", [task.id]),
        kind: "criticalOpenEnd",
        severity: "medium",
        taskIds: [task.id],
        title: `${task.name} es critica pero no tiene sucesoras.`,
        detail: "Una tarea critica sin sucesora puede indicar un fin abierto o una relacion faltante.",
        action: "Conecta la sucesora real o marca esta tarea como cierre de cadena.",
        priority: SEVERITY_WEIGHT.medium + 30,
      };
      recommendations.set(recommendation.id, recommendation);
    }

    if (task.deadline && dateOnlyTime(task.finish) > dateOnlyTime(task.deadline)) {
      const daysLate = Math.max(
        1,
        Math.round((dateOnlyTime(task.finish) - dateOnlyTime(task.deadline)) / (24 * 60 * 60 * 1000)),
      );
      const severity: PlanningRecommendation["severity"] = task.isCritical ? "high" : "medium";
      const recommendation: PlanningRecommendation = {
        id: recommendationId("deadlineMissed", [task.id]),
        kind: "deadlineMissed",
        severity,
        taskIds: [task.id],
        title: `${task.name} supera su fecha limite por ${daysLate}d.`,
        detail: "La fecha limite importada desde MS Project queda antes del fin calculado actual.",
        action: "Revisa ruta critica, restricciones o recuperacion antes de confirmar el cronograma.",
        priority: SEVERITY_WEIGHT[severity] + 35,
      };
      recommendations.set(recommendation.id, recommendation);
    }

    const violatedConstraint = constraintViolation(task);
    if (violatedConstraint) {
      const severity: PlanningRecommendation["severity"] = task.isCritical ? "high" : "medium";
      const recommendation: PlanningRecommendation = {
        id: recommendationId("constraintViolated", [task.id]),
        kind: "constraintViolated",
        severity,
        taskIds: [task.id],
        title: `${task.name} viola restriccion MPP por ${violatedConstraint.days}d.`,
        detail: `${violatedConstraint.label} queda antes de la fecha calculada actual.`,
        action: "Revisa dependencias, lags o restricciones antes de aceptar el CPM recalculado.",
        priority: SEVERITY_WEIGHT[severity] + 45,
      };
      recommendations.set(recommendation.id, recommendation);
    }

    if (task.baselineFinish && dateOnlyTime(task.finish) > dateOnlyTime(task.baselineFinish)) {
      const daysLate = Math.max(
        1,
        Math.round((dateOnlyTime(task.finish) - dateOnlyTime(task.baselineFinish)) / (24 * 60 * 60 * 1000)),
      );
      const severity: PlanningRecommendation["severity"] = task.isCritical ? "high" : "medium";
      const recommendation: PlanningRecommendation = {
        id: recommendationId("baselineSlip", [task.id]),
        kind: "baselineSlip",
        severity,
        taskIds: [task.id],
        title: `${task.name} se desvía ${daysLate}d frente a la línea base.`,
        detail: "El fin calculado actual queda despues del fin comprometido en baseline.",
        action: "Evalua recuperacion, reasignacion o re-baseline formal antes de reportar avance.",
        priority: SEVERITY_WEIGHT[severity] + 30,
      };
      recommendations.set(recommendation.id, recommendation);
    }
  }

  const resourceTasks = new Map<string, GanttTask[]>();
  for (const task of tasks) {
    if (!isOperationalTask(task)) continue;
    for (const resourceName of normalizedResourceNames(task)) {
      const existing = resourceTasks.get(resourceName) ?? [];
      existing.push(task);
      resourceTasks.set(resourceName, existing);
    }
  }

  for (const [resourceName, assignedTasks] of resourceTasks) {
    for (let i = 0; i < assignedTasks.length; i += 1) {
      for (let j = i + 1; j < assignedTasks.length; j += 1) {
        const first = assignedTasks[i];
        const second = assignedTasks[j];
        if (!tasksOverlap(first, second)) continue;
        const severity: PlanningRecommendation["severity"] =
          first.isCritical || second.isCritical ? "high" : "medium";
        const recommendation: PlanningRecommendation = {
          id: recommendationId("resourceOverlap", [first.id, second.id, resourceName]),
          kind: "resourceOverlap",
          severity,
          taskIds: [first.id, second.id],
          title: `${resourceName} esta asignado en tareas solapadas.`,
          detail: `${first.name} y ${second.name} comparten fechas con el mismo recurso o cuadrilla.`,
          action: "Revisa capacidad, turnos o secuencia antes de aprobar el plan.",
          priority: SEVERITY_WEIGHT[severity] + 25,
        };
        recommendations.set(recommendation.id, recommendation);
      }
    }
  }

  return [...recommendations.values()].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.title.localeCompare(b.title);
  });
}
