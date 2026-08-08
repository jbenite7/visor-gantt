"use client";

import { useCallback, useMemo } from "react";
import type { GanttConfig, GanttScale, GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import type { BaselineVariance } from "@/lib/scheduling/baseline";
import {
  applyBaselineToTasks,
  compareWithBaseline,
} from "@/lib/scheduling/baseline";
import SplitPane from "@/components/gantt/SplitPane";
import GanttTable from "@/components/gantt/table/GanttTable";
import {
  calculateViewport,
  generateTimelineColumns,
  getDatePosition,
  getTaskWidth,
  getDependencyEndpoints,
  isWeekend,
  isToday,
} from "@/components/gantt/utils";
import TimescaleHeader from "@/components/gantt/timescale/TimescaleHeader";
import { TaskBar, MilestoneBar, SummaryBar, CriticalHatchDefs } from "@/components/gantt/bars";
import DependencyArrow from "@/components/gantt/arrows/DependencyArrow";
import { GANTT_HEADER_HEIGHT, GANTT_ROW_HEIGHT } from "@/components/gantt/layout";

interface TrackingGanttViewProps {
  tasks: GanttTask[];
  scale: GanttScale;
  selectedTaskIds?: (string | number)[];
  onTaskSelect?: (taskId: string | number, ctrlKey: boolean) => void;
  onTaskClick?: (task: GanttTask) => void;
  /**
   * Las líneas base son del proyecto, no de esta vista. Antes vivían en un
   * estado local que no se guardaba ni se compartía: cambiar de vista perdía
   * el trabajo (M13).
   */
  baselines: Baseline[];
  activeBaselineId?: string;
  onSaveBaseline: (name: string) => void;
  onSelectBaseline: (id: string | undefined) => void;
}

const DEFAULT_CONFIG: GanttConfig = {
  rowHeight: GANTT_ROW_HEIGHT,
  headerHeight: GANTT_HEADER_HEIGHT,
  todayLineColor: "var(--aia-corp-main)",
  criticalColor: "var(--aia-alert-main)",
  normalColor: "var(--aia-proj-main)",
  summaryColor: "var(--aia-arch-main)",
  milestoneColor: "var(--aia-warn-main)",
};

const BASELINE_BAR_HEIGHT_RATIO = 0.3;
const BASELINE_BAR_COLOR = "var(--aia-corp-mid)";
const BASELINE_BAR_OPACITY = 0.4;

const TOOLBAR_BTN_STYLE: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: "0.75rem",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  fontWeight: 600,
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--radius-lg)",
  background: "var(--color-bg-elevated)",
  color: "var(--color-text-strong)",
  boxShadow: "var(--shadow-sm)",
  cursor: "pointer",
  lineHeight: "1.4",
  whiteSpace: "nowrap",
};

const TOOLBAR_SELECT_STYLE: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "0.75rem",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--radius-lg)",
  background: "var(--color-bg-elevated)",
  color: "var(--color-text-strong)",
  cursor: "pointer",
  outline: "none",
};

/* ─── Internal: Tracking Gantt Chart ─── */

interface TrackingChartProps {
  tasks: GanttTask[];
  scale: GanttScale;
  config?: Partial<GanttConfig>;
  selectedTaskIds?: (string | number)[];
  onTaskSelect?: (taskId: string | number, ctrlKey: boolean) => void;
  onTaskClick?: (task: GanttTask) => void;
  variances?: BaselineVariance[];
  hasBaseline: boolean;
}

function TrackingGanttChart({
  tasks,
  scale,
  config,
  selectedTaskIds,
  onTaskSelect,
  onTaskClick,
  variances = [],
  hasBaseline,
}: TrackingChartProps) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const viewport = useMemo(
    () => calculateViewport(tasks, scale),
    [tasks, scale],
  );
  const columns = useMemo(() => generateTimelineColumns(viewport), [viewport]);
  const taskIndexById = useMemo(() => {
    const index = new Map<string | number, number>();
    tasks.forEach((task, rowIndex) => index.set(task.id, rowIndex));
    return index;
  }, [tasks]);

  const chartHeight = tasks.length * finalConfig.rowHeight;
  const chartWidth = columns.length * viewport.columnWidth;

  const todayX = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today >= viewport.startDate && today <= viewport.endDate) {
      return getDatePosition(today, viewport);
    }
    return null;
  }, [viewport]);

  // Build variance map for quick lookup
  const varianceMap = useMemo(() => {
    const map = new Map<string | number, BaselineVariance>();
    for (const v of variances) {
      map.set(v.taskId, v);
    }
    return map;
  }, [variances]);

  /** Resolve the bar color based on schedule status. */
  function getBarColor(task: GanttTask): string {
    if (task.isSummary) return finalConfig.summaryColor;
    if (task.isMilestone) return finalConfig.milestoneColor;

    if (hasBaseline) {
      const v = varianceMap.get(task.id);
      if (v) {
        if (v.isBehind) return "var(--aia-alert-main)";
        if (v.isAhead) return "var(--aia-arch-main)";
      }
    }

    if (task.isCritical) return finalConfig.criticalColor;
    return finalConfig.normalColor;
  }

  return (
    <div className="gantt-chart">
      <div className="relative">
        <svg
          width={chartWidth}
          height={chartHeight + finalConfig.headerHeight}
          className="font-sans"
        >
          <CriticalHatchDefs />
          {/* Timeline Header */}
          <TimescaleHeader
            viewport={viewport}
            columns={columns}
            columnWidth={viewport.columnWidth}
            headerHeight={finalConfig.headerHeight}
          />

          {/* Layer 1: Today column highlight */}
          <g className="today-column-highlight" pointerEvents="none">
            {columns.map((date, i) =>
              isToday(date) ? (
                <rect
                  key={`today-col-${i}`}
                  x={i * viewport.columnWidth}
                  y={0}
                  width={viewport.columnWidth}
                  height={chartHeight + finalConfig.headerHeight}
                  fill="var(--aia-proj-xlight)"
                  opacity={0.3}
                />
              ) : null,
            )}
          </g>

          {/* Layer 2: Weekend shading */}
          <g className="weekend-shading" pointerEvents="none">
            {columns.map((date, i) =>
              isWeekend(date) ? (
                <rect
                  key={`weekend-${i}`}
                  x={i * viewport.columnWidth}
                  y={finalConfig.headerHeight}
                  width={viewport.columnWidth}
                  height={chartHeight}
                  fill="rgba(0,0,0,0.08)"
                />
              ) : null,
            )}
          </g>

          {/* Layer 3: Row striping */}
          <g className="row-stripes" pointerEvents="none">
            {tasks.map((_, i) => (
              <rect
                key={`stripe-${i}`}
                x={0}
                y={i * finalConfig.rowHeight + finalConfig.headerHeight}
                width={chartWidth}
                height={finalConfig.rowHeight}
                fill={i % 2 === 0 ? "var(--aia-alabaster)" : "var(--aia-linen)"}
              />
            ))}
          </g>

          {/* Layer 4: Grid lines */}
          <g className="grid" pointerEvents="none">
            {columns.map((_, i) => (
              <line
                key={i}
                x1={i * viewport.columnWidth}
                y1={finalConfig.headerHeight}
                x2={i * viewport.columnWidth}
                y2={chartHeight + finalConfig.headerHeight}
                stroke="var(--aia-corp-mid)"
                strokeWidth={1}
                opacity={0.2}
              />
            ))}
          </g>

          {/* Layer 5: Today line */}
          {todayX !== null && (
            <line
              x1={todayX}
              y1={0}
              x2={todayX}
              y2={chartHeight + finalConfig.headerHeight}
              stroke={finalConfig.todayLineColor}
              strokeWidth={2}
              strokeDasharray="5,5"
              pointerEvents="none"
            />
          )}

          {/* ── Tasks group ── */}
          <g
            className="tasks"
            transform={`translate(0, ${finalConfig.headerHeight})`}
          >
            {/* Layer 6a: Baseline bars (BEHIND actual bars) */}
            {hasBaseline && (
              <g className="baseline-bars" pointerEvents="none">
                {tasks.map((task, i) => {
                  if (!task.baselineStart || !task.baselineFinish) return null;
                  const y = i * finalConfig.rowHeight;
                  const x = getDatePosition(task.baselineStart, viewport);
                  const width = getTaskWidth(
                    task.baselineStart,
                    task.baselineFinish,
                    viewport,
                  );
                  const barHeight = finalConfig.rowHeight * BASELINE_BAR_HEIGHT_RATIO;
                  const barY = y + (finalConfig.rowHeight - barHeight) / 2;

                  return (
                    <rect
                      key={`baseline-${task.id}`}
                      x={x}
                      y={barY}
                      width={width}
                      height={barHeight}
                      fill={BASELINE_BAR_COLOR}
                      opacity={BASELINE_BAR_OPACITY}
                      rx={2}
                    />
                  );
                })}
              </g>
            )}

            {/* Layer 6b: Actual task bars */}
            {tasks.map((task, i) => {
              const y = i * finalConfig.rowHeight;
              const x = getDatePosition(task.start, viewport);
              const width = getTaskWidth(task.start, task.finish, viewport);
              const color = getBarColor(task);

              return (
                <g
                  key={task.id}
                  className="task-row cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    onTaskSelect?.(task.id, e.ctrlKey || e.metaKey);
                    onTaskClick?.(task);
                  }}
                >
                  {task.isMilestone ? (
                    <MilestoneBar
                      task={task}
                      x={x}
                      y={y}
                      height={finalConfig.rowHeight}
                      color={color}
                      isSelected={selectedTaskIds?.includes(task.id) ?? false}
                    />
                  ) : task.isSummary ? (
                    <SummaryBar
                      task={task}
                      x={x}
                      y={y}
                      width={width}
                      height={finalConfig.rowHeight}
                      color={color}
                      isSelected={selectedTaskIds?.includes(task.id) ?? false}
                    />
                  ) : (
                    <TaskBar
                      task={task}
                      x={x}
                      y={y}
                      width={width}
                      height={finalConfig.rowHeight}
                      color={color}
                      isSelected={selectedTaskIds?.includes(task.id) ?? false}
                    />
                  )}

                  {/* Task label for milestones & summaries */}
                  {(task.isMilestone || task.isSummary) && (
                    <text
                      x={x + 5}
                      y={y + finalConfig.rowHeight / 2}
                      dominantBaseline="middle"
                      fill="var(--aia-corp-dark)"
                      fontSize={12}
                      className="pointer-events-none"
                    >
                      {task.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Layer 6c: Variance text */}
            {hasBaseline && (
              <g className="variance-text" pointerEvents="none">
                {tasks.map((task, i) => {
                  const v = varianceMap.get(task.id);
                  if (!v || v.isOnSchedule) return null;
                  if (task.isSummary || task.isMilestone) return null;

                  const y = i * finalConfig.rowHeight;
                  const finishX = getDatePosition(task.finish, viewport);
                  const varianceDays = v.finishVariance;
                  const label =
                    varianceDays > 0 ? `+${varianceDays}d` : `${varianceDays}d`;
                  const color =
                    varianceDays > 0
                      ? "var(--aia-alert-main)"
                      : "var(--aia-proj-main)";

                  return (
                    <text
                      key={`variance-${task.id}`}
                      x={finishX + 4}
                      y={y + finalConfig.rowHeight / 2}
                      dominantBaseline="middle"
                      fill={color}
                      fontSize={10}
                      fontWeight={600}
                    >
                      {label}
                    </text>
                  );
                })}
              </g>
            )}

            {/* Layer 6d: Dependency arrows */}
            <g
              className="dependencies"
              pointerEvents="none"
            >
              {tasks.map((successor) =>
                successor.dependencies.map((dep) => {
                  const predIndex = taskIndexById.get(dep.from);
                  const succIndex = taskIndexById.get(dep.to);
                  if (predIndex === undefined || succIndex === undefined) {
                    return null;
                  }
                  const predecessor = tasks[predIndex];
                  const endpoints = getDependencyEndpoints(
                    predecessor,
                    tasks[succIndex],
                    viewport,
                    predIndex,
                    succIndex,
                    finalConfig.rowHeight,
                    dep.type,
                  );
                  return (
                    <DependencyArrow
                      key={`${dep.from}-${dep.to}-${dep.type}`}
                      from={{
                        x: endpoints.fromX,
                        y: endpoints.fromY,
                        isCritical: predecessor.isCritical,
                      }}
                      to={{ x: endpoints.toX, y: endpoints.toY }}
                      type={dep.type}
                      lag={dep.lag}
                      rowHeight={finalConfig.rowHeight}
                    />
                  );
                }),
              )}
            </g>
          </g>

          {/* Layer 7: Today date label */}
          {todayX !== null && (
            <g className="today-label" pointerEvents="none">
              <rect
                x={todayX - 25}
                y={2}
                width={50}
                height={14}
                fill="var(--aia-alabaster)"
                rx={3}
              />
              <text
                x={todayX}
                y={15}
                textAnchor="middle"
                fill="var(--aia-corp-dark)"
                fontSize={10}
                fontWeight={600}
              >
                {new Date().toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

/* ─── Main: Tracking Gantt View ─── */

/**
 * TrackingGanttView — Gantt chart with baseline overlay for schedule variance.
 *
 * Layout: SplitPane with GanttTable (left) and TrackingGanttChart (right).
 * Toolbar: Guardar línea base, Select Baseline dropdown.
 * When a baseline is selected, baseline bars appear behind actual bars
 * with variance text and schedule-based color coding.
 */
export default function TrackingGanttView({
  tasks,
  scale,
  selectedTaskIds,
  onTaskSelect,
  onTaskClick,
  baselines,
  activeBaselineId,
  onSaveBaseline,
  onSelectBaseline,
}: TrackingGanttViewProps) {
  const activeBaseline = useMemo(
    () => baselines.find((b) => b.id === activeBaselineId) ?? null,
    [baselines, activeBaselineId],
  );

  const handleSaveBaseline = useCallback(() => {
    onSaveBaseline(`Línea base ${baselines.length + 1}`);
  }, [baselines.length, onSaveBaseline]);

  // Apply baseline dates to tasks
  const displayTasks = useMemo(() => {
    if (!activeBaseline) return tasks;
    return applyBaselineToTasks(tasks, activeBaseline);
  }, [tasks, activeBaseline]);

  // Calculate variances
  const variances = useMemo(() => {
    if (!activeBaseline) return [];
    return compareWithBaseline(tasks, activeBaseline);
  }, [tasks, activeBaseline]);

  return (
    <div
      data-testid="tracking-gantt-view"
      className="apple-module flex h-full flex-col"
    >
      {/* ── Baseline Toolbar ── */}
      <div className="apple-subtoolbar">
        <button
          data-testid="save-baseline-btn"
          onClick={handleSaveBaseline}
          style={TOOLBAR_BTN_STYLE}
        >
          Guardar línea base
        </button>

        {baselines.length > 0 && (
          <>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontWeight: 500,
              }}
            >
              Línea base:
            </span>
            <select
              data-testid="baseline-select"
              value={activeBaselineId ?? ""}
              onChange={(e) => onSelectBaseline(e.target.value || undefined)}
              style={TOOLBAR_SELECT_STYLE}
            >
              <option value="">Ninguna</option>
              {baselines.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </>
        )}

        {activeBaseline && (
          <span
            data-testid="baseline-variance-summary"
            style={{
              fontSize: "0.6875rem",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
            }}
          >
            {activeBaseline.tasks.length} actividades &middot;{" "}
            {variances.filter((v) => v.isBehind).length} atrasadas,{" "}
            {variances.filter((v) => v.isAhead).length} adelantadas,{" "}
            {variances.filter((v) => v.isOnSchedule).length} en fecha
          </span>
        )}
      </div>

      {/* ── SplitPane: Table + Chart ── */}
      <div className="flex-1 min-h-0">
        <SplitPane
          defaultSplit={35}
          left={
            <GanttTable
              tasks={displayTasks}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={onTaskSelect}
            />
          }
          right={
            <TrackingGanttChart
              tasks={displayTasks}
              scale={scale}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={onTaskSelect}
              onTaskClick={onTaskClick}
              variances={variances}
              hasBaseline={activeBaseline !== null}
            />
          }
        />
      </div>
    </div>
  );
}
