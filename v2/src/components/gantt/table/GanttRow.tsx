"use client";

import type { GanttTask, GanttDependency } from "@/components/gantt/types";
import { GANTT_ROW_HEIGHT } from "../layout";
import WBSExpand from "./WBSExpand";
import EditableCell from "./EditableCell";
import { createProjectDate, formatProjectDate, toDateInputValue } from "@/lib/date/projectDate";

interface GanttRowProps {
  task: GanttTask;
  index: number;
  onSelect?: (taskId: string | number, ctrlKey: boolean) => void;
  isSelected: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onUpdateTask?: (
    taskId: string | number,
    field: string,
    value: unknown
  ) => void;
  budgetedCost?: number;
  actualCost?: number;
  variance?: number;
}

/** Format a Date to DD/MM/YYYY for Colombian locale. */
function formatDate(date: Date): string {
  return formatProjectDate(date);
}

/** Convert a Date to yyyy-mm-dd string for <input type="date">. */
function toISODate(date: Date): string {
  return toDateInputValue(date);
}

/** Convert yyyy-mm-dd string back to a Date (local time, no timezone shift). */
function fromISODate(iso: string): Date {
  return createProjectDate(iso);
}

/** Format dependencies array into compact string like "1FS,2SS+5d". */
function formatDependencies(dependencies: GanttDependency[]): string {
  if (dependencies.length === 0) return "";
  return dependencies
    .map((dep) => {
      const lag = dep.lag ? `${dep.lag > 0 ? "+" : ""}${dep.lag}d` : "";
      return `${dep.from}${dep.type}${lag}`;
    })
    .join(", ");
}

/**
 * Parse a predecessor string like "1FS,2SS+5d,3FF-2d" into GanttDependency[].
 *
 * Format per entry: <taskId><type>[+/-<lag>d]
 * - type: FS, SS, FF, SF
 * - lag: optional integer days (e.g. +5, -2)
 */
function parsePredecessors(
  raw: string,
  targetId: string | number
): GanttDependency[] {
  if (!raw.trim()) return [];

  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const result: GanttDependency[] = [];

  for (const entry of parts) {
    const match = entry.match(
      /^(\w+)(FS|SS|FF|SF)([+-]\d+)?d?$/i
    );
    if (!match) continue;

    const from = isNaN(Number(match[1])) ? match[1] : Number(match[1]);
    const type = match[2].toUpperCase() as GanttDependency["type"];
    const lag = match[3] ? parseInt(match[3], 10) : undefined;

    result.push({ from, to: targetId, type, lag });
  }

  return result;
}

/** Shared cell style for consistent alignment and padding. */
const cellStyle: React.CSSProperties = {
  padding: "0 10px",
  fontSize: "0.8125rem",
  lineHeight: "1.4",
  height: `${GANTT_ROW_HEIGHT}px`,
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
};

const FORMAT_CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

/**
 * Single row in the Gantt entry table.
 * Handles WBS indentation, summary/milestone styling, row striping, selection.
 * Inline editing for: Name, Duration, Start, Finish, Predecessors, % Complete.
 */
export default function GanttRow({
  task,
  index,
  onSelect,
  isSelected,
  isExpanded = true,
  onToggleExpand,
  onUpdateTask,
  budgetedCost,
  actualCost,
  variance,
}: GanttRowProps) {
  // ── Row background resolution ──
  // Priority: selected > summary > stripe
  let rowBg: string;
  if (isSelected) {
    rowBg = "var(--aia-proj-xlight)";
  } else if (task.isSummary) {
    rowBg = "var(--aia-corp-xlight)";
  } else {
    rowBg = index % 2 === 0 ? "var(--aia-alabaster)" : "var(--aia-linen)";
  }

  const rowStyle: React.CSSProperties = {
    background: rowBg,
    borderLeft: isSelected
      ? "3px solid var(--aia-proj-main)"
      : "3px solid transparent",
    cursor: "pointer",
    transition: "background 120ms ease",
    height: `${GANTT_ROW_HEIGHT}px`,
  };

  // ── Name cell: milestone icon + critical color ──
  const namePrefix = task.isMilestone ? "◆ " : "";
  const nameColor = task.isCritical
    ? "var(--aia-alert-main)"
    : task.isSummary
      ? "var(--gray-900)"
      : "inherit";

  const nameCellStyle: React.CSSProperties = {
    ...cellStyle,
    paddingLeft: "10px",
    fontWeight: task.isSummary ? 600 : 400,
    color: nameColor,
  };

  // ── Critical badge ──
  const criticalCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: "center",
    color: task.isCritical ? "var(--aia-alert-main)" : "inherit",
    fontWeight: task.isCritical ? 600 : 400,
  };

  // ── Progress display ──
  const progress = task.percentComplete ?? task.progress;

  // ── Editable: should we wrap cells in EditableCell? ──
  const canEdit = !!onUpdateTask;

  return (
    <tr
      data-testid="gantt-row"
      data-task-id={task.id}
      style={rowStyle}
      onClick={(e) => onSelect?.(task.id, e.ctrlKey || e.metaKey)}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.background =
            "var(--aia-corp-xlight)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.background = rowBg;
        }
      }}
    >
      {/* ID — non-editable */}
      <td style={{ ...cellStyle, textAlign: "right" }}>{task.id}</td>

      {/* WBS — non-editable */}
      <td style={cellStyle}>{task.wbs ?? ""}</td>

      {/* Name (with WBS expand toggle + milestone icon) — editable */}
      <td style={nameCellStyle}>
        {canEdit ? (
          <EditableCell
            value={`${namePrefix}${task.name}`}
            type="text"
            align="left"
            readOnly={false}
            prefix={
              <WBSExpand
                isExpanded={isExpanded}
                onClick={onToggleExpand}
                level={task.outlineLevel}
                isSummary={task.isSummary}
              />
            }
            onCommit={(val) => onUpdateTask!(task.id, "name", val)}
          />
        ) : (
          <>
            <WBSExpand
              isExpanded={isExpanded}
              onClick={onToggleExpand}
              level={task.outlineLevel}
              isSummary={task.isSummary}
            />
            <span>
              {namePrefix}
              {task.name}
            </span>
          </>
        )}
      </td>

      {/* Duration — editable (number) */}
      <td style={{ ...cellStyle, textAlign: "right" }}>
        {canEdit ? (
          <EditableCell
            value={task.duration}
            type="number"
            align="right"
            onCommit={(val) => {
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) {
                onUpdateTask!(task.id, "duration", num);
              }
            }}
          />
        ) : (
          <>{task.duration}d</>
        )}
      </td>

      {/* Start — editable (date) */}
      <td style={cellStyle}>
        {canEdit ? (
          <EditableCell
            value={toISODate(task.start)}
            type="date"
            align="left"
            onCommit={(val) => {
              const d = fromISODate(val);
              if (!isNaN(d.getTime())) {
                onUpdateTask!(task.id, "start", d);
              }
            }}
          />
        ) : (
          <>{formatDate(task.start)}</>
        )}
      </td>

      {/* Finish — editable (date) */}
      <td style={cellStyle}>
        {canEdit ? (
          <EditableCell
            value={toISODate(task.finish)}
            type="date"
            align="left"
            onCommit={(val) => {
              const d = fromISODate(val);
              if (!isNaN(d.getTime())) {
                onUpdateTask!(task.id, "finish", d);
              }
            }}
          />
        ) : (
          <>{formatDate(task.finish)}</>
        )}
      </td>

      {/* Predecessors — editable (text, parsed on commit) */}
      <td style={cellStyle}>
        {canEdit ? (
          <EditableCell
            value={formatDependencies(task.dependencies)}
            type="text"
            align="left"
            onCommit={(val) => {
              const deps = parsePredecessors(val, task.id);
              onUpdateTask!(task.id, "dependencies", deps);
            }}
          />
        ) : (
          <>{formatDependencies(task.dependencies)}</>
        )}
      </td>

      {/* % Complete — editable (slider) */}
      <td style={{ ...cellStyle, textAlign: "right" }}>
        {canEdit ? (
          <EditableCell
            value={progress}
            type="slider"
            align="right"
            onCommit={(val) => {
              const num = parseInt(val, 10);
              if (!isNaN(num) && num >= 0 && num <= 100) {
                onUpdateTask!(task.id, "progress", num);
              }
            }}
          />
        ) : (
          <>{progress}%</>
        )}
      </td>

      {/* Critical — non-editable */}
      <td style={criticalCellStyle}>{task.isCritical ? "Yes" : ""}</td>

      {/* Budgeted Cost */}
      <td style={{ ...cellStyle, textAlign: "right" }}>
        {budgetedCost !== undefined && budgetedCost > 0
          ? FORMAT_CURRENCY.format(budgetedCost)
          : "\u2014"}
      </td>

      {/* Actual Cost */}
      <td style={{ ...cellStyle, textAlign: "right" }}>
        {actualCost !== undefined && actualCost > 0
          ? FORMAT_CURRENCY.format(actualCost)
          : "\u2014"}
      </td>

      {/* Variance */}
      <td
        style={{
          ...cellStyle,
          textAlign: "right",
          color:
            variance !== undefined && variance !== 0
              ? variance > 0
                ? "var(--aia-proj-main)"
                : "var(--aia-alert-main)"
              : undefined,
          fontWeight: variance !== undefined && variance !== 0 ? 600 : 400,
        }}
      >
        {variance !== undefined ? FORMAT_CURRENCY.format(variance) : "\u2014"}
      </td>
    </tr>
  );
}
