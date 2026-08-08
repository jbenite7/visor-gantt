import { Resource, Assignment } from "@/types/resource";
import { GanttTask } from "@/components/gantt/types";

export interface OverallocationResult {
  resourceId: number;
  resourceName: string;
  date: Date;
  totalUnits: number;
  maxAvailability: number;
  isOverallocated: boolean;
  assignedTasks: { taskId: string | number; taskName: string; units: number }[];
}

/**
 * Calculate the cost of a resource assignment.
 *
 * - Work resources: cost = (units% / 100) × rate × durationDays × 8
 * - Cost resources: fixed cost (rate)
 * - Material resources: cost = rate × units
 *
 * Returns 0 if rate is undefined.
 */
export function calculateAssignmentCost(
  assignment: Assignment,
  resource: Resource,
  taskDurationDays: number,
): number {
  if (resource.type === "cost") {
    return resource.rate ?? 0;
  }

  if (resource.type === "material") {
    return (resource.rate ?? 0) * assignment.units;
  }

  // Work resource
  return (assignment.units / 100) * (resource.rate ?? 0) * taskDurationDays * 8;
}

/**
 * Compute the total working hours for an assignment.
 *
 * hours = (units% / 100) × durationDays × 8
 *
 * Example: 50% allocation for 10 days = 0.5 × 10 × 8 = 40 hours
 */
export function computeResourceHours(
  assignment: Assignment,
  taskDurationDays: number,
): number {
  return (assignment.units / 100) * taskDurationDays * 8;
}

/**
 * Detect resource overallocation.
 *
 * A resource is overallocated if total assignment units on any calendar day
 * exceed the resource's availability (default 100%).
 *
 * This is a simplified check — it does not account for holidays or weekends.
 */
export function detectOverallocation(
  assignments: Assignment[],
  resources: Resource[],
  tasks: GanttTask[],
): OverallocationResult[] {
  const resourceMap = new Map<number, Resource>();
  for (const r of resources) {
    resourceMap.set(r.uid, r);
  }

  const taskMap = new Map<string | number, GanttTask>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  // Map key: "resourceId:YYYY-MM-DD"
  // Value: aggregated daily data for that resource+date
  const dailyData = new Map<
    string,
    {
      totalUnits: number;
      contributions: {
        taskId: string | number;
        taskName: string;
        units: number;
      }[];
    }
  >();

  for (const assignment of assignments) {
    const resource = resourceMap.get(assignment.resourceId);
    if (!resource) continue;

    const task = taskMap.get(assignment.taskId);
    if (!task) continue;

    const start = new Date(task.start);
    const end = new Date(task.finish);
    const current = new Date(start);

    while (current <= end) {
      const dateKey = [
        current.getFullYear(),
        String(current.getMonth() + 1).padStart(2, "0"),
        String(current.getDate()).padStart(2, "0"),
      ].join("-");
      const mapKey = `${assignment.resourceId}:${dateKey}`;

      let entry = dailyData.get(mapKey);
      if (!entry) {
        entry = { totalUnits: 0, contributions: [] };
        dailyData.set(mapKey, entry);
      }

      entry.totalUnits += assignment.units;
      entry.contributions.push({
        taskId: assignment.taskId,
        taskName: task.name,
        units: assignment.units,
      });

      current.setDate(current.getDate() + 1);
    }
  }

  const results: OverallocationResult[] = [];

  for (const [mapKey, entry] of dailyData) {
    const match = mapKey.match(/^(\d+):(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) continue;

    const resourceId = parseInt(match[1], 10);
    const resource = resourceMap.get(resourceId);
    if (!resource) continue;

    const maxAvailability = resource.availability ?? 100;
    if (entry.totalUnits <= maxAvailability) continue;

    const date = new Date(
      parseInt(match[2], 10),
      parseInt(match[3], 10) - 1,
      parseInt(match[4], 10),
    );

    results.push({
      resourceId,
      resourceName: resource.name,
      date,
      totalUnits: entry.totalUnits,
      maxAvailability,
      isOverallocated: true,
      assignedTasks: entry.contributions,
    });
  }

  return results;
}

/**
 * Get all assignments for a specific resource.
 */
export function getResourceAssignments(
  resourceId: number,
  assignments: Assignment[],
): Assignment[] {
  return assignments.filter((a) => a.resourceId === resourceId);
}

/**
 * Get all assignments for a specific task.
 */
export function getTaskAssignments(
  taskId: string | number,
  assignments: Assignment[],
): Assignment[] {
  return assignments.filter((a) => a.taskId === taskId);
}

/**
 * Create a new Assignment with calculated cost.
 *
 * If the task or resource is not found, defaults are used:
 * - Duration defaults to 1 day
 * - Resource defaults to a zero-rate work resource (cost = 0)
 */
export function createAssignment(
  taskId: string | number,
  resourceId: number,
  units: number,
  resources: Resource[],
  tasks: GanttTask[],
): Assignment {
  const task = tasks.find((t) => t.id === taskId);
  const resource = resources.find((r) => r.uid === resourceId);

  const tempAssignment: Assignment = { taskId, resourceId, units, cost: 0 };
  const duration = task?.duration ?? 1;
  const cost = calculateAssignmentCost(
    tempAssignment,
    resource ?? { uid: resourceId, name: "", type: "work" },
    duration,
  );

  return { taskId, resourceId, units, cost };
}

/**
 * ¿Esta asignación nueva va a sobrecargar al recurso?
 *
 * Se responde llamando a `detectOverallocation` sobre la lista con la
 * candidata añadida: así hay una sola definición de «sobreasignado» por
 * construcción, y no por disciplina. Antes, Uso de Recursos usaba un umbral
 * semanal propio y Problemas uno diario, y las dos pestañas podían
 * contradecirse (M18).
 */
export function wouldOverallocate(
  assignments: Assignment[],
  resources: Resource[],
  tasks: GanttTask[],
  candidate: Assignment,
): OverallocationResult | null {
  const conCandidata = [...assignments, candidate];

  return (
    detectOverallocation(conCandidata, resources, tasks).find(
      (resultado) =>
        resultado.isOverallocated &&
        resultado.resourceId === candidate.resourceId,
    ) ?? null
  );
}
