"use client";

import { useState, useRef, useEffect } from "react";
import {
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Save,
  FolderKanban,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import type { ViewType } from "./viewTypes";
import type { GanttScale } from "@/components/gantt/types";
import type { UILocale } from "@/types/ui";
import { t } from "@/lib/i18n";

/* ── Types ── */

interface Baseline {
  id: string;
  name: string;
}

interface ZoomButton {
  scale: GanttScale;
  label: string;
}

const ZOOM_BUTTONS: ZoomButton[] = [
  { scale: "day", label: "Día" },
  { scale: "week", label: "Semana" },
  { scale: "month", label: "Mes" },
  { scale: "quarter", label: "Trimestre" },
];

interface ProjectToolbarProps {
  /* ── View tabs ── */
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  /* ── Zoom ── */
  scale: GanttScale;
  onScaleChange: (scale: GanttScale) => void;
  /* ── Undo / Redo ── */
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /* ── Project Info ── */
  projectName?: string;
  projectStart?: Date;
  projectFinish?: Date;
  taskCount: number;
  durationDays?: number;
  averageProgress?: number;
  dependencyCount?: number;
  /* ── Editing Tools ── */
  onAddTask?: () => void;
  onDeleteTask?: () => void;
  hasSelection: boolean;
  /** Abre las observaciones de la tarea seleccionada. */
  onOpenObservations?: () => void;
  /** Nº de observaciones pendientes en todo el proyecto, para el contador. */
  pendingObservationCount?: number;
  /* ── Baseline Tools ── */
  baselines?: Baseline[];
  activeBaselineId?: string;
  onSaveBaseline?: () => void;
  onSelectBaseline?: (id: string) => void;
  locale?: UILocale;
}

/* ── Format date for toolbar display ── */
function formatDateShort(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/* ───────────────────── Component ───────────────────── */

export default function ProjectToolbar({
  scale,
  onScaleChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  projectName,
  projectStart,
  projectFinish,
  taskCount,
  durationDays,
  averageProgress,
  dependencyCount = 0,
  onAddTask,
  onDeleteTask,
  hasSelection,
  onOpenObservations,
  pendingObservationCount = 0,
  baselines = [],
  activeBaselineId,
  onSaveBaseline,
  onSelectBaseline,
  locale = "es",
}: ProjectToolbarProps) {
  const [baselineDropdownOpen, setBaselineDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!baselineDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setBaselineDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [baselineDropdownOpen]);

  const activeBaselineName =
    baselines.find((b) => b.id === activeBaselineId)?.name ?? null;

  return (
    <div
      data-testid="project-toolbar"
      className="apple-toolbar gantt-project-toolbar"
    >
      {/* ─── 1. Project Info (left) ─── */}
      <div className="gantt-project-toolbar__info">
        <FolderKanban
          className="gantt-project-toolbar__project-icon"
          aria-hidden
        />
        <div className="gantt-project-toolbar__project-copy">
          <span className="gantt-project-toolbar__project-title">
            {projectName || t(locale, "unnamedProject")}
          </span>
          <span className="gantt-project-toolbar__project-meta">
            {projectStart && projectFinish
              ? `${formatDateShort(projectStart)} — ${formatDateShort(projectFinish)}`
              : t(locale, "noDates")}{" "}
            · {taskCount} {taskCount === 1 ? t(locale, "task") : t(locale, "tasks")}
            {durationDays !== undefined ? ` · ${durationDays}d` : ""}
            {averageProgress !== undefined ? ` · ${Math.round(averageProgress)}%` : ""}
            {dependencyCount > 0 ? ` · ${dependencyCount} dep.` : ""}
          </span>
        </div>
      </div>

      <div className="gantt-project-toolbar__divider" />

      {/* ─── 2. Zoom Controls (center-left) ─── */}
      <div className="gantt-project-toolbar__group">
        <span className="gantt-project-toolbar__label">
          {t(locale, "zoom")}:
        </span>
        {ZOOM_BUTTONS.map((btn) => (
          <button
            key={btn.scale}
            type="button"
            onClick={() => onScaleChange(btn.scale)}
            className="gantt-project-toolbar__button gantt-project-toolbar__button--text"
            data-active={scale === btn.scale}
            aria-pressed={scale === btn.scale}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="gantt-project-toolbar__divider" />

      {/* ─── 4. Editing Tools (center-right) ─── */}
      <div className="gantt-project-toolbar__group">
        {/* Add Task */}
        <button
          type="button"
          onClick={onAddTask}
          disabled={!onAddTask}
          title={t(locale, "addTask")}
          className="gantt-project-toolbar__button gantt-project-toolbar__button--icon"
        >
          <Plus className="gantt-project-toolbar__icon" aria-hidden />
        </button>

        {/* Delete Task */}
        <button
          type="button"
          onClick={onDeleteTask}
          disabled={!hasSelection}
          title={t(locale, "deleteSelectedTasks")}
          className="gantt-project-toolbar__button gantt-project-toolbar__button--icon"
        >
          <Trash2 className="gantt-project-toolbar__icon" aria-hidden />
        </button>

        {onOpenObservations && (
          <>
            <div className="gantt-project-toolbar__mini-divider" />
            <button
              type="button"
              onClick={onOpenObservations}
              disabled={!hasSelection}
              title="Observaciones de la actividad seleccionada"
              data-testid="open-observations"
              className="gantt-project-toolbar__button gantt-observations-button"
            >
              <MessageSquare className="gantt-project-toolbar__icon" aria-hidden />
              Observaciones
              {pendingObservationCount > 0 && (
                <span className="gantt-observations-button__count">
                  {pendingObservationCount}
                </span>
              )}
            </button>
          </>
        )}

        {(canUndo || canRedo) && (
          <>
            <div className="gantt-project-toolbar__mini-divider" />

            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title={`${t(locale, "undo")} (Ctrl+Z)`}
              className="gantt-project-toolbar__button gantt-project-toolbar__button--icon"
            >
              <Undo2 className="gantt-project-toolbar__icon" aria-hidden />
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title={`${t(locale, "redo")} (Ctrl+Shift+Z)`}
              className="gantt-project-toolbar__button gantt-project-toolbar__button--icon"
            >
              <Redo2 className="gantt-project-toolbar__icon" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div className="gantt-project-toolbar__divider" />

      {/* ─── 5. Baseline Tools (right) ─── */}
      <div className="gantt-project-toolbar__group gantt-project-toolbar__baseline-group">
        {/* Save Baseline */}
        <button
          type="button"
          onClick={onSaveBaseline}
          disabled={!onSaveBaseline}
          title={t(locale, "saveBaseline")}
          className="gantt-project-toolbar__button gantt-project-toolbar__button--text"
        >
          <Save className="gantt-project-toolbar__small-icon" aria-hidden />
          <span>
            {locale === "en" ? "Baseline" : "Línea base"}
          </span>
        </button>

        {/* Baseline Selector Dropdown */}
        {baselines.length > 0 && (
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setBaselineDropdownOpen((prev) => !prev)}
              title={t(locale, "selectBaseline")}
              className="gantt-project-toolbar__button gantt-project-toolbar__button--text gantt-project-toolbar__baseline-select"
              data-active={Boolean(activeBaselineId)}
              aria-expanded={baselineDropdownOpen}
            >
              <span className="truncate">
                {activeBaselineName ?? "Baseline"}
              </span>
              <ChevronDown className="gantt-project-toolbar__chevron" aria-hidden />
            </button>

            {baselineDropdownOpen && (
              <div className="gantt-project-toolbar__baseline-menu">
                {baselines.map((bl) => (
                  <button
                    key={bl.id}
                    type="button"
                    onClick={() => {
                      onSelectBaseline?.(bl.id);
                      setBaselineDropdownOpen(false);
                    }}
                    className="gantt-project-toolbar__baseline-option"
                    data-active={bl.id === activeBaselineId}
                  >
                    {bl.name}
                    {bl.id === activeBaselineId && (
                      <span className="gantt-project-toolbar__baseline-current">
                        ●
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
