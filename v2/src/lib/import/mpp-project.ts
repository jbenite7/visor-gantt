import {
  mppAssignmentsToAssignments,
  mppResourcesToResources,
  mppTasksToGanttTasks,
} from "@/components/upload/mpp-to-gantt";
import { calculateMppFields } from "@/lib/mpp/mppCalculationEngine";
import {
  buildMppAssignmentColumnsFromAssignments,
  buildMppResourceColumnsFromResources,
  buildMppTaskColumnsFromTasks,
} from "@/lib/mpp/taskColumns";
import { buildMatrixPlanFromGantt } from "@/lib/matrix/matrixFromGantt";
import type { ProjectData as ParsedMppProject } from "@/lib/parser/mpp-parser";
import { normalizeProjectCalendar } from "@/lib/scheduling/projectCalendar";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import { DEFAULT_UI_SETTINGS } from "@/types/ui";
import type { ProjectData } from "@/app/actions/project";
import type { GanttTask } from "@/components/gantt/types";
import type { Assignment, Resource } from "@/types/resource";

const GENERIC_IMPORTED_PROJECT_NAME = "Proyecto Importado";
const MAX_LIGHT_IMPORT_COLUMNS = 120;

function sanitizeId(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "proyecto-importado";
}

function importTimestamp(parsedProject: ParsedMppProject): string {
  const candidate = parsedProject.statusDate ?? parsedProject.startDate;
  const date = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function enrichTasksWithImportedAssignments(
  tasks: GanttTask[],
  resources: Resource[],
  assignments: Assignment[],
): GanttTask[] {
  const resourceNamesById = new Map(
    resources.map((resource) => [resource.uid, resource.name]),
  );
  const assignmentsByTask = new Map<string, Assignment[]>();

  assignments.forEach((assignment) => {
    const key = String(assignment.taskId);
    const list = assignmentsByTask.get(key) ?? [];
    list.push(assignment);
    assignmentsByTask.set(key, list);
  });

  return tasks.map((task) => {
    const taskAssignments = assignmentsByTask.get(String(task.id)) ?? [];
    if (taskAssignments.length === 0) return task;

    const resourceNames = [
      ...new Set(
        taskAssignments
          .map((assignment) => resourceNamesById.get(assignment.resourceId))
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const assignedCost = taskAssignments.reduce(
      (sum, assignment) => sum + assignment.cost,
      0,
    );

    return {
      ...task,
      resourceNames: resourceNames.length > 0 ? resourceNames : task.resourceNames,
      cost: task.cost ?? assignedCost,
    };
  });
}

export function buildProjectDataFromMpp(
  parsedProject: ParsedMppProject,
  fallbackFileName: string,
  options: { calculateFields?: boolean } = {},
): ProjectData {
  const fallbackName = fallbackFileName.replace(/\.mpp$/i, "");
  const projectName =
    parsedProject.name && parsedProject.name !== GENERIC_IMPORTED_PROJECT_NAME
      ? parsedProject.name
      : fallbackName;
  const projectCalendar = normalizeProjectCalendar(
    parsedProject.calendar ?? DEFAULT_PROJECT_CALENDAR,
  );
  const resources = mppResourcesToResources(parsedProject.resources ?? []);
  const assignments = mppAssignmentsToAssignments(
    parsedProject.assignments ?? [],
  );
  const tasks = enrichTasksWithImportedAssignments(
    mppTasksToGanttTasks(parsedProject.tasks),
    resources,
    assignments,
  );
  const buildImportedMatrix = (projectTasks: typeof tasks) =>
    buildMatrixPlanFromGantt({
      id: `matrix-mpp-${sanitizeId(projectName)}`,
      name: `${projectName} - Programacion matricial`,
      startDate: parsedProject.startDate || projectTasks[0]?.start.toISOString().slice(0, 10) || "2026-01-01",
      tasks: projectTasks,
      generatedAt: importTimestamp(parsedProject),
    });

  if (options.calculateFields === false) {
    const matrixImport = buildImportedMatrix(tasks);
    const mppTaskColumns = (
      parsedProject.mppTaskColumns?.length
        ? parsedProject.mppTaskColumns
        : buildMppTaskColumnsFromTasks(
            [],
            parsedProject.availableColumns,
            parsedProject.mppTaskColumns,
          )
    ).slice(0, MAX_LIGHT_IMPORT_COLUMNS);
    const mppResourceColumns = (
      parsedProject.mppResourceColumns?.length
        ? parsedProject.mppResourceColumns
        : buildMppResourceColumnsFromResources(
            [],
            parsedProject.availableResourceColumns,
            parsedProject.mppResourceColumns,
          )
    ).slice(0, MAX_LIGHT_IMPORT_COLUMNS);
    const mppAssignmentColumns = (
      parsedProject.mppAssignmentColumns?.length
        ? parsedProject.mppAssignmentColumns
        : buildMppAssignmentColumnsFromAssignments(
            [],
            parsedProject.availableAssignmentColumns,
            parsedProject.mppAssignmentColumns,
          )
    ).slice(0, MAX_LIGHT_IMPORT_COLUMNS);

    return {
      name: projectName,
      statusDate: parsedProject.statusDate,
      tasks: matrixImport.tasks,
      resources,
      assignments,
      budgetItems: [],
      budgetMappings: [],
      baselines: [],
      calendar: projectCalendar,
      matrixPlan: matrixImport.matrixPlan,
      mppTaskColumns,
      mppResourceColumns,
      mppAssignmentColumns,
      customFieldDefinitions: parsedProject.customFieldDefinitions ?? [],
      uiSettings: DEFAULT_UI_SETTINGS,
    };
  }

  const mppTaskColumns = buildMppTaskColumnsFromTasks(
    parsedProject.tasks,
    parsedProject.availableColumns,
    parsedProject.mppTaskColumns,
  );
  const mppResourceColumns = buildMppResourceColumnsFromResources(
    resources,
    parsedProject.availableResourceColumns,
    parsedProject.mppResourceColumns,
  );
  const mppAssignmentColumns = buildMppAssignmentColumnsFromAssignments(
    assignments,
    parsedProject.availableAssignmentColumns,
    parsedProject.mppAssignmentColumns,
  );
  const calculated = calculateMppFields({
    tasks,
    resources,
    assignments,
    baselines: [],
    calendar: projectCalendar,
    statusDate: parsedProject.statusDate,
    mppTaskColumns,
    mppResourceColumns,
    mppAssignmentColumns,
    customFieldDefinitions: parsedProject.customFieldDefinitions ?? [],
  });
  const matrixImport = buildImportedMatrix(calculated.tasks);

  return {
    name: projectName,
    statusDate: parsedProject.statusDate,
    tasks: matrixImport.tasks,
    resources: calculated.resources,
    assignments: calculated.assignments,
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar: projectCalendar,
    matrixPlan: matrixImport.matrixPlan,
    mppTaskColumns: calculated.mppTaskColumns,
    mppResourceColumns: calculated.mppResourceColumns,
    mppAssignmentColumns: calculated.mppAssignmentColumns,
    customFieldDefinitions: calculated.customFieldDefinitions,
    calculationEngineVersion: calculated.engineVersion,
    calculatedAt: calculated.calculatedAt,
    uiSettings: DEFAULT_UI_SETTINGS,
  };
}
