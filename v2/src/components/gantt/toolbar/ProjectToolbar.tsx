"use client";

import BaselineMenu from "./BaselineMenu";
import {
  Undo2,
  Redo2,
  Plus,
  Trash2,
  FolderKanban,
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
  /**
   * Modo mirador (E51): se ve todo, no se toca nada.
   *
   * Es cortesía, no cerradura — la garantía vive en el servidor—, pero un botón
   * que no puede hacer nada es peor que un botón ausente.
   */
  readOnly?: boolean;
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
  onSaveBaseline?: (name: string) => void;
  onSelectBaseline?: (id: string) => void;
  onDeleteBaseline?: (id: string) => void;
  proposedBaselineName?: string;
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
  readOnly = false,
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
  onDeleteBaseline,
  proposedBaselineName = "Línea base 1",
  locale = "es",
}: ProjectToolbarProps) {
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
        {/* Agregar tarea */}
        <button
          type="button"
          data-testid="toolbar-add"
          onClick={onAddTask}
          disabled={readOnly || !onAddTask}
          title={t(locale, "addTask")}
          className="gantt-project-toolbar__button gantt-project-toolbar__button--icon"
        >
          <Plus className="gantt-project-toolbar__icon" aria-hidden />
        </button>

        {/* Separador: lo destructivo no puede estar pegado a lo frecuente (E34) */}
        <div className="gantt-project-toolbar__mini-divider" />

        {/* Eliminar tarea — con etiqueta de texto, no solo icono */}
        <button
          type="button"
          data-testid="toolbar-delete"
          onClick={onDeleteTask}
          disabled={readOnly || !hasSelection}
          title={t(locale, "deleteSelectedTasks")}
          className="gantt-project-toolbar__button gantt-project-toolbar__button--text gantt-project-toolbar__button--danger"
        >
          <Trash2 className="gantt-project-toolbar__icon" aria-hidden />
          <span>{locale === "en" ? "Delete" : "Eliminar"}</span>
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

        {/*
          Antes el grupo entero desaparecía sin historial, y la barra se
          reordenaba bajo el dedo del usuario. Ahora se apagan (E15).
        */}
        <div className="gantt-project-toolbar__mini-divider" />

            <button
              type="button"
              data-testid="toolbar-undo"
              onClick={onUndo}
              disabled={!canUndo}
              title={`${t(locale, "undo")} (Ctrl+Z)`}
              className="gantt-project-toolbar__button gantt-project-toolbar__button--icon"
            >
              <Undo2 className="gantt-project-toolbar__icon" aria-hidden />
            </button>

            <button
              type="button"
              data-testid="toolbar-redo"
              onClick={onRedo}
              disabled={!canRedo}
              title={`${t(locale, "redo")} (Ctrl+Shift+Z)`}
              className="gantt-project-toolbar__button gantt-project-toolbar__button--icon"
            >
              <Redo2 className="gantt-project-toolbar__icon" aria-hidden />
            </button>
          
      </div>

      <div className="gantt-project-toolbar__divider" />

      {/* ─── 5. Línea base (derecha) ─── */}
      <BaselineMenu
        baselines={baselines}
        activeBaselineId={activeBaselineId}
        proposedName={proposedBaselineName}
        onSave={(name) => onSaveBaseline?.(name)}
        onSelect={(id) => onSelectBaseline?.(id)}
        onDelete={(id) => onDeleteBaseline?.(id)}
      />
    </div>
  );
}
