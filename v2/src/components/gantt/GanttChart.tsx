"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GanttTask, GanttConfig, type GanttScale } from "./types";
import { DEFAULT_PROJECT_CALENDAR, type ProjectCalendar } from "@/types/calendar";
import { isProjectWorkingDay } from "@/lib/scheduling/projectCalendar";
import {
  calculateViewport,
  generateTimelineColumns,
  getDatePosition,
  getTaskWidth,
  getDependencyEndpoints,
} from "./utils";
import { TaskBar, MilestoneBar, SummaryBar, CriticalHatchDefs } from "./bars";
import {
  observationBadgeFor,
  type Observation,
} from "@/lib/observations/observations";
import TimescaleHeader from "./timescale/TimescaleHeader";
import DependencyArrow from "./arrows/DependencyArrow";
import { calculateArrowPath, getArrowDirection } from "./arrows/ArrowPath";
import { useCreateDependency } from "./interaction";
import { depTypeLabel, inferDepType } from "./interaction/useCreateDependency";
import type { DragState } from "./interaction/useDragBar";
import type { ResizeState } from "./interaction/useResizeBar";
import {
  GANTT_HEADER_HEIGHT,
  GANTT_MILESTONE_SIZE,
  GANTT_ROW_HEIGHT,
} from "./layout";
import { resolveTaskLabelPlacement } from "./labelPolicy";

interface GanttChartProps {
  tasks: GanttTask[];
  /** Observaciones de obra, para pintar el distintivo sobre cada barra. */
  observations?: Observation[];
  config?: Partial<GanttConfig>;
  calendar?: ProjectCalendar;
  scale?: GanttScale;
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
  /** Dibuja la línea base activa como barra fantasma detrás de cada barra. */
  showBaseline?: boolean;
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

const BASELINE_BAR_HEIGHT = 6;
const BASELINE_BAR_OFFSET_Y = 4;

const LABEL_HEIGHT = 20;
const LABEL_GAP = 6;
const LABEL_PADDING_X = 6;
const SUMMARY_LABEL_OFFSET_X = 4;
const MIN_FITTED_COLUMN_WIDTH = 1;

function labelWidth(estimatedWidth: number): number {
  return Math.max(estimatedWidth, 28);
}

function fitsWithinChart(x: number, width: number, chartWidth: number): boolean {
  return x >= 0 && x + width <= chartWidth;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function GanttChart({
  tasks,
  observations,
  config,
  calendar = DEFAULT_PROJECT_CALENDAR,
  scale = "day",
  selectedTaskIds,
  onTaskSelect,
  onCreateDependency,
  dragState,
  onDragStart,
  resizeState,
  onResizeStart,
  showBaseline = false,
}: GanttChartProps) {
  const { depState, onDepStart, onDepMove, onDepEnd, onDepHoverEdge } =
    useCreateDependency(onCreateDependency);
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientToday, setClientToday] = useState<Date | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setClientToday(today);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const updateWidth = () => {
      setContainerWidth(Math.floor(element.getBoundingClientRect().width));
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const viewport = useMemo(
    () => calculateViewport(tasks, scale),
    [tasks, scale],
  );
  const columns = useMemo(() => generateTimelineColumns(viewport), [viewport]);
  const fittedViewport = useMemo(() => {
    if (containerWidth <= 0 || columns.length === 0) return viewport;
    const fittedColumnWidth = Math.min(
      viewport.columnWidth,
      Math.max(MIN_FITTED_COLUMN_WIDTH, containerWidth / columns.length),
    );
    return { ...viewport, columnWidth: fittedColumnWidth };
  }, [columns.length, containerWidth, viewport]);
  const taskIndexById = useMemo(() => {
    const index = new Map<string | number, number>();
    tasks.forEach((task, rowIndex) => index.set(task.id, rowIndex));
    return index;
  }, [tasks]);

  const chartHeight = tasks.length * finalConfig.rowHeight;
  const chartWidth = columns.length * fittedViewport.columnWidth;

  const todayX = useMemo(() => {
    if (!clientToday) return null;
    if (clientToday >= fittedViewport.startDate && clientToday <= fittedViewport.endDate) {
      return getDatePosition(clientToday, fittedViewport);
    }
    return null;
  }, [clientToday, fittedViewport]);
  const todayLabel = clientToday?.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div ref={containerRef} className="gantt-chart">
      <div className="relative">
        <svg
          width={chartWidth}
          height={chartHeight + finalConfig.headerHeight}
          className="font-sans"
          overflow="hidden"
          onMouseMove={depState.isCreating ? onDepMove : undefined}
        >
          <CriticalHatchDefs />
          {/* Timeline Header */}
          <TimescaleHeader
            viewport={fittedViewport}
            columns={columns}
            columnWidth={fittedViewport.columnWidth}
            headerHeight={finalConfig.headerHeight}
          />

          {/* ── Layer 1: Today column highlight (bottom) ── */}
          <g className="today-column-highlight" pointerEvents="none">
            {columns.map((date, i) =>
              clientToday && isSameDay(date, clientToday) ? (
                <rect
                  key={`today-col-${i}`}
                  x={i * fittedViewport.columnWidth}
                  y={0}
                  width={fittedViewport.columnWidth}
                  height={chartHeight + finalConfig.headerHeight}
                  fill="var(--aia-proj-xlight)"
                  opacity={0.3}
                />
              ) : null,
            )}
          </g>

          {/* ── Layer 2: Non-working column shading ── */}
          <g className="weekend-shading" pointerEvents="none">
            {columns.map((date, i) =>
              !isProjectWorkingDay(date, calendar) ? (
                <rect
                  key={`weekend-${i}`}
                  data-non-working-date={date.toISOString().split("T")[0]}
                  x={i * fittedViewport.columnWidth}
                  y={finalConfig.headerHeight}
                  width={fittedViewport.columnWidth}
                  height={chartHeight}
                  fill="var(--gantt-chart-nonworking-fill)"
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
                x1={i * fittedViewport.columnWidth}
                y1={finalConfig.headerHeight}
                x2={i * fittedViewport.columnWidth}
                y2={chartHeight + finalConfig.headerHeight}
                stroke="var(--aia-corp-mid)"
                strokeWidth={1}
                opacity={0.2}
              />
            ))}
          </g>

          {/* ── Layer 5: Today line (dashed) ── */}
          {todayX !== null && todayLabel && (
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

          {/* ── Layer 5b: Línea base (detrás de las barras reales) ── */}
          {showBaseline && (
            <g
              className="baseline-bars"
              transform={`translate(0, ${finalConfig.headerHeight})`}
              pointerEvents="none"
            >
              {tasks.map((task, i) => {
                if (!task.baselineStart || !task.baselineFinish) return null;

                const x = getDatePosition(task.baselineStart, fittedViewport);
                const width = getTaskWidth(
                  task.baselineStart,
                  task.baselineFinish,
                  fittedViewport,
                );

                return (
                  <rect
                    key={`baseline-${task.id}`}
                    x={x}
                    y={i * finalConfig.rowHeight + BASELINE_BAR_OFFSET_Y}
                    width={Math.max(width, 1)}
                    height={BASELINE_BAR_HEIGHT}
                    rx={2}
                    fill="var(--color-text-muted)"
                    opacity={0.35}
                  />
                );
              })}
            </g>
          )}

          {/* ── Layer 6: Task Bars ── */}
          <g
            className="tasks"
            transform={`translate(0, ${finalConfig.headerHeight})`}
          >
            {tasks.map((task, i) => {
              const y = i * finalConfig.rowHeight;
              const x = getDatePosition(task.start, fittedViewport);
              const width = getTaskWidth(task.start, task.finish, fittedViewport);

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
                      labelReserveWidth={
                        labelWidth(
                          resolveTaskLabelPlacement(task, width, scale)
                            .estimatedWidth,
                        ) +
                        SUMMARY_LABEL_OFFSET_X +
                        LABEL_GAP
                      }
                    />
                  ) : (
                    <TaskBar
                      observationBadge={
                        observations
                          ? observationBadgeFor(observations, task.id)
                          : null
                      }
                      task={task}
                      x={x}
                      y={y}
                      width={width}
                      height={finalConfig.rowHeight}
                      color={color}
                      isSelected={selectedTaskIds?.includes(task.id) ?? false}
                      onDepStart={onDepStart}
                      onDepEnd={onDepEnd}
                      onDepHoverEdge={onDepHoverEdge}
                      isDepHovered={depState.hoverTaskId === task.id}
                      viewport={fittedViewport}
                      onDragStart={onDragStart}
                      dragState={dragState}
                      onResizeStart={onResizeStart}
                      resizeState={resizeState}
                      showLabel={false}
                    />
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
                  fittedViewport,
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
                    lagUnit={dep.lagUnit}
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
                  ? getDatePosition(fromTask.start, fittedViewport) +
                    getTaskWidth(fromTask.start, fromTask.finish, fittedViewport)
                  : getDatePosition(fromTask.start, fittedViewport);
              const fromY =
                fromTaskIndex * finalConfig.rowHeight + finalConfig.rowHeight / 2;
              const toX = depState.mouseX;
              const toY = depState.mouseY - finalConfig.headerHeight;
              // El tipo real lo decide el borde de destino, no solo el de
              // origen: adivinarlo dejaba FF y SF fuera del alcance (E35).
              const type = inferDepType(
                depState.fromEdge,
                depState.hoverEdge ?? "left",
              );
              const d = calculateArrowPath(
                fromX,
                fromY,
                toX,
                toY,
                type,
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
                  <text
                    data-testid="dep-preview-type"
                    x={toX + 10}
                    y={toY - 8}
                    fontSize={10}
                    fill="var(--color-text-muted)"
                  >
                    {type} · {depTypeLabel(type)}
                  </text>
                  <polygon
                    points={arrowPoints}
                    fill="var(--aia-corp-main)"
                    opacity={0.7}
                  />
                </g>
              );
            })()}

          {/* ── Layer 7: Labels (above bars and dependency arrows) ── */}
          <g
            className="labels"
            transform={`translate(0, ${finalConfig.headerHeight})`}
            pointerEvents="none"
          >
            {tasks.map((task, i) => {
              const y = i * finalConfig.rowHeight;
              const centerY = y + finalConfig.rowHeight / 2;
              const labelY = centerY - LABEL_HEIGHT / 2;
              const x = getDatePosition(task.start, fittedViewport);
              const width = getTaskWidth(task.start, task.finish, fittedViewport);
              const resolution = resolveTaskLabelPlacement(task, width, scale);
              const resolvedWidth = labelWidth(resolution.estimatedWidth);

              if (resolution.placement === "summary-chip") {
                const chipX = x + SUMMARY_LABEL_OFFSET_X;
                if (!fitsWithinChart(chipX, resolvedWidth, chartWidth)) {
                  return <title key={`label-${task.id}`}>{task.name}</title>;
                }
                return (
                  <g
                    key={`label-${task.id}`}
                    data-testid="summary-label-chip"
                    className="gantt-summary-label"
                  >
                    <title>{task.name}</title>
                    <rect
                      x={chipX}
                      y={labelY}
                      width={resolvedWidth}
                      height={LABEL_HEIGHT}
                      fill="var(--aia-alabaster)"
                      stroke="var(--aia-arch-main)"
                      strokeWidth={0.75}
                      rx={3}
                      opacity={0.96}
                    />
                    <text
                      x={chipX + LABEL_PADDING_X}
                      y={centerY}
                      dominantBaseline="middle"
                      fill="var(--aia-corp-dark)"
                      fontSize={resolution.fontSize}
                      fontWeight={600}
                      paintOrder="stroke"
                      stroke="var(--aia-alabaster)"
                      strokeWidth={2}
                    >
                      {task.name}
                    </text>
                  </g>
                );
              }

              if (resolution.placement === "milestone-outside") {
                const labelX = x + GANTT_MILESTONE_SIZE * 2 + LABEL_GAP + 2;
                if (
                  !fitsWithinChart(
                    labelX - LABEL_PADDING_X,
                    resolvedWidth,
                    chartWidth,
                  )
                ) {
                  return <title key={`label-${task.id}`}>{task.name}</title>;
                }
                return (
                  <g
                    key={`label-${task.id}`}
                    data-testid="milestone-label-outside"
                    className="gantt-milestone-label"
                  >
                    <title>{task.name}</title>
                    <rect
                      x={labelX - LABEL_PADDING_X}
                      y={labelY}
                      width={resolvedWidth}
                      height={LABEL_HEIGHT}
                      fill="var(--aia-alabaster)"
                      rx={3}
                      opacity={0.9}
                    />
                    <text
                      x={labelX}
                      y={centerY}
                      dominantBaseline="middle"
                      fill="var(--aia-corp-dark)"
                      fontSize={resolution.fontSize}
                      paintOrder="stroke"
                      stroke="var(--aia-alabaster)"
                      strokeWidth={3}
                    >
                      {task.name}
                    </text>
                  </g>
                );
              }

              if (resolution.placement === "inside") {
                return (
                  <text
                    key={`label-${task.id}`}
                    data-testid="task-label-inside"
                    x={x + LABEL_PADDING_X}
                    y={centerY}
                    fill="white"
                    fontSize={resolution.fontSize}
                    fontWeight={600}
                    dominantBaseline="middle"
                    paintOrder="stroke"
                    stroke="var(--gantt-chart-label-shadow-stroke)"
                    strokeWidth={2}
                  >
                    {task.name}
                  </text>
                );
              }

              if (resolution.placement === "outside-right") {
                const labelX = x + width + LABEL_GAP;
                if (
                  !fitsWithinChart(
                    labelX - LABEL_PADDING_X,
                    resolvedWidth,
                    chartWidth,
                  )
                ) {
                  return <title key={`label-${task.id}`}>{task.name}</title>;
                }
                return (
                  <g
                    key={`label-${task.id}`}
                    data-testid="task-label-outside"
                    className="gantt-task-label-outside"
                  >
                    <title>{task.name}</title>
                    <rect
                      x={labelX - LABEL_PADDING_X}
                      y={labelY}
                      width={resolvedWidth}
                      height={LABEL_HEIGHT}
                      fill="var(--aia-alabaster)"
                      rx={3}
                      opacity={0.9}
                    />
                    <text
                      x={labelX}
                      y={centerY}
                      dominantBaseline="middle"
                      fill="var(--aia-corp-dark)"
                      fontSize={resolution.fontSize}
                      fontWeight={600}
                      paintOrder="stroke"
                      stroke="var(--aia-alabaster)"
                      strokeWidth={3}
                    >
                      {task.name}
                    </text>
                  </g>
                );
              }

              return (
                <title key={`label-${task.id}`}>{task.name}</title>
              );
            })}
          </g>

          {/* ── Layer 8: Today date label (top) ── */}
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
                {todayLabel}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
