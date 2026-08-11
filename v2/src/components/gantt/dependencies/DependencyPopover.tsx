"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link2, Plus, Trash2, X } from "lucide-react";
import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { UILocale } from "@/types/ui";
import { normalizeDependencyList } from "@/lib/gantt/dependencyEditing";
import { dependencyTokenForTaskId, taskVisibleRowId } from "@/lib/gantt/taskIds";
import { dependencyLagUnitValue, lagPatch, type DependencyLagUnit } from "@/lib/gantt/dependencyLag";

interface DependencyPopoverProps {
  task: GanttTask;
  tasks: GanttTask[];
  locale: UILocale;
  onCommit: (dependencies: GanttDependency[]) => void;
}

const dependencyTypes: GanttDependency["type"][] = ["FS", "SS", "FF", "SF"];
const dependencyLagUnits: DependencyLagUnit[] = ["days", "percent"];
const POPOVER_OFFSET = 8;
const VIEWPORT_MARGIN = 16;
const POPOVER_FALLBACK_WIDTH = 360;
const POPOVER_FALLBACK_HEIGHT = 320;

function dependencyLabel(dep: GanttDependency, tasks: GanttTask[]): string {
  return dependencyTokenForTaskId(tasks, dep.from, dep.type, dep.lag, dep.lagUnit);
}

function taskOptionLabel(tasks: GanttTask[], task: GanttTask): string {
  return `${taskVisibleRowId(tasks, task)} - ${task.name}`;
}

export default function DependencyPopover({
  task,
  tasks,
  locale,
  onCommit,
}: DependencyPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState<GanttDependency[]>(
    () => normalizeDependencyList(task.dependencies, task.id),
  );
  const [query, setQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>(() => {
    const first = tasks.find((candidate) => candidate.id !== task.id);
    return first ? String(first.id) : "";
  });
  const [type, setType] = useState<GanttDependency["type"]>("FS");
  const [lag, setLag] = useState("0");
  const [lagUnit, setLagUnit] = useState<DependencyLagUnit>("days");

  const availableTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((candidate) => {
      if (candidate.id === task.id) return false;
      if (!normalizedQuery) return true;
      return `${taskOptionLabel(tasks, candidate)}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, task.id, tasks]);

  const updatePopoverPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverWidth = popoverRef.current?.offsetWidth || POPOVER_FALLBACK_WIDTH;
    const popoverHeight = popoverRef.current?.offsetHeight || POPOVER_FALLBACK_HEIGHT;
    const maxLeft = window.innerWidth - popoverWidth - VIEWPORT_MARGIN;
    const preferredLeft = triggerRect.right - popoverWidth;
    const nextLeft = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft));
    const belowTop = triggerRect.bottom + POPOVER_OFFSET;
    const aboveTop = triggerRect.top - popoverHeight - POPOVER_OFFSET;
    const hasRoomBelow = belowTop + popoverHeight <= window.innerHeight - VIEWPORT_MARGIN;
    const nextTop = hasRoomBelow
      ? belowTop
      : Math.max(VIEWPORT_MARGIN, aboveTop);

    setPopoverPosition((current) => {
      if (
        Math.abs(current.top - nextTop) < 1 &&
        Math.abs(current.left - nextLeft) < 1
      ) {
        return current;
      }

      return { top: nextTop, left: nextLeft };
    });
  }, []);

  const open = () => {
    setDraft(normalizeDependencyList(task.dependencies, task.id));
    setIsOpen(true);
  };

  const addDependency = () => {
    if (!selectedTaskId) return;
    const source = tasks.find((candidate) => String(candidate.id) === selectedTaskId);
    if (!source) return;
    const parsedLag = Number(lag);
    const next: GanttDependency = {
      from: source.id,
      to: task.id,
      type,
      ...lagPatch(Number.isFinite(parsedLag) && parsedLag !== 0 ? parsedLag : undefined, lagUnit),
    };
    setDraft((prev) => normalizeDependencyList([...prev, next], task.id));
  };

  const updateDependency = (
    index: number,
    patch: Partial<GanttDependency>,
  ) => {
    setDraft((prev) =>
      normalizeDependencyList(
        prev.map((dep, depIndex) =>
          depIndex === index ? { ...dep, ...patch, to: task.id } : dep,
        ),
        task.id,
      ),
    );
  };

  const removeDependency = (index: number) => {
    setDraft((prev) => prev.filter((_, depIndex) => depIndex !== index));
  };

  const apply = () => {
    onCommit(normalizeDependencyList(draft, task.id));
    setIsOpen(false);
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePopoverPosition();
    const frame = window.requestAnimationFrame(updatePopoverPosition);

    return () => window.cancelAnimationFrame(frame);
  }, [availableTasks.length, draft.length, isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const popoverStyle = {
    "--gantt-dependency-popover-top": `${popoverPosition.top}px`,
    "--gantt-dependency-popover-left": `${popoverPosition.left}px`,
  } as CSSProperties;

  const popover = isOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popoverRef}
          data-testid="dependency-popover"
          role="dialog"
          aria-label={locale === "en" ? "Predecessor editor" : "Editor de predecesoras"}
          className="gantt-dependency-popover"
          style={popoverStyle}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="gantt-dependency-popover__header">
            <strong className="gantt-dependency-popover__title">
              {locale === "en" ? "Predecessors" : "Predecesoras"}
            </strong>
            <button
              type="button"
              className="gantt-dependency-popover__icon-button"
              aria-label={locale === "en" ? "Close" : "Cerrar"}
              onClick={() => setIsOpen(false)}
            >
              <X className="gantt-dependency-popover__icon" aria-hidden />
            </button>
          </div>

          <input
            data-testid="dependency-search"
            className="gantt-dependency-popover__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={locale === "en" ? "Search task" : "Buscar tarea"}
          />

          <div className="gantt-dependency-popover__composer">
            <select
              data-testid="dependency-task-select"
              // Sin etiqueta visible: la fila de tres controles se lee entera
              // mirándola, pero de oído son tres listas sin nombre.
              aria-label={locale === "en" ? "Predecessor activity" : "Actividad predecesora"}
              className="gantt-dependency-popover__control"
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
            >
              {availableTasks.map((candidate) => (
                <option key={candidate.id} value={String(candidate.id)}>
                  {taskOptionLabel(tasks, candidate)}
                </option>
              ))}
            </select>
            <select
              data-testid="dependency-type-select"
              aria-label={locale === "en" ? "Link type (FS, SS, FF, SF)" : "Tipo de vínculo (FS, SS, FF, SF)"}
              className="gantt-dependency-popover__control"
              value={type}
              onChange={(event) => setType(event.target.value as GanttDependency["type"])}
            >
              {dependencyTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              data-testid="dependency-lag-input"
              aria-label={locale === "en" ? "Lead or lag, in days" : "Adelanto o retraso, en días"}
              className="gantt-dependency-popover__control"
              type="number"
              value={lag}
              onChange={(event) => setLag(event.target.value)}
            />
            <select
              data-testid="dependency-lag-unit-select"
              className="gantt-dependency-popover__control"
              value={lagUnit}
              aria-label={locale === "en" ? "Lag unit" : "Unidad de lag"}
              onChange={(event) => setLagUnit(event.target.value as DependencyLagUnit)}
            >
              {dependencyLagUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit === "percent" ? "%" : "d"}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="dependency-add"
              className="gantt-dependency-popover__icon-button gantt-dependency-popover__icon-button--add"
              aria-label={locale === "en" ? "Add predecessor" : "Agregar predecesora"}
              onClick={addDependency}
              disabled={!selectedTaskId}
            >
              <Plus className="gantt-dependency-popover__icon" aria-hidden />
            </button>
          </div>

          <div className="gantt-dependency-popover__list">
            {draft.length === 0 ? (
              <span className="gantt-dependency-popover__empty">
                {locale === "en" ? "No predecessors" : "Sin predecesoras"}
              </span>
            ) : (
              draft.map((dep, index) => (
                <div
                  key={`${dep.from}-${dep.to}-${dep.type}-${dep.lag ?? 0}-${dep.lagUnit ?? "days"}-${index}`}
                  data-testid="dependency-row"
                  className="gantt-dependency-popover__row"
                >
                  <span className="gantt-dependency-popover__dependency-label">
                    {dependencyLabel(dep, tasks)}
                  </span>
                  <select
                    className="gantt-dependency-popover__control"
                    aria-label={locale === "en" ? "Dependency type" : "Tipo de dependencia"}
                    value={dep.type}
                    onChange={(event) =>
                      updateDependency(index, {
                        type: event.target.value as GanttDependency["type"],
                      })
                    }
                  >
                    {dependencyTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <input
                    className="gantt-dependency-popover__control"
                    aria-label={locale === "en" ? "Lag days" : "Lag en dias"}
                    type="number"
                    value={dep.lag ?? 0}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateDependency(index, {
                        ...lagPatch(
                          Number.isFinite(value) && value !== 0 ? value : undefined,
                          dep.lagUnit,
                        ),
                      });
                    }}
                  />
                  <select
                    className="gantt-dependency-popover__control"
                    aria-label={locale === "en" ? "Lag unit" : "Unidad de lag"}
                    value={dependencyLagUnitValue(dep.lagUnit)}
                    onChange={(event) =>
                      updateDependency(index, {
                        ...lagPatch(dep.lag, event.target.value as DependencyLagUnit),
                      })
                    }
                  >
                    {dependencyLagUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit === "percent" ? "%" : "d"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="gantt-dependency-popover__icon-button"
                    aria-label={locale === "en" ? "Remove dependency" : "Eliminar dependencia"}
                    onClick={() => removeDependency(index)}
                  >
                    <Trash2 className="gantt-dependency-popover__icon" aria-hidden />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="gantt-dependency-popover__footer">
            <button
              type="button"
              className="gantt-dependency-popover__action"
              onClick={() => setIsOpen(false)}
            >
              {locale === "en" ? "Cancel" : "Cancelar"}
            </button>
            <button
              type="button"
              data-testid="dependency-apply"
              className="gantt-dependency-popover__action gantt-dependency-popover__action--primary"
              onClick={apply}
            >
              {locale === "en" ? "Apply" : "Aplicar"}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <span className="gantt-dependency-popover-host">
      <button
        ref={triggerRef}
        type="button"
        data-testid={`dependency-popover-open-${task.id}`}
        title={locale === "en" ? "Edit predecessors" : "Editar predecesoras"}
        aria-label={locale === "en" ? "Edit predecessors" : "Editar predecesoras"}
        className="gantt-dependency-trigger"
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        <Link2 className="gantt-dependency-trigger__icon" aria-hidden />
        <span className="gantt-dependency-trigger__label">
          {locale === "en" ? "Edit" : "Editar"}
        </span>
      </button>
      {popover}
    </span>
  );
}
