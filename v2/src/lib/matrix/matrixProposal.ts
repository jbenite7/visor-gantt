import type { GanttTask } from "@/components/gantt/types";
import { resolveTaskLocation } from "@/lib/scheduling/detection";

/**
 * Propuesta de matriz a partir de un cronograma cargado.
 *
 * No es un `MatrixPlan`: es lo que el usuario revisa antes de que se
 * construya nada. Cada elemento lleva su evidencia en lenguaje de obra, para
 * que aceptarlo sea una decisión y no un acto de fe. Si el cronograma no
 * repite nada, la propuesta sale vacía y lo dice, en vez de inventar una
 * matriz que nadie pidió.
 */
export interface ProposedLocation {
  id: string;
  name: string;
  type: string;
  /** Número ordenable. La obra general va al final. */
  order: number;
  taskCount: number;
  evidence: string;
}

export interface ProposedScope {
  id: string;
  name: string;
  locationIds: string[];
  evidence: string;
}

export interface ProposedActivity {
  id: string;
  name: string;
  medianDurationDays: number;
  observedIn: number;
}

export interface ProposedRecipe {
  id: string;
  scopeId: string;
  name: string;
  activities: ProposedActivity[];
  confidence: number;
  evidence: string;
}

export interface MatrixProposal {
  locations: ProposedLocation[];
  scopes: ProposedScope[];
  recipes: ProposedRecipe[];
  skippedTaskCount: number;
  summary: string;
}

/** El mismo mínimo que usa Unidad Típica: por debajo no hay patrón, hay coincidencia. */
export const MIN_LOCATIONS_FOR_RECIPE = 3;

const GENERAL_LOCATION_ID = "obra-general";

function sanitizeId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/** El nombre de la actividad sin su ubicación: «Mampostería piso 3» → «Mampostería». */
function scopeNameOf(taskName: string, locationRaw: string | null): string {
  if (!locationRaw) return taskName.trim();
  const cleaned = taskName
    .replace(
      new RegExp(
        `\\s*(piso|nivel|planta|sotano|sótano|torre|zona|sector|tramo|etapa)\\s*[-#:]?\\s*${locationRaw}\\b`,
        "iu",
      ),
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || taskName.trim();
}

export function proposeMatrixFromTasks(tasks: GanttTask[]): MatrixProposal {
  const operational = tasks.filter((task) => !task.isSummary && !task.isMilestone);

  const locationsById = new Map<string, ProposedLocation>();
  const scopesById = new Map<
    string,
    { name: string; locations: Set<string>; durations: Map<string, number[]> }
  >();

  for (const task of operational) {
    const resolved = resolveTaskLocation(task, tasks);
    const isGeneral = resolved.location === null;
    const locationName = isGeneral
      ? "Obra general"
      : `${resolved.location!.label} ${resolved.location!.raw}`;
    const locationId = isGeneral ? GENERAL_LOCATION_ID : sanitizeId(locationName);

    const existing = locationsById.get(locationId);
    if (existing) {
      existing.taskCount += 1;
    } else {
      locationsById.set(locationId, {
        id: locationId,
        name: locationName,
        type: isGeneral ? "Obra general" : resolved.location!.label,
        order: isGeneral ? Infinity : resolved.location!.value,
        taskCount: 1,
        evidence: "",
      });
    }

    const scopeName = scopeNameOf(task.name, isGeneral ? null : resolved.location!.raw);
    const scopeId = sanitizeId(scopeName);
    const scope = scopesById.get(scopeId) ?? {
      name: scopeName,
      locations: new Set<string>(),
      durations: new Map<string, number[]>(),
    };
    scope.locations.add(locationId);
    const durations = scope.durations.get(locationId) ?? [];
    durations.push(Math.max(1, task.duration));
    scope.durations.set(locationId, durations);
    scopesById.set(scopeId, scope);
  }

  const locations = [...locationsById.values()]
    .sort((a, b) => a.order - b.order)
    .map((location) => ({
      ...location,
      evidence: `«${location.name}» aparece en ${location.taskCount} tareas del cronograma.`,
    }));

  const scopes: ProposedScope[] = [...scopesById.entries()].map(([id, scope]) => ({
    id,
    name: scope.name,
    locationIds: [...scope.locations],
    evidence: `«${scope.name}» se programa en ${scope.locations.size} ubicaciones.`,
  }));

  const recipes: ProposedRecipe[] = [];
  for (const [scopeId, scope] of scopesById) {
    if (scope.locations.size < MIN_LOCATIONS_FOR_RECIPE) continue;

    const perLocation = [...scope.durations.values()].map((values) => median(values));
    const medianDurationDays = median(perLocation);

    recipes.push({
      id: `receta-${scopeId}`,
      scopeId,
      name: scope.name,
      activities: [
        {
          id: `actividad-${scopeId}`,
          name: scope.name,
          medianDurationDays,
          observedIn: scope.locations.size,
        },
      ],
      confidence: Math.min(1, scope.locations.size / 10),
      evidence: `«${scope.name}» aparece en ${scope.locations.size} ubicaciones, con ${medianDurationDays} días de mediana.`,
    });
  }

  return {
    locations,
    scopes,
    recipes,
    skippedTaskCount: tasks.length - operational.length,
    summary:
      recipes.length === 0
        ? "Este cronograma no repite ninguna actividad en tres o más ubicaciones, así que no hay recetas que proponer."
        : `Se proponen ${locations.length} ubicaciones, ${scopes.length} alcances y ${recipes.length} recetas a partir de ${operational.length} tareas.`,
  };
}
