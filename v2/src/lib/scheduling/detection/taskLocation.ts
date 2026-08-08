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
  /**
   * Índice de nombre por WBS ya construido. Opcional: quien resuelve una sola
   * tarea no tiene que saber que existe; quien recorre todo el cronograma lo
   * pasa para no reconstruirlo en cada tarea.
   */
  nameByWbs?: Map<string, string>,
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

  const breadcrumb = buildWbsBreadcrumb(task.wbs, tasks, nameByWbs);
  // Se hereda de hoja hacia arriba, pero **sin llegar al nivel raíz**: ese
  // nivel nombra la obra entera, no una ubicación dentro de ella. El archivo
  // real se llama «DA PORTO TORRE 3», así que heredar de la raíz ubicaba en
  // «Torre 3» hasta las vías internas y el skate park — una ubicación que
  // comparten todas las tareas no distingue nada, y además dejaba a Unidad
  // Típica con un único nivel.
  //
  // El tope se mide por la profundidad del WBS, no por la posición en el
  // breadcrumb: si la tarea raíz no está en el cronograma, el breadcrumb
  // arranca en un ancestro intermedio —«SOTANO 1»— que sí ubica y que sería
  // un error descartar.
  const rootWbs = task.wbs?.split(".").map((part) => part.trim()).filter(Boolean)[0];
  const rootExists =
    rootWbs != null &&
    (nameByWbs
      ? nameByWbs.has(rootWbs)
      : tasks.some((candidate) => candidate.wbs === rootWbs));
  const oldestLevel = rootExists ? 1 : 0;
  for (let level = breadcrumb.length - 1; level >= oldestLevel; level -= 1) {
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
