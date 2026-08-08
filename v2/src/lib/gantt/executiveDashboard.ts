import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";
import {
  computeEarnedValueSCurve,
  diagnoseSCurve,
} from "@/lib/scheduling/scurve";

/** `unknown`: no hay con qué juzgar. Verde y «sin datos» no son lo mismo (M1). */
export type ExecutiveHealth = "good" | "warning" | "critical" | "unknown";
export type ExecutiveDimension = "schedule" | "cost" | "scope" | "progress";

export interface ExecutiveKpi {
  id: string;
  label: string;
  value: string;
  detail: string;
  health: ExecutiveHealth;
}

export interface ExecutiveSignal {
  /** A qué vista lleva este indicador cuando se pulsa (M1). */
  linkTo?: "bottlenecks" | "gantt" | "scurve" | "resources";
  dimension: ExecutiveDimension;
  health: ExecutiveHealth;
  title: string;
  detail: string;
  recommendation: string;
}

export interface ExecutivePlanningSummary {
  health: ExecutiveHealth;
  kpis: ExecutiveKpi[];
  signals: ExecutiveSignal[];
  /** Fecha de corte en ISO. Sin ella no se sabe a qué día son las cifras (M3). */
  statusDate?: string;
}

function healthRank(health: ExecutiveHealth): number {
  if (health === "critical") return 3;
  if (health === "warning") return 2;
  // «Sin datos» pesa más que «controlado»: no saber no es estar bien (M1).
  if (health === "unknown") return 1.5;
  return 1;
}

function worstHealth(values: ExecutiveHealth[]): ExecutiveHealth {
  return values.reduce<ExecutiveHealth>(
    (worst, current) => (healthRank(current) > healthRank(worst) ? current : worst),
    "good",
  );
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function averageProgress(tasks: GanttTask[]): number {
  const operational = tasks.filter((task) => !task.isSummary);
  if (operational.length === 0) return 0;
  const weightedDuration = operational.reduce((sum, task) => sum + Math.max(1, task.duration), 0);
  return operational.reduce(
    (sum, task) => sum + (task.percentComplete ?? task.progress ?? 0) * Math.max(1, task.duration),
    0,
  ) / weightedDuration;
}

function countMappedTasks(mappings: BudgetMapping[]): Set<string | number> {
  return new Set(mappings.map((mapping) => mapping.taskId));
}

export function buildExecutivePlanningSummary({
  tasks,
  budgetItems,
  budgetMappings,
  scheduleIssues,
  bottlenecks,
  statusDate,
}: {
  tasks: GanttTask[];
  budgetItems: BudgetItem[];
  budgetMappings: BudgetMapping[];
  scheduleIssues: ScheduleIssue[];
  bottlenecks: Bottleneck[];
  /** Fecha de corte en ISO: sin ella no se sabe a qué día son las cifras (M3). */
  statusDate?: string;
}): ExecutivePlanningSummary {
  const operationalTasks = tasks.filter((task) => !task.isSummary && !task.isMilestone);
  const criticalTasks = tasks.filter((task) => task.isCritical);
  const mappedTaskIds = countMappedTasks(budgetMappings);
  const mappedOperationalCount = operationalTasks.filter((task) => mappedTaskIds.has(task.id)).length;
  const totalBudget = budgetMappings.reduce((sum, mapping) => sum + mapping.amount, 0);
  const actualCost = budgetItems.reduce((sum, item) => sum + item.spentAmount, 0);
  const progress = averageProgress(tasks);
  const ev = computeEarnedValueSCurve(tasks, budgetMappings, budgetItems);
  const scurveDiagnostics = diagnoseSCurve(tasks, budgetMappings, budgetItems);
  const highBottlenecks = bottlenecks.filter((item) => item.severity === "high").length;
  const highIssues = scheduleIssues.filter((item) => item.severity === "high").length;
  const budgetCoverage = operationalTasks.length > 0
    ? (mappedOperationalCount / operationalTasks.length) * 100
    : 100;

  /**
   * Sin tareas o sin presupuesto vinculado no hay SPI ni CPI: el semáforo dice
   * «aún no hay datos» en vez de verde, que es lo que hacía antes (M1).
   */
  const sinDatos = tasks.length === 0;

  const scheduleHealth: ExecutiveHealth = sinDatos
    ? "unknown"
    : highIssues > 0 || (ev.spi !== null && ev.spi < 0.75)
      ? "critical"
      : highBottlenecks > 0 || (ev.spi !== null && ev.spi < 0.9)
        ? "warning"
        : "good";
  const costHealth: ExecutiveHealth = sinDatos
    ? "unknown"
    : (ev.cpi !== null && ev.cpi < 0.75) || actualCost > totalBudget * 1.1
      ? "critical"
      : (ev.cpi !== null && ev.cpi < 0.9) || actualCost > totalBudget
        ? "warning"
        : "good";
  const scopeHealth: ExecutiveHealth = sinDatos
    ? "unknown"
    : budgetCoverage < 60
      ? "critical"
      : budgetCoverage < 85
        ? "warning"
        : "good";
  /** El avance también llega a crítico, como cronograma y costo (M8). */
  const progressHealth: ExecutiveHealth = sinDatos
    ? "unknown"
    : progress < 25 && ev.spi !== null && ev.spi < 0.75
      ? "critical"
      : progress < 50 && ev.spi !== null && ev.spi < 0.9
        ? "warning"
        : "good";

  const signals: ExecutiveSignal[] = [
    {
      dimension: "schedule",
      linkTo: "bottlenecks",
      health: scheduleHealth,
      title: "Cronograma",
      detail: `${criticalTasks.length} tareas críticas · ${highBottlenecks} cuellos altos · SPI ${ev.spi?.toFixed(2) ?? "sin datos"}`,
      recommendation:
        scheduleHealth === "good"
          ? "Mantener seguimiento de ruta critica y holguras bajas."
          : "Priorizar restricciones de ruta critica y compromisos de recuperacion.",
    },
    {
      dimension: "cost",
      linkTo: "scurve",
      health: costHealth,
      title: "Costo",
      detail: `${formatMoney(actualCost)} real / ${formatMoney(totalBudget)} presupuesto · CPI ${ev.cpi?.toFixed(2) ?? "sin datos"}`,
      recommendation:
        costHealth === "good"
          ? "Mantener control de gasto contra avance ganado."
          : "Revisar partidas con consumo alto frente al avance fisico.",
    },
    {
      dimension: "scope",
      linkTo: "resources",
      health: scopeHealth,
      title: "Alcance",
      detail: `${formatPercent(budgetCoverage)} de tareas operativas con presupuesto mapeado.`,
      recommendation:
        scopeHealth === "good"
          ? "La cobertura permite conectar alcance con costo y avance."
          : "Completar mapeo de presupuesto para no tomar decisiones con alcance parcial.",
    },
    {
      dimension: "progress",
      linkTo: "gantt",
      health: progressHealth,
      title: "Avance",
      detail: `${formatPercent(progress)} promedio ponderado · ${scurveDiagnostics.length} alertas de Curva S.`,
      recommendation:
        progressHealth === "good"
          ? "Mantener cortes de avance consistentes."
          : "Actualizar avance fisico y validar tendencia de recuperacion.",
    },
  ];

  return {
    health: worstHealth(signals.map((signal) => signal.health)),
    statusDate,
    kpis: [
      {
        id: "tasks",
        label: "Tareas",
        value: String(tasks.length),
        detail: `${criticalTasks.length} criticas`,
        health: scheduleHealth,
      },
      {
        id: "progress",
        label: "Avance",
        value: formatPercent(progress),
        detail: `SPI ${ev.spi?.toFixed(2) ?? "sin datos"}`,
        health: progressHealth,
      },
      {
        id: "cost",
        label: "Costo real",
        value: formatMoney(actualCost),
        detail: `CPI ${ev.cpi?.toFixed(2) ?? "sin datos"}`,
        health: costHealth,
      },
      {
        id: "scope",
        label: "Cobertura alcance",
        value: formatPercent(budgetCoverage),
        detail: `${mappedOperationalCount}/${operationalTasks.length} tareas`,
        health: scopeHealth,
      },
    ],
    signals,
  };
}
