import type { GanttTask } from "@/components/gantt/types";
import { formatLocationLabel, resolveTaskLocation } from "@/lib/scheduling/detection";
import { UNIT_PATTERNS } from "@/lib/scheduling/unitPatterns";
import type { MatrixCell, MatrixPlan } from "@/types/matrix";

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

/**
 * El nombre de la actividad sin su ubicación: «Mampostería piso 3» → «Mampostería».
 *
 * La limpieza **se deriva de los patrones del motor** (`UNIT_PATTERNS`, que
 * salen de `LOCATION_PATTERNS`), igual que hace `systemName` en
 * `typicalUnit.ts`. Mantener aquí una segunda lista de palabras de obra ya
 * había fallado: el motor reconoce «bloque», «apartamento», «lote» o
 * «manzana», y la lista escrita a mano no, así que «Mampostería bloque 1/2/3»
 * daba tres alcances distintos y cero recetas. Derivándola, cada palabra que
 * el motor aprenda la aprende también esta función.
 */
function scopeNameOf(taskName: string): string {
  let stripped = taskName;
  for (const pattern of UNIT_PATTERNS) {
    stripped = stripped.replace(new RegExp(pattern.regex.source, "gi"), "");
  }
  const cleaned = stripped.replace(/\s{2,}/g, " ").trim();
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
    // El nombre lo pone el motor, no esta función: `raw` viene normalizado en
    // mayúsculas, así que componerlo a mano sacaba «Piso CUBIERTA» y «Piso
    // MEZANINE». `formatLocationLabel` ya resuelve esos casos.
    const locationName = isGeneral
      ? "Obra general"
      : formatLocationLabel(resolved.location!);
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

    const scopeName = scopeNameOf(task.name);
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
    // La obra general es un cajón de sastre, no una ubicación más: dejarla
    // contar permitía que dos pisos y una tarea suelta alcanzaran el umbral y
    // se propusiera una receta donde no hay repetición real.
    const realLocationIds = [...scope.locations].filter(
      (locationId) => locationId !== GENERAL_LOCATION_ID,
    );
    if (realLocationIds.length < MIN_LOCATIONS_FOR_RECIPE) continue;

    const perLocation = realLocationIds.map((locationId) =>
      median(scope.durations.get(locationId)!),
    );
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
          observedIn: realLocationIds.length,
        },
      ],
      confidence: Math.min(1, realLocationIds.length / 10),
      evidence: `«${scope.name}» aparece en ${realLocationIds.length} ubicaciones, con ${medianDurationDays} días de mediana.`,
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

export interface ProposalAcceptance {
  locationIds: string[];
  scopeIds: string[];
  recipeIds: string[];
}

/**
 * Convierte en plan lo que el usuario aceptó de la propuesta.
 *
 * Es un paso aparte a propósito: la propuesta se revisa, el plan se construye.
 * Un alcance aceptado sin su receta entra igualmente, con sus celdas
 * inactivas, para que el usuario complete la receta en el editor en vez de
 * perder el alcance.
 */
export function planFromProposal(
  proposal: MatrixProposal,
  acceptance: ProposalAcceptance,
  input: { id: string; name: string; startDate: string; editedAt: string },
): MatrixPlan {
  const acceptedLocations = new Set(acceptance.locationIds);
  const acceptedScopes = new Set(acceptance.scopeIds);
  const acceptedRecipes = new Set(acceptance.recipeIds);

  const areas = proposal.locations
    .filter((location) => acceptedLocations.has(location.id))
    .map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
    }));

  const recipes = proposal.recipes
    .filter((recipe) => acceptedRecipes.has(recipe.id))
    .map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      activities: recipe.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        // Con cantidad 1, el rendimiento es el inverso de la duración
        // mediana: es la forma honesta de decir «esto tardó esto» mientras
        // no haya cantidades de obra medidas.
        productivityPerDay: 1 / Math.max(1, activity.medianDurationDays),
        defaultQuantity: 1,
      })),
      dependencies: [],
    }));

  const recipeByScopeId = new Map(
    proposal.recipes
      .filter((recipe) => acceptedRecipes.has(recipe.id))
      .map((recipe) => [recipe.scopeId, recipe.id]),
  );

  const scopeTree = proposal.scopes
    .filter((scope) => acceptedScopes.has(scope.id))
    .map((scope) => ({
      id: scope.id,
      name: scope.name,
      type: "Disciplina",
      defaultRecipeId: recipeByScopeId.get(scope.id),
    }));

  const cells: MatrixCell[] = scopeTree.flatMap((scope) =>
    areas.map((area) => ({
      id: `cell-${scope.id}-${area.id}`,
      scopeId: scope.id,
      areaId: area.id,
      recipeId: scope.defaultRecipeId,
      active: scope.defaultRecipeId !== undefined,
      lastEditedAt: input.editedAt,
      lastEditedFrom: "matrix" as const,
    })),
  );

  return {
    id: input.id,
    name: input.name,
    startDate: input.startDate,
    scopeTree,
    areas,
    recipes,
    cells,
  };
}
