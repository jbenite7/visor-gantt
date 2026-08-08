import type { GanttTask } from "@/components/gantt/types";
import { buildWbsBreadcrumb } from "@/lib/scheduling/unitPatterns";
import { extractLocation, type LocationMatch } from "./location";
import { lookupCorrection, type DetectionDictionary } from "./dictionary";

/**
 * De dónde salió la ubicación de una tarea.
 *
 * `obraGeneral` no es un fallo: hay trabajo que no pertenece a ningún piso
 * —vías internas, redes externas, engramado— y decirlo es más útil que
 * descartarlo en silencio, que es lo que se hacía antes.
 */
export type TaskLocationScope =
  | "propia"
  | "heredada"
  | "wbs"
  | "diccionario"
  | "obraGeneral";

export interface TaskLocationResult {
  location: LocationMatch | null;
  scope: TaskLocationScope;
  evidence: string;
}

export function resolveTaskLocation(
  task: GanttTask,
  tasks: GanttTask[],
  dictionary?: DetectionDictionary,
): TaskLocationResult {
  const correction = lookupCorrection(dictionary, "ubicacion", task.name);
  if (correction) {
    const value = Number(correction.value);
    if (Number.isFinite(value)) {
      return {
        location: {
          label: value < 0 ? "Sótano" : "Piso",
          raw: correction.value,
          value,
        },
        scope: "diccionario",
        evidence: `«${task.name}» se ubica por una corrección guardada: ${correction.note}`,
      };
    }
  }

  const own = extractLocation(task.name);
  if (own) {
    return {
      location: own,
      scope: "propia",
      evidence: `«${task.name}» dice su ubicación: ${own.label} ${own.raw}.`,
    };
  }

  const breadcrumb = buildWbsBreadcrumb(task.wbs, tasks);
  for (let level = breadcrumb.length - 1; level >= 0; level -= 1) {
    const inherited = extractLocation(breadcrumb[level]);
    if (inherited) {
      return {
        location: inherited,
        scope: "heredada",
        evidence: `«${task.name}» hereda la ubicación de «${breadcrumb[level]}»: ${inherited.label} ${inherited.raw}.`,
      };
    }
  }

  const fromWbs = task.wbs ? extractLocation(task.wbs) : null;
  if (fromWbs) {
    return {
      location: fromWbs,
      scope: "wbs",
      evidence: `«${task.name}» toma la ubicación de su código ${task.wbs}: ${fromWbs.label} ${fromWbs.raw}.`,
    };
  }

  return {
    location: null,
    scope: "obraGeneral",
    evidence: `«${task.name}» no menciona piso, sótano ni zona: se trata como obra general.`,
  };
}
