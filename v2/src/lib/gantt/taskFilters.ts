import type { GanttTask } from "@/components/gantt/types";
import type { TaskFilterSettings, TaskFilterType } from "@/types/ui";

export const DEFAULT_TASK_FILTER: TaskFilterSettings = {
  text: "",
  type: "all",
};

export const TASK_FILTER_TYPES: TaskFilterType[] = [
  "all",
  "critical",
  "non-critical",
  "milestones",
  "summaries",
];

export function normalizeTaskFilter(
  filter: TaskFilterSettings | undefined,
): TaskFilterSettings {
  return {
    text: filter?.text ?? DEFAULT_TASK_FILTER.text,
    type: TASK_FILTER_TYPES.includes(filter?.type ?? "all")
      ? filter?.type ?? DEFAULT_TASK_FILTER.type
      : DEFAULT_TASK_FILTER.type,
  };
}

export function taskMatchesFilter(
  task: GanttTask,
  filter: TaskFilterSettings | undefined,
): boolean {
  const normalized = normalizeTaskFilter(filter);
  const query = normalized.text.trim().toLowerCase();

  if (query) {
    const searchable = [
      task.name,
      task.wbs,
      String(task.id),
      task.resourceNames?.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!searchable.includes(query)) return false;
  }

  switch (normalized.type) {
    case "critical":
      return task.isCritical;
    case "non-critical":
      return !task.isCritical && !task.isMilestone && !task.isSummary;
    case "milestones":
      return task.isMilestone;
    case "summaries":
      return task.isSummary;
    default:
      return true;
  }
}

export function filterTasks(
  tasks: GanttTask[],
  filter: TaskFilterSettings | undefined,
): GanttTask[] {
  const normalized = normalizeTaskFilter(filter);
  if (!normalized.text.trim() && normalized.type === "all") return tasks;
  return tasks.filter((task) => taskMatchesFilter(task, normalized));
}
