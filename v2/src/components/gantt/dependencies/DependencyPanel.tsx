"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { UILocale } from "@/types/ui";
import {
  normalizeDependencyList,
  replacePredecessors,
  replaceSuccessors,
} from "@/lib/gantt/dependencyEditing";
import { dependencyRowId, taskVisibleRowId } from "@/lib/gantt/taskIds";
import { recalculateSchedule, validateDependencies } from "@/lib/scheduling/scheduleEngine";
import { formatProjectDate } from "@/lib/date/projectDate";

interface DependencyPanelProps {
  task: GanttTask;
  tasks: GanttTask[];
  locale: UILocale;
  onClose: () => void;
  onCommitPredecessors: (dependencies: GanttDependency[]) => void;
  onCommitSuccessors: (dependencies: GanttDependency[]) => void;
}

const dependencyTypes: GanttDependency["type"][] = ["FS", "SS", "FF", "SF"];
const CONTROL_RADIUS = "var(--radius-sm)";
const SURFACE_RADIUS = "var(--radius-md)";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface DependencyImpactSummary {
  affectedTaskCount: number;
  projectFinishBefore?: Date;
  projectFinishAfter?: Date;
  projectFinishDeltaDays: number;
  selectedFinishBefore?: Date;
  selectedFinishAfter?: Date;
  selectedDeltaDays: number;
  criticalDelta: number;
}

function parseLag(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : undefined;
}

function dependencyLabel(dep: GanttDependency, tasks: GanttTask[], direction: "predecessor" | "successor"): string {
  const id = direction === "predecessor" ? dep.from : dep.to;
  const related = tasks.find((candidate) => candidate.id === id);
  const lag = dep.lag ? `${dep.lag > 0 ? "+" : ""}${dep.lag}d` : "";
  return `${dependencyRowId(tasks, id)} - ${related?.name ?? ""} ${dep.type}${lag}`;
}

function taskOptionLabel(tasks: GanttTask[], task: GanttTask): string {
  return `${taskVisibleRowId(tasks, task)} - ${task.name}`;
}

function dateDeltaDays(before?: Date, after?: Date): number {
  if (!before || !after) return 0;
  return Math.round((after.getTime() - before.getTime()) / MS_PER_DAY);
}

function maxFinish(tasks: GanttTask[]): Date | undefined {
  return tasks.reduce<Date | undefined>((latest, task) => {
    if (!latest || task.finish.getTime() > latest.getTime()) return task.finish;
    return latest;
  }, undefined);
}

function changedScheduleFields(before?: GanttTask, after?: GanttTask): boolean {
  if (!before || !after) return false;
  return (
    before.start.getTime() !== after.start.getTime() ||
    before.finish.getTime() !== after.finish.getTime() ||
    before.isCritical !== after.isCritical ||
    (before.totalFloat ?? 0) !== (after.totalFloat ?? 0)
  );
}

function summarizeImpact(
  currentTasks: GanttTask[],
  previewTasks: GanttTask[],
  taskId: string | number,
): DependencyImpactSummary | undefined {
  const before = recalculateSchedule(currentTasks);
  const after = recalculateSchedule(previewTasks);
  if (before.issues.length > 0 || after.issues.length > 0) return undefined;

  const beforeById = new Map(before.tasks.map((item) => [item.id, item]));
  const afterById = new Map(after.tasks.map((item) => [item.id, item]));
  const affectedTaskCount = after.tasks.filter((item) =>
    changedScheduleFields(beforeById.get(item.id), item),
  ).length;
  const projectFinishBefore = maxFinish(before.tasks);
  const projectFinishAfter = maxFinish(after.tasks);
  const selectedBefore = beforeById.get(taskId);
  const selectedAfter = afterById.get(taskId);
  const criticalBefore = before.tasks.filter((item) => item.isCritical).length;
  const criticalAfter = after.tasks.filter((item) => item.isCritical).length;

  return {
    affectedTaskCount,
    projectFinishBefore,
    projectFinishAfter,
    projectFinishDeltaDays: dateDeltaDays(projectFinishBefore, projectFinishAfter),
    selectedFinishBefore: selectedBefore?.finish,
    selectedFinishAfter: selectedAfter?.finish,
    selectedDeltaDays: dateDeltaDays(selectedBefore?.finish, selectedAfter?.finish),
    criticalDelta: criticalAfter - criticalBefore,
  };
}

function formatDelta(value: number, locale: UILocale): string {
  if (value === 0) return locale === "en" ? "no change" : "sin cambio";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}d`;
}

function formatCountDelta(value: number, locale: UILocale): string {
  if (value === 0) return locale === "en" ? "no change" : "sin cambio";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}`;
}

export default function DependencyPanel({
  task,
  tasks,
  locale,
  onClose,
  onCommitPredecessors,
  onCommitSuccessors,
}: DependencyPanelProps) {
  const relatedTasks = useMemo(
    () => tasks.filter((candidate) => candidate.id !== task.id),
    [task.id, tasks],
  );
  const [predecessors, setPredecessors] = useState<GanttDependency[]>(
    () => normalizeDependencyList(task.dependencies, task.id),
  );
  const [successors, setSuccessors] = useState<GanttDependency[]>(() =>
    normalizeDependencyList(
      tasks.flatMap((candidate) =>
        candidate.dependencies
          .filter((dep) => dep.from === task.id)
          .map((dep) => ({ ...dep, from: task.id, to: candidate.id })),
      ),
    ),
  );
  const [predecessorTaskId, setPredecessorTaskId] = useState(() => String(relatedTasks[0]?.id ?? ""));
  const [successorTaskId, setSuccessorTaskId] = useState(() => String(relatedTasks[0]?.id ?? ""));
  const [predecessorType, setPredecessorType] = useState<GanttDependency["type"]>("FS");
  const [successorType, setSuccessorType] = useState<GanttDependency["type"]>("FS");
  const [predecessorLag, setPredecessorLag] = useState("0");
  const [successorLag, setSuccessorLag] = useState("0");
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const nextPredecessors = useMemo(
    () => normalizeDependencyList(predecessors, task.id),
    [predecessors, task.id],
  );
  const nextSuccessors = useMemo(
    () => normalizeDependencyList(successors.map((dep) => ({ ...dep, from: task.id }))),
    [successors, task.id],
  );
  const previewTasks = useMemo(
    () => replaceSuccessors(
      replacePredecessors(tasks, task.id, nextPredecessors),
      task.id,
      nextSuccessors,
    ),
    [nextPredecessors, nextSuccessors, task.id, tasks],
  );
  const impactSummary = useMemo(
    () => summarizeImpact(tasks, previewTasks, task.id),
    [previewTasks, task.id, tasks],
  );

  const addPredecessor = () => {
    const source = tasks.find((candidate) => String(candidate.id) === predecessorTaskId);
    if (!source) return;
    setPredecessors((prev) =>
      normalizeDependencyList(
        [
          ...prev,
          {
            from: source.id,
            to: task.id,
            type: predecessorType,
            lag: parseLag(predecessorLag),
          },
        ],
        task.id,
      ),
    );
  };

  const addSuccessor = () => {
    const target = tasks.find((candidate) => String(candidate.id) === successorTaskId);
    if (!target) return;
    setSuccessors((prev) =>
      normalizeDependencyList([
        ...prev,
        {
          from: task.id,
          to: target.id,
          type: successorType,
          lag: parseLag(successorLag),
        },
      ]),
    );
  };

  const apply = () => {
    const issues = validateDependencies(previewTasks);

    if (issues.length > 0) {
      setValidationMessages(issues.map((issue) => issue.message));
      return;
    }

    setValidationMessages([]);
    onCommitPredecessors(nextPredecessors);
    onCommitSuccessors(nextSuccessors);
    onClose();
  };

  const renderDependencyRows = (
    dependencies: GanttDependency[],
    direction: "predecessor" | "successor",
    onChange: (dependencies: GanttDependency[]) => void,
  ) => (
    <div style={{ display: "grid", gap: "4px" }}>
      {dependencies.length === 0 ? (
        <span style={{ color: "var(--gray-500)", fontSize: "0.75rem" }}>
          {locale === "en" ? "No dependencies" : "Sin dependencias"}
        </span>
      ) : (
        dependencies.map((dep, index) => (
          <div
            key={`${dep.from}-${dep.to}-${dep.type}-${dep.lag ?? 0}-${index}`}
            data-testid={`dependency-panel-${direction}-row`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 64px 64px 30px",
              gap: "5px",
              alignItems: "center",
            }}
          >
            <span
              title={dependencyLabel(dep, tasks, direction)}
              style={{ overflow: "hidden", textOverflow: "ellipsis", fontSize: "0.75rem" }}
            >
              {dependencyLabel(dep, tasks, direction)}
            </span>
            <select
              aria-label={locale === "en" ? "Dependency type" : "Tipo de dependencia"}
              value={dep.type}
              onChange={(event) =>
                onChange(
                  normalizeDependencyList(
                    dependencies.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, type: event.target.value as GanttDependency["type"] }
                        : item,
                    ),
                    direction === "predecessor" ? task.id : undefined,
                  ),
                )
              }
              style={{ minWidth: 0, padding: "4px", fontSize: "0.75rem" }}
            >
              {dependencyTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              aria-label={locale === "en" ? "Lag days" : "Lag en dias"}
              type="number"
              value={dep.lag ?? 0}
              onChange={(event) =>
                onChange(
                  normalizeDependencyList(
                    dependencies.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, lag: parseLag(event.target.value) } : item,
                    ),
                    direction === "predecessor" ? task.id : undefined,
                  ),
                )
              }
              style={{ minWidth: 0, padding: "4px", fontSize: "0.75rem" }}
            />
            <button
              type="button"
              aria-label={locale === "en" ? "Remove dependency" : "Eliminar dependencia"}
              onClick={() => onChange(dependencies.filter((_, itemIndex) => itemIndex !== index))}
              style={{
                width: "28px",
                height: "26px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--gray-200)",
                borderRadius: CONTROL_RADIUS,
                background: "var(--color-bg-elevated)",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const renderDependencyAdder = (
    direction: "predecessor" | "successor",
    selectedTaskId: string,
    setSelectedTaskId: (value: string) => void,
    type: GanttDependency["type"],
    setType: (value: GanttDependency["type"]) => void,
    lag: string,
    setLag: (value: string) => void,
    onAdd: () => void,
  ) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 64px 64px 30px",
        gap: "5px",
        alignItems: "center",
      }}
    >
      <select
        data-testid={`dependency-panel-${direction}-task-select`}
        value={selectedTaskId}
        onChange={(event) => setSelectedTaskId(event.target.value)}
        style={{ minWidth: 0, padding: "4px", fontSize: "0.75rem" }}
      >
        {relatedTasks.map((candidate) => (
          <option key={candidate.id} value={String(candidate.id)}>
            {taskOptionLabel(tasks, candidate)}
          </option>
        ))}
      </select>
      <select
        data-testid={`dependency-panel-${direction}-type-select`}
        value={type}
        onChange={(event) => setType(event.target.value as GanttDependency["type"])}
        style={{ minWidth: 0, padding: "4px", fontSize: "0.75rem" }}
      >
        {dependencyTypes.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <input
        data-testid={`dependency-panel-${direction}-lag-input`}
        type="number"
        value={lag}
        onChange={(event) => setLag(event.target.value)}
        style={{ minWidth: 0, padding: "4px", fontSize: "0.75rem" }}
      />
      <button
        type="button"
        data-testid={`dependency-panel-add-${direction}`}
        aria-label={locale === "en" ? `Add ${direction}` : `Agregar ${direction}`}
        disabled={!selectedTaskId}
        onClick={onAdd}
        style={{
          width: "28px",
          height: "26px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--aia-corp-mid)",
          borderRadius: CONTROL_RADIUS,
          background: "var(--aia-corp-xlight)",
          cursor: selectedTaskId ? "pointer" : "not-allowed",
          opacity: selectedTaskId ? 1 : 0.5,
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  );

  return (
    <aside
      data-testid="dependency-panel"
      role="dialog"
      aria-label={locale === "en" ? "Dependency panel" : "Panel de dependencias"}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        top: "78px",
        right: "10px",
        width: "420px",
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "calc(100vh - 120px)",
        overflow: "auto",
        zIndex: 85,
        padding: "12px",
        border: "1px solid var(--aia-corp-mid)",
        borderRadius: SURFACE_RADIUS,
        background: "var(--aia-alabaster)",
        boxShadow: "0 14px 32px rgba(26, 60, 42, 0.2)",
        color: "var(--color-text-strong)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: "0.8125rem" }}>
            {locale === "en" ? "Dependencies" : "Dependencias"}
          </strong>
          <span
            title={task.name}
            style={{
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "0.75rem",
              color: "var(--gray-600)",
            }}
          >
            {taskVisibleRowId(tasks, task)} - {task.name}
          </span>
        </div>
        <button
          type="button"
          aria-label={locale === "en" ? "Close" : "Cerrar"}
          onClick={onClose}
          style={{
            width: "28px",
            height: "28px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>

      <section style={{ display: "grid", gap: "8px", marginBottom: "14px" }}>
        <strong style={{ fontSize: "0.75rem" }}>
          {locale === "en" ? "Predecessors" : "Predecesoras"}
        </strong>
        {renderDependencyAdder(
          "predecessor",
          predecessorTaskId,
          setPredecessorTaskId,
          predecessorType,
          setPredecessorType,
          predecessorLag,
          setPredecessorLag,
          addPredecessor,
        )}
        {renderDependencyRows(predecessors, "predecessor", setPredecessors)}
      </section>

      <section style={{ display: "grid", gap: "8px", marginBottom: "14px" }}>
        <strong style={{ fontSize: "0.75rem" }}>
          {locale === "en" ? "Successors" : "Sucesoras"}
        </strong>
        {renderDependencyAdder(
          "successor",
          successorTaskId,
          setSuccessorTaskId,
          successorType,
          setSuccessorType,
          successorLag,
          setSuccessorLag,
          addSuccessor,
        )}
        {renderDependencyRows(successors, "successor", setSuccessors)}
      </section>

      {validationMessages.length > 0 && (
        <div
          data-testid="dependency-panel-validation"
          role="alert"
          style={{
            display: "grid",
            gap: "4px",
            marginBottom: "12px",
            padding: "8px",
            border: "1px solid var(--aia-alert-main)",
            borderRadius: CONTROL_RADIUS,
            background: "rgba(170, 67, 45, 0.08)",
            color: "var(--aia-alert-main)",
            fontSize: "0.75rem",
          }}
        >
          {validationMessages.map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      )}

      {impactSummary && (
        <section
          data-testid="dependency-panel-impact"
          style={{
            display: "grid",
            gap: "6px",
            marginBottom: "12px",
            padding: "8px",
            border: "1px solid var(--gray-200)",
            borderRadius: CONTROL_RADIUS,
            background: "var(--color-bg-elevated)",
            fontSize: "0.75rem",
          }}
        >
          <strong style={{ fontSize: "0.75rem" }}>
            {locale === "en" ? "Impact preview" : "Impacto previo"}
          </strong>
          <span>
            {locale === "en" ? "Affected tasks" : "Tareas afectadas"}:{" "}
            <strong>{impactSummary.affectedTaskCount}</strong>
          </span>
          <span>
            {locale === "en" ? "Project finish" : "Fin del proyecto"}:{" "}
            <strong>{formatDelta(impactSummary.projectFinishDeltaDays, locale)}</strong>
            {impactSummary.projectFinishBefore && impactSummary.projectFinishAfter
              ? ` (${formatProjectDate(impactSummary.projectFinishBefore)} -> ${formatProjectDate(
                  impactSummary.projectFinishAfter,
                )})`
              : ""}
          </span>
          <span>
            {locale === "en" ? "Selected task finish" : "Fin de tarea seleccionada"}:{" "}
            <strong>{formatDelta(impactSummary.selectedDeltaDays, locale)}</strong>
            {impactSummary.selectedFinishBefore && impactSummary.selectedFinishAfter
              ? ` (${formatProjectDate(impactSummary.selectedFinishBefore)} -> ${formatProjectDate(
                  impactSummary.selectedFinishAfter,
                )})`
              : ""}
          </span>
          <span>
            {locale === "en" ? "Critical tasks" : "Tareas criticas"}:{" "}
            <strong>{formatCountDelta(impactSummary.criticalDelta, locale)}</strong>
          </span>
        </section>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--gray-200)",
            borderRadius: CONTROL_RADIUS,
            background: "var(--color-bg-elevated)",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          {locale === "en" ? "Cancel" : "Cancelar"}
        </button>
        <button
          type="button"
          data-testid="dependency-panel-apply"
          onClick={apply}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--aia-corp-mid)",
            borderRadius: CONTROL_RADIUS,
            background: "var(--aia-corp-main)",
            color: "white",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          {locale === "en" ? "Apply" : "Aplicar"}
        </button>
      </div>
    </aside>
  );
}
