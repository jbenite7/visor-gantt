import type { GanttTask } from "@/components/gantt/types";
import type { DetectionDictionary } from "./dictionary";
import { resolveSystem, type SystemResolution } from "./cascade";
import { resolveTaskLocation, type TaskLocationResult } from "./taskLocation";

/**
 * Frontera del motor de detección.
 *
 * El grilleo decidió portar el motor a TypeScript «dejando preparada la
 * opción de llamarlo por API más adelante». Esto es esa preparación: todo el
 * producto consume la interfaz, nunca las funciones sueltas, así que el día
 * que exista un servicio solo hay que escribir otra implementación.
 *
 * No se escribe aquí ningún cliente HTTP: sin servicio desplegado sería
 * código que nadie puede probar.
 */
export interface DetectionProvider {
  readonly id: string;
  locationOf(
    task: GanttTask,
    tasks: GanttTask[],
    dictionary?: DetectionDictionary,
    nameByWbs?: Map<string, string>,
  ): TaskLocationResult;
  systemOf(input: {
    name: string;
    candidates: string[];
    dictionary?: DetectionDictionary;
    automatic?: () => string | null;
  }): SystemResolution;
}

export const localDetectionProvider: DetectionProvider = {
  id: "local",
  locationOf: (task, tasks, dictionary, nameByWbs) =>
    resolveTaskLocation(task, tasks, dictionary, nameByWbs),
  systemOf: (input) => resolveSystem(input),
};

let activeProvider: DetectionProvider = localDetectionProvider;

export function getDetectionProvider(): DetectionProvider {
  return activeProvider;
}

export function setDetectionProvider(provider: DetectionProvider): void {
  activeProvider = provider;
}
