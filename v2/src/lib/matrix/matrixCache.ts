import type { ActivityRecipe, AreaNode, MatrixCell, ScopeNode } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";

/**
 * Firma de una celda: todo lo que entra en el cálculo de sus tareas.
 *
 * Es la pieza delicada de la caché. Si falta un campo, la matriz enseña
 * fechas viejas y el usuario no tiene forma de saberlo. Por eso el test
 * recorre campo por campo comprobando que cada uno cambia la firma.
 */
export function cellSignature({
  cell,
  recipe,
  scope,
  area,
  scopeLeafIndex,
  areaLeafIndex,
  startDate,
  calendarKey,
}: {
  cell: MatrixCell;
  recipe: ActivityRecipe | undefined;
  /** El nombre entra en la firma porque `buildTaskName` lo usa para el nombre de la tarea. */
  scope?: ScopeNode;
  area?: AreaNode;
  /** El orden de los hermanos decide el desfase y el encadenado entre ubicaciones. */
  scopeLeafIndex?: number;
  areaLeafIndex?: number;
  startDate: string;
  calendarKey: string;
}): string {
  return JSON.stringify([
    cell.id,
    cell.scopeId,
    cell.areaId,
    cell.recipeId,
    cell.active,
    cell.quantity,
    cell.unit,
    cell.productivityOverridePerDay,
    cell.activityOverrides ?? null,
    recipe?.id,
    recipe?.activities,
    recipe?.dependencies,
    recipe?.lineOfBalance ?? null,
    recipe?.locationChaining ?? null,
    startDate,
    calendarKey,
    scope?.name,
    area?.name,
    scope?.locationChaining ?? null,
    scopeLeafIndex,
    areaLeafIndex,
  ]);
}

/** Clave estable del calendario, para que un festivo nuevo invalide la caché. */
export function calendarKeyOf(calendar?: ProjectCalendar): string {
  if (!calendar) return "sin-calendario";
  return JSON.stringify([
    calendar.workDays,
    calendar.startHour,
    calendar.endHour,
    calendar.hoursPerDay,
    calendar.nonWorkingDays,
    calendar.dateOverrides,
  ]);
}

export interface MatrixGenerationCache {
  signatures: Map<string, string>;
  hits: number;
  misses: number;
}

export function createMatrixCache(): MatrixGenerationCache {
  return { signatures: new Map(), hits: 0, misses: 0 };
}
