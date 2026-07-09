"use client";

import { useMemo, useState } from "react";
import { Link2, Plus, Trash2, X } from "lucide-react";
import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { UILocale } from "@/types/ui";
import { normalizeDependencyList } from "@/lib/gantt/dependencyEditing";
import { dependencyToken, taskRowId } from "@/lib/gantt/taskIds";

interface DependencyPopoverProps {
  task: GanttTask;
  tasks: GanttTask[];
  locale: UILocale;
  onCommit: (dependencies: GanttDependency[]) => void;
}

const dependencyTypes: GanttDependency["type"][] = ["FS", "SS", "FF", "SF"];
const CONTROL_RADIUS = "var(--radius-sm)";
const SURFACE_RADIUS = "var(--radius-md)";

function dependencyLabel(dep: GanttDependency, tasks: GanttTask[]): string {
  return dependencyToken(tasks.find((candidate) => candidate.id === dep.from), dep.from, dep.type, dep.lag);
}

export default function DependencyPopover({
  task,
  tasks,
  locale,
  onCommit,
}: DependencyPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const availableTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((candidate) => {
      if (candidate.id === task.id) return false;
      if (!normalizedQuery) return true;
      return `${taskRowId(candidate)} ${candidate.name} ${candidate.wbs ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, task.id, tasks]);

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
      lag: Number.isFinite(parsedLag) && parsedLag !== 0 ? parsedLag : undefined,
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

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        data-testid={`dependency-popover-open-${task.id}`}
        title={locale === "en" ? "Edit predecessors" : "Editar predecesoras"}
        aria-label={locale === "en" ? "Edit predecessors" : "Editar predecesoras"}
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
        style={{
          width: "22px",
          height: "22px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--gray-200)",
          borderRadius: CONTROL_RADIUS,
          background: "var(--color-bg-elevated)",
          color: "var(--aia-corp-dark)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Link2 size={13} />
      </button>

      {isOpen && (
        <div
          data-testid="dependency-popover"
          role="dialog"
          aria-label={locale === "en" ? "Predecessor editor" : "Editor de predecesoras"}
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: "360px",
            maxWidth: "min(360px, 90vw)",
            zIndex: 80,
            padding: "10px",
            border: "1px solid var(--aia-corp-mid)",
            borderRadius: SURFACE_RADIUS,
            background: "var(--aia-alabaster)",
            boxShadow: "0 10px 24px rgba(26, 60, 42, 0.18)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            color: "var(--color-text-strong)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <strong style={{ fontSize: "0.75rem" }}>
              {locale === "en" ? "Predecessors" : "Predecesoras"}
            </strong>
            <button
              type="button"
              aria-label={locale === "en" ? "Close" : "Cerrar"}
              onClick={() => setIsOpen(false)}
              style={{
                width: "24px",
                height: "24px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>

          <input
            data-testid="dependency-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={locale === "en" ? "Search task" : "Buscar tarea"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: "8px",
              padding: "5px 7px",
              border: "1px solid var(--gray-200)",
              borderRadius: CONTROL_RADIUS,
              fontSize: "0.75rem",
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 64px 60px 28px",
              gap: "4px",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <select
              data-testid="dependency-task-select"
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              style={{ minWidth: 0, padding: "4px", fontSize: "0.75rem" }}
            >
              {availableTasks.map((candidate) => (
                <option key={candidate.id} value={String(candidate.id)}>
                  {candidate.wbs ? `${candidate.wbs} ` : ""}
                  {taskRowId(candidate)} - {candidate.name}
                </option>
              ))}
            </select>
            <select
              data-testid="dependency-type-select"
              value={type}
              onChange={(event) => setType(event.target.value as GanttDependency["type"])}
              style={{ padding: "4px", fontSize: "0.75rem" }}
            >
              {dependencyTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              data-testid="dependency-lag-input"
              type="number"
              value={lag}
              onChange={(event) => setLag(event.target.value)}
              style={{ padding: "4px", fontSize: "0.75rem" }}
            />
            <button
              type="button"
              data-testid="dependency-add"
              aria-label={locale === "en" ? "Add predecessor" : "Agregar predecesora"}
              onClick={addDependency}
              disabled={!selectedTaskId}
              style={{
                height: "26px",
                border: "1px solid var(--aia-corp-mid)",
                borderRadius: CONTROL_RADIUS,
                background: "var(--aia-corp-xlight)",
                cursor: selectedTaskId ? "pointer" : "not-allowed",
              }}
            >
              <Plus size={13} />
            </button>
          </div>

          <div style={{ display: "grid", gap: "4px", marginBottom: "10px" }}>
            {draft.length === 0 ? (
              <span style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>
                {locale === "en" ? "No predecessors" : "Sin predecesoras"}
              </span>
            ) : (
              draft.map((dep, index) => (
                <div
                  key={`${dep.from}-${dep.to}-${dep.type}-${dep.lag ?? 0}-${index}`}
                  data-testid="dependency-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 64px 60px 28px",
                    gap: "4px",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {dependencyLabel(dep, tasks)}
                  </span>
                  <select
                    aria-label={locale === "en" ? "Dependency type" : "Tipo de dependencia"}
                    value={dep.type}
                    onChange={(event) =>
                      updateDependency(index, {
                        type: event.target.value as GanttDependency["type"],
                      })
                    }
                    style={{ padding: "4px", fontSize: "0.75rem" }}
                  >
                    {dependencyTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={locale === "en" ? "Lag days" : "Lag en dias"}
                    type="number"
                    value={dep.lag ?? 0}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateDependency(index, {
                        lag: Number.isFinite(value) && value !== 0 ? value : undefined,
                      });
                    }}
                    style={{ padding: "4px", fontSize: "0.75rem" }}
                  />
                  <button
                    type="button"
                    aria-label={locale === "en" ? "Remove dependency" : "Eliminar dependencia"}
                    onClick={() => removeDependency(index)}
                    style={{
                      height: "26px",
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                padding: "5px 9px",
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
              data-testid="dependency-apply"
              onClick={apply}
              style={{
                padding: "5px 9px",
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
        </div>
      )}
    </span>
  );
}
