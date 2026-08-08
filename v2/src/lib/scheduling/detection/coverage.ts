import type { GanttTask } from "@/components/gantt/types";
import type { DetectionDictionary } from "./dictionary";
import { getDetectionProvider } from "./provider";
import { buildWbsNameMap } from "@/lib/scheduling/unitPatterns";
import type { TaskLocationScope } from "./taskLocation";

/**
 * Lo que la Línea de Balance enseña como «195 de 239 tareas tienen ubicación
 * detectada», convertido en dato para que cualquier vista lo muestre igual y
 * para poder auditar cuánto está sosteniendo el diccionario.
 */
export interface DetectionCoverage {
  total: number;
  withLocation: number;
  generalWork: number;
  byScope: Record<TaskLocationScope, number>;
}

const EMPTY_BY_SCOPE: Record<TaskLocationScope, number> = {
  propia: 0,
  heredada: 0,
  wbs: 0,
  diccionario: 0,
  obraGeneral: 0,
};

export function summarizeDetection(
  tasks: GanttTask[],
  dictionary?: DetectionDictionary,
): DetectionCoverage {
  const provider = getDetectionProvider();
  const byScope: Record<TaskLocationScope, number> = { ...EMPTY_BY_SCOPE };
  let withLocation = 0;
  // Una sola vez para todo el cronograma: antes se reconstruía por tarea.
  const nameByWbs = buildWbsNameMap(tasks);

  for (const task of tasks) {
    const result = provider.locationOf(task, tasks, dictionary, nameByWbs);
    byScope[result.scope] += 1;
    if (result.location) withLocation += 1;
  }

  return {
    total: tasks.length,
    withLocation,
    generalWork: byScope.obraGeneral,
    byScope,
  };
}

export function describeCoverage(coverage: DetectionCoverage): string {
  if (coverage.total === 0) return "Aún no hay tareas que analizar.";
  return (
    `${coverage.withLocation} de ${coverage.total} tareas tienen ubicación detectada. ` +
    `${coverage.generalWork} son obra general, sin piso asignado.`
  );
}
