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
} from "lucide-react";
import ViewSwitcher, { type ViewType } from "./ViewSwitcher";

/* ── Types ── */

type ZoomScale = "day" | "week" | "month";

interface Baseline {
  id: string;
  name: string;
}

interface ZoomButton {
  scale: ZoomScale;
  label: string;
}

const ZOOM_BUTTONS: ZoomButton[] = [
  { scale: "day", label: "Día" },
  { scale: "week", label: "Semana" },
  { scale: "month", label: "Mes" },
];

interface ProjectToolbarProps {
  /* ── View tabs ── */
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  /* ── Zoom ── */
  scale: ZoomScale;
  onScaleChange: (scale: ZoomScale) => void;
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
  /* ── Editing Tools ── */
  onAddTask?: () => void;
  onDeleteTask?: () => void;
  hasSelection: boolean;
  /* ── Baseline Tools ── */
  baselines?: Baseline[];
  activeBaselineId?: string;
  onSaveBaseline?: () => void;
  onSelectBaseline?: (id: string) => void;
}

/* ── Shared toolbar button style ── */

const toolbarBtnStyle = (active = false, disabled = false): React.CSSProperties => ({
  background: active ? "var(--aia-corp-main)" : "transparent",
  color: "#ffffff",
  opacity: disabled ? 0.4 : 1,
  border: "none",
  borderRadius: "var(--radius-sm)",
  cursor: disabled ? "not-allowed" : "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px",
  transition: "background 150ms",
});

const toolbarBtnEnter = (e: React.MouseEvent<HTMLButtonElement>, disabled: boolean) => {
  if (!disabled) {
    e.currentTarget.style.background = "var(--aia-corp-main)";
  }
};

const toolbarBtnLeave = (e: React.MouseEvent<HTMLButtonElement>, active: boolean) => {
  e.currentTarget.style.background = active ? "var(--aia-corp-main)" : "transparent";
};

const sectionDivider: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "rgba(255, 255, 255, 0.2)",
  margin: "0 8px",
  flexShrink: 0,
};

/* ── Format date for toolbar display ── */
function formatDateShort(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ───────────────────── Component ───────────────────── */

export default function ProjectToolbar({
  activeView,
  onViewChange,
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
  onAddTask,
  onDeleteTask,
  hasSelection,
  baselines = [],
  activeBaselineId,
  onSaveBaseline,
  onSelectBaseline,
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
      className="flex items-center shrink-0 w-full overflow-x-auto"
      style={{
        background: "var(--aia-corp-dark)",
        borderBottom: "2px solid var(--aia-corp-main)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        minHeight: 44,
      }}
    >
      {/* ─── 1. Project Info (left) ─── */}
      <div
        className="flex items-center gap-2 pl-4 pr-3"
        style={{ minWidth: 0, maxWidth: 280 }}
      >
        <FolderKanban
          size={18}
          style={{ color: "var(--aia-corp-light)", flexShrink: 0 }}
        />
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-montserrat)",
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              lineHeight: 1.2,
            }}
          >
            {projectName || "Proyecto sin nombre"}
          </span>
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: 11,
              color: "var(--aia-corp-light)",
              lineHeight: 1.3,
            }}
          >
            {projectStart && projectFinish
              ? `${formatDateShort(projectStart)} — ${formatDateShort(projectFinish)}`
              : "Sin fechas"}{" "}
            · {taskCount} {taskCount === 1 ? "tarea" : "tareas"}
          </span>
        </div>
      </div>

      <div style={sectionDivider} />

      {/* ─── 2. Zoom Controls (center-left) ─── */}
      <div className="flex items-center gap-1.5 px-3">
        <span
          className="text-xs mr-1 opacity-70"
          style={{
            color: "rgba(255,255,255,0.7)",
            fontFamily: "var(--font-inter)",
          }}
        >
          Zoom:
        </span>
        {ZOOM_BUTTONS.map((btn) => (
          <button
            key={btn.scale}
            onClick={() => onScaleChange(btn.scale)}
            className="px-3 py-1 rounded text-sm font-medium transition-colors"
            style={{
              background:
                scale === btn.scale
                  ? "var(--aia-corp-main)"
                  : "var(--aia-corp-mid)",
              color: "#ffffff",
              fontFamily: "var(--font-montserrat)",
              fontSize: 12,
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              if (scale !== btn.scale) {
                e.currentTarget.style.background = "var(--aia-corp-main)";
              }
            }}
            onMouseLeave={(e) => {
              if (scale !== btn.scale) {
                e.currentTarget.style.background = "var(--aia-corp-mid)";
              }
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div style={sectionDivider} />

      {/* ─── 4. Editing Tools (center-right) ─── */}
      <div className="flex items-center gap-1 px-2">
        {/* Add Task */}
        <button
          onClick={onAddTask}
          disabled={!onAddTask}
          title="Agregar tarea"
          style={toolbarBtnStyle(false, !onAddTask)}
          onMouseEnter={(e) => toolbarBtnEnter(e, !onAddTask)}
          onMouseLeave={(e) => toolbarBtnLeave(e, false)}
        >
          <Plus size={16} />
        </button>

        {/* Delete Task */}
        <button
          onClick={onDeleteTask}
          disabled={!hasSelection}
          title="Eliminar tarea(s) seleccionada(s)"
          style={toolbarBtnStyle(false, !hasSelection)}
          onMouseEnter={(e) => toolbarBtnEnter(e, !hasSelection)}
          onMouseLeave={(e) => toolbarBtnLeave(e, false)}
        >
          <Trash2 size={16} />
        </button>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 18,
            background: "rgba(255,255,255,0.15)",
            margin: "0 4px",
          }}
        />

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Deshacer (Ctrl+Z)"
          style={toolbarBtnStyle(false, !canUndo)}
          onMouseEnter={(e) => toolbarBtnEnter(e, !canUndo)}
          onMouseLeave={(e) => toolbarBtnLeave(e, false)}
        >
          <Undo2 size={16} />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Rehacer (Ctrl+Shift+Z)"
          style={toolbarBtnStyle(false, !canRedo)}
          onMouseEnter={(e) => toolbarBtnEnter(e, !canRedo)}
          onMouseLeave={(e) => toolbarBtnLeave(e, false)}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div style={sectionDivider} />

      {/* ─── 5. Baseline Tools (right) ─── */}
      <div className="flex items-center gap-1.5 pl-2 pr-4 ml-auto">
        {/* Save Baseline */}
        <button
          onClick={onSaveBaseline}
          disabled={!onSaveBaseline}
          title="Guardar Baseline"
          style={{
            ...toolbarBtnStyle(false, !onSaveBaseline),
            gap: 4,
            padding: "5px 10px",
          }}
          onMouseEnter={(e) => toolbarBtnEnter(e, !onSaveBaseline)}
          onMouseLeave={(e) => toolbarBtnLeave(e, false)}
        >
          <Save size={14} />
          <span
            style={{
              fontFamily: "var(--font-montserrat)",
              fontSize: 11,
              fontWeight: 600,
              color: "#ffffff",
              whiteSpace: "nowrap",
            }}
          >
            Baseline
          </span>
        </button>

        {/* Baseline Selector Dropdown */}
        {baselines.length > 0 && (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setBaselineDropdownOpen((prev) => !prev)}
              title="Seleccionar baseline activa"
              style={{
                background: activeBaselineId ? "var(--aia-corp-main)" : "transparent",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                fontFamily: "var(--font-inter)",
                fontSize: 11,
                maxWidth: 140,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
            >
              <span className="truncate">
                {activeBaselineName ?? "Baseline"}
              </span>
              <ChevronDown size={12} style={{ flexShrink: 0 }} />
            </button>

            {baselineDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  minWidth: 160,
                  background: "#ffffff",
                  border: "1px solid var(--gray-200)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                {baselines.map((bl) => (
                  <button
                    key={bl.id}
                    onClick={() => {
                      onSelectBaseline?.(bl.id);
                      setBaselineDropdownOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      background: bl.id === activeBaselineId ? "var(--aia-corp-xlight)" : "transparent",
                      color: "var(--gray-800)",
                      fontFamily: "var(--font-inter)",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "background 100ms",
                    }}
                    onMouseEnter={(e) => {
                      if (bl.id !== activeBaselineId) {
                        e.currentTarget.style.background = "var(--gray-100)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (bl.id !== activeBaselineId) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {bl.name}
                    {bl.id === activeBaselineId && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: "var(--aia-corp-main)",
                          fontWeight: 600,
                          fontSize: 10,
                        }}
                      >
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
