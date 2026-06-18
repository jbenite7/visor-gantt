"use client";

import { useMemo, useState } from "react";
import { GanttTask, GanttViewport, GanttConfig } from "./types";
import {
  calculateViewport,
  generateTimelineColumns,
  formatTimelineDate,
  getDatePosition,
  getTaskWidth,
} from "./utils";

interface GanttChartProps {
  tasks: GanttTask[];
  config?: Partial<GanttConfig>;
  onTaskClick?: (task: GanttTask) => void;
}

const DEFAULT_CONFIG: GanttConfig = {
  rowHeight: 40,
  headerHeight: 60,
  todayLineColor: "#3b82f6",
  criticalColor: "#ef4444",
  normalColor: "#10b981",
  summaryColor: "#8b5cf6",
  milestoneColor: "#f59e0b",
};

export default function GanttChart({
  tasks,
  config,
  onTaskClick,
}: GanttChartProps) {
  const [scale, setScale] = useState<"day" | "week" | "month">("day");
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const viewport = useMemo(
    () => calculateViewport(tasks, scale),
    [tasks, scale],
  );
  const columns = useMemo(() => generateTimelineColumns(viewport), [viewport]);

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
    <div className="gantt-chart overflow-auto border border-slate-700 rounded-lg bg-slate-900">
      {/* Controls */}
      <div className="sticky top-0 z-20 bg-slate-800 p-3 border-b border-slate-700 flex gap-2">
        <button
          onClick={() => setScale("day")}
          className={`px-3 py-1 rounded text-sm ${
            scale === "day"
              ? "bg-blue-600 text-white"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          Día
        </button>
        <button
          onClick={() => setScale("week")}
          className={`px-3 py-1 rounded text-sm ${
            scale === "week"
              ? "bg-blue-600 text-white"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => setScale("month")}
          className={`px-3 py-1 rounded text-sm ${
            scale === "month"
              ? "bg-blue-600 text-white"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          Mes
        </button>
      </div>

      {/* Chart Container */}
      <div className="relative">
        <svg
          width={chartWidth}
          height={chartHeight + finalConfig.headerHeight}
          className="font-sans"
        >
          {/* Timeline Header */}
          <g className="timeline-header">
            <rect
              x={0}
              y={0}
              width={chartWidth}
              height={finalConfig.headerHeight}
              fill="#1e293b"
            />
            {columns.map((date, i) => (
              <g key={i}>
                <rect
                  x={i * viewport.columnWidth}
                  y={0}
                  width={viewport.columnWidth}
                  height={finalConfig.headerHeight}
                  fill="none"
                  stroke="#334155"
                  strokeWidth={1}
                />
                <text
                  x={i * viewport.columnWidth + viewport.columnWidth / 2}
                  y={finalConfig.headerHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#94a3b8"
                  fontSize={12}
                >
                  {formatTimelineDate(date, viewport.scale)}
                </text>
              </g>
            ))}
          </g>

          {/* Grid Lines */}
          <g className="grid">
            {columns.map((_, i) => (
              <line
                key={i}
                x1={i * viewport.columnWidth}
                y1={finalConfig.headerHeight}
                x2={i * viewport.columnWidth}
                y2={chartHeight + finalConfig.headerHeight}
                stroke="#334155"
                strokeWidth={1}
              />
            ))}
          </g>

          {/* Today Line */}
          {todayX !== null && (
            <line
              x1={todayX}
              y1={0}
              x2={todayX}
              y2={chartHeight + finalConfig.headerHeight}
              stroke={finalConfig.todayLineColor}
              strokeWidth={2}
              strokeDasharray="5,5"
            />
          )}

          {/* Task Bars */}
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
                  onClick={() => onTaskClick?.(task)}
                >
                  {/* Row Background */}
                  <rect
                    x={0}
                    y={y}
                    width={chartWidth}
                    height={finalConfig.rowHeight}
                    fill={i % 2 === 0 ? "#0f172a" : "#1e293b"}
                  />

                  {/* Task Bar or Milestone */}
                  {task.isMilestone ? (
                    <polygon
                      points={`${x},${y + finalConfig.rowHeight / 2} ${x + 10},${y + 10} ${x + 20},${y + finalConfig.rowHeight / 2} ${x + 10},${y + finalConfig.rowHeight - 10}`}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  ) : (
                    <>
                      <rect
                        x={x}
                        y={y + finalConfig.rowHeight * 0.25}
                        width={width}
                        height={finalConfig.rowHeight * 0.5}
                        fill={color}
                        rx={task.isSummary ? 0 : 4}
                        opacity={task.isSummary ? 0.7 : 1}
                      />
                      {/* Progress Bar */}
                      {task.progress > 0 && !task.isSummary && (
                        <rect
                          x={x}
                          y={y + finalConfig.rowHeight * 0.25}
                          width={(width * task.progress) / 100}
                          height={finalConfig.rowHeight * 0.5}
                          fill="#000"
                          opacity={0.3}
                        />
                      )}
                    </>
                  )}

                  {/* Task Label */}
                  <text
                    x={x + 5}
                    y={y + finalConfig.rowHeight / 2}
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize={12}
                    className="pointer-events-none"
                  >
                    {task.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
