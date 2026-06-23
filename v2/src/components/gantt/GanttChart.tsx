"use client";

import { useMemo } from "react";
import { GanttTask, GanttConfig } from "./types";
import {
  calculateViewport,
  generateTimelineColumns,
  getDatePosition,
  getTaskWidth,
  getDependencyEndpoints,
  isWeekend,
  isToday,
} from "./utils";
import { TaskBar, MilestoneBar, SummaryBar } from "./bars";
import TimescaleHeader from "./timescale/TimescaleHeader";
import DependencyArrow from "./arrows/DependencyArrow";
import { calculateArrowPath, getArrowDirection } from "./arrows/ArrowPath";
import { useCreateDependency } from "./interaction";
import type { DragState } from "./interaction/useDragBar";
import type { ResizeState } from "./interaction/useResizeBar";
import { GANTT_HEADER_HEIGHT, GANTT_ROW_HEIGHT } from "./layout";

interface GanttChartProps {
  tasks: GanttTask[];
  config?: Partial<GanttConfig>;
  scale?: "day" | "week" | "month";
  onTaskClick?: (task: GanttTask) => void;
  selectedTaskIds?: (string | number)[];
  onTaskSelect?: (taskId: string | number, ctrlKey: boolean) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onCreateDependency?: (
    fromId: string | number,
    toId: string | number,
    type: "FS" | "SS" | "FF" | "SF",
  ) => void;
  /** Drag-move interaction state (from useDragBar). */
  dragState?: DragState;
  /** Called when user mousedowns on a task bar to start dragging. */
  onDragStart?: (taskId: string | number, e: React.MouseEvent) => void;
  /** Resize interaction state (from useResizeBar). */
  resizeState?: ResizeState;
  /** Called when user mousedowns on a resize handle. */
  onResizeStart?: (
    taskId: string | number,
    edge: "left" | "right",
    originalDuration: number,
    e: React.MouseEvent,
  ) => void;
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

export default function GanttChart({
  tasks,
  config,
  scale = "day",
  selectedTaskIds,
  onTaskSelect,
  onCreateDependency,
  dragState,
  onDragStart,
  resizeState,
  onResizeStart,
}: GanttChartProps) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const { depState, onDepStart, onDepMove, onDepEnd } =
    useCreateDependency(onCreateDependency);

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

  return (
    <div className="gantt-chart">
      <div className="relative">
        <svg
          width={chartWidth}
          height={chartHeight + finalConfig.headerHeight}
          className="font-sans"
          onMouseMove={depState.isCreating ? onDepMove : undefined}
        >
          {/* Timeline Header */}
          <TimescaleHeader
            viewport={viewport}
            columns={columns}
            columnWidth={viewport.columnWidth}
            headerHeight={finalConfig.headerHeight}
          />

          {/* ── Layer 1: Today column highlight (bottom) ── */}
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

          {/* ── Layer 2: Weekend column shading (Sundays) ── */}
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

          {/* ── Layer 3: Horizontal row striping (AIA alternating) ── */}
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

          {/* ── Layer 4: Vertical grid lines ── */}
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

          {/* ── Layer 5: Today line (dashed) ── */}
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

          {/* ── Layer 6: Task Bars ── */}
          <g
            className="tasks"
            transform={`translate(0, ${finalConfig.headerHeight})`}
          >
            {tasks.map((task, i) => {
              const y = i * finalConfig.rowHeight;
              const x = getDatePosition(task.start, viewport);
              const width = getTaskWidth(task.start, task.finish, viewport);

              let color = finalConfig.normalColor;
              if (task.isCritical) color = finalConfig.criticalColor;
              if (task.isSummary) color = finalConfig.summaryColor;
              if (task.isMilestone) color = finalConfig.milestoneColor;

              return (
                <g
                  key={task.id}
                  className="task-row cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => onTaskSelect?.(task.id, e.ctrlKey || e.metaKey)}
                  onMouseUp={
                    depState.isCreating && !task.isMilestone && !task.isSummary
                      ? () => onDepEnd(task.id, "left")
                      : undefined
                  }
                >
                  {/* Task Bar or Milestone */}
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
                      onDepStart={onDepStart}
                      isDepHovered={depState.hoverTaskId === task.id}
                      viewport={viewport}
                      onDragStart={onDragStart}
                      dragState={dragState}
                      onResizeStart={onResizeStart}
                      resizeState={resizeState}
                    />
                  )}

                  {/* Task Label — milestones & summaries only (TaskBar renders its own) */}
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
          </g>

          {/* ── Layer 6b: Dependency Arrows ── */}
          <g
            className="dependencies"
            transform={`translate(0, ${finalConfig.headerHeight})`}
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

          {/* ── Layer 6c: Dependency creation preview arrow ── */}
          {depState.isCreating &&
            depState.fromTaskId !== null &&
            depState.fromEdge !== null && (() => {
              const fromTaskIndex = tasks.findIndex(
                (t) => t.id === depState.fromTaskId,
              );
              if (fromTaskIndex === -1) return null;
              const fromTask = tasks[fromTaskIndex];
              const fromX =
                depState.fromEdge === "right"
                  ? getDatePosition(fromTask.start, viewport) +
                    getTaskWidth(fromTask.start, fromTask.finish, viewport)
                  : getDatePosition(fromTask.start, viewport);
              const fromY =
                fromTaskIndex * finalConfig.rowHeight + finalConfig.rowHeight / 2;
              const toX = depState.mouseX;
              const toY = depState.mouseY - finalConfig.headerHeight;
              const type = depState.fromEdge === "right" ? "FS" : "SS";
              const d = calculateArrowPath(
                fromX,
                fromY,
                toX,
                toY,
                type,
                finalConfig.rowHeight,
              );
              const direction = getArrowDirection(fromX, fromY, toX, toY, type);
              const arrowSize = 8;
              const arrowPoints =
                direction === "right"
                  ? `${toX},${toY} ${toX - arrowSize},${toY - arrowSize / 2} ${toX - arrowSize},${toY + arrowSize / 2}`
                  : `${toX},${toY} ${toX + arrowSize},${toY - arrowSize / 2} ${toX + arrowSize},${toY + arrowSize / 2}`;

              return (
                <g
                  className="dep-preview"
                  transform={`translate(0, ${finalConfig.headerHeight})`}
                  pointerEvents="none"
                >
                  <path
                    d={d}
                    fill="none"
                    stroke="var(--aia-corp-main)"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    opacity={0.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={arrowPoints}
                    fill="var(--aia-corp-main)"
                    opacity={0.7}
                  />
                </g>
              );
            })()}

          {/* ── Layer 7: Today date label (top) ── */}
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
