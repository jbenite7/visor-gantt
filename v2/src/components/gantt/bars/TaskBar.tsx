import { useState } from "react";
import { GanttTask, GanttViewport } from "../types";
import { resolveTaskLabelPlacement } from "../labelPolicy";
import type { DragState } from "../interaction/useDragBar";
import type { ResizeState } from "../interaction/useResizeBar";
import type { DepEdge } from "../interaction/useCreateDependency";
import { CRITICAL_HATCH_ID } from "./CriticalHatchDefs";
import { dragDestinationLabel } from "@/lib/gantt/dragPreview";
import ObservationBadge from "./ObservationBadge";
import type { ObservationBadge as ObservationBadgeState } from "@/lib/observations/observations";

interface TaskBarProps {
  task: GanttTask;
  /** Estado de las observaciones de esta tarea, si tiene alguna. */
  observationBadge?: ObservationBadgeState | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  onClick?: () => void;
  isSelected?: boolean;
  // Interaction (optional — readonly when omitted)
  viewport?: GanttViewport;
  onDragStart?: (taskId: string | number, e: React.MouseEvent) => void;
  dragState?: DragState;
  onResizeStart?: (
    taskId: string | number,
    edge: "left" | "right",
    originalDuration: number,
    e: React.MouseEvent,
  ) => void;
  resizeState?: ResizeState;
  /** Called when user mousedowns on a connection point to start dependency creation. */
  onDepStart?: (
    taskId: string | number,
    edge: DepEdge,
    event: React.MouseEvent,
  ) => void;
  /** Se suelta aquí para cerrar el vínculo, con el borde que toque. */
  onDepEnd?: (taskId: string | number, edge: DepEdge) => void;
  /** Aviso de sobre qué borde está el puntero mientras se arrastra. */
  onDepHoverEdge?: (edge: DepEdge | null) => void;
  /** Whether this bar is the hover target during dependency creation. */
  isDepHovered?: boolean;
  /** Let parent charts move labels to a dedicated top layer. */
  showLabel?: boolean;
}

const BAR_PADDING_RATIO = 0.25;
const RESIZE_HANDLE_WIDTH = 8;

export default function TaskBar({
  task,
  x,
  y,
  width,
  height,
  color,
  observationBadge,
  onClick,
  isSelected,
  viewport,
  onDragStart,
  dragState,
  onResizeStart,
  resizeState,
  onDepStart,
  onDepEnd,
  onDepHoverEdge,
  isDepHovered,
  showLabel = true,
}: TaskBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const barY = y + height * BAR_PADDING_RATIO;
  const barHeight = height * (1 - BAR_PADDING_RATIO * 2);
  const progressWidth = (width * task.progress) / 100;

  const isDragging = dragState?.isDragging && dragState.taskId === task.id;
  const isResizing =
    resizeState?.isResizing && resizeState.taskId === task.id;
  const isInteractive = Boolean(onDragStart);

  // Ghost bar position (semi-transparent copy during drag)
  const ghostX = isDragging ? x + (dragState?.ghostX ?? 0) : 0;

  // Duration tooltip position
  const durationLabel = isResizing
    ? `${resizeState?.newDuration ?? task.duration}d`
    : null;

  /**
   * Los tiradores existían pero eran `fill="transparent"`: se podían usar solo
   * si ya sabías que estaban ahí. Se pintan al pasar por la barra o al
   * seleccionarla, y desaparecen el resto del tiempo para no ensuciar (E29).
   */
  const showResizeHandles = Boolean(isHovered || isSelected);
  const showConnPoints = onDepStart !== undefined && (isHovered || isDepHovered);
  const connCy = y + height / 2;
  const labelPlacement = viewport
    ? resolveTaskLabelPlacement(task, width, viewport.scale).placement
    : width > 60
      ? "inside"
      : "outside-right";

  return (
    <g
      className="gantt-task-bar"
      data-testid="task-bar"
      data-task-id={task.id}
      style={{ cursor: isInteractive ? "grab" : undefined }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <title>{task.name}</title>

      {/* Background rectangle */}
      <rect
        x={x}
        y={barY}
        width={width}
        height={barHeight}
        fill={color}
        rx={4}
        stroke={isSelected ? "var(--aia-proj-main)" : "none"}
        strokeWidth={isSelected ? 2 : 0}
        data-testid="task-bar-drag"
        onMouseDown={
          isDragging
            ? undefined
            : (e) => onDragStart?.(task.id, e)
        }
        style={{
          cursor: isInteractive
            ? isDragging
              ? "grabbing"
              : "grab"
            : undefined,
        }}
      />

      {/* Señal no cromática de ruta crítica: trama + borde oscuro (sobrevive en B/N) */}
      {task.isCritical && (
        <rect
          x={x}
          y={barY}
          width={width}
          height={barHeight}
          fill={`url(#${CRITICAL_HATCH_ID})`}
          stroke="var(--aia-alert-dark)"
          strokeWidth={1.5}
          rx={4}
          pointerEvents="none"
          data-testid="task-bar-critical-hatch"
        />
      )}

      {/* Progress fill overlay */}
      {task.progress > 0 && (
        <rect
          x={x}
          y={barY}
          width={progressWidth}
          height={barHeight}
          fill="rgba(0,0,0,0.3)"
          rx={4}
          pointerEvents="none"
        />
      )}

      {/* Task name label */}
      {showLabel && labelPlacement === "inside" && (
        <text
          x={x + 5}
          y={y + height / 2}
          fill="white"
          fontSize={12}
          dominantBaseline="middle"
          paintOrder="stroke"
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={2}
          pointerEvents="none"
        >
          {task.name}
        </text>
      )}

      {/* Momento firma: el estado del trabajo de campo, encima del plan */}
      {observationBadge && (
        <ObservationBadge
          badge={observationBadge}
          x={x + width}
          y={y}
          height={height}
        />
      )}

      {/* Tirador izquierdo: se ve al pasar por encima o al seleccionar */}
      {isInteractive && (
        <rect
          x={x}
          y={barY}
          width={RESIZE_HANDLE_WIDTH}
          height={barHeight}
          fill={showResizeHandles ? "var(--color-text-muted)" : "transparent"}
          opacity={showResizeHandles ? 0.7 : 1}
          rx={2}
          style={{ cursor: "ew-resize" }}
          data-visible={showResizeHandles}
          data-testid="task-bar-resize-left"
          onMouseDown={(e) =>
            onResizeStart?.(task.id, "left", task.duration, e)
          }
        />
      )}

      {/* Tirador derecho */}
      {isInteractive && (
        <rect
          x={x + width - RESIZE_HANDLE_WIDTH}
          y={barY}
          width={RESIZE_HANDLE_WIDTH}
          height={barHeight}
          fill={showResizeHandles ? "var(--color-text-muted)" : "transparent"}
          opacity={showResizeHandles ? 0.7 : 1}
          rx={2}
          style={{ cursor: "ew-resize" }}
          data-visible={showResizeHandles}
          data-testid="task-bar-resize-right"
          onMouseDown={(e) =>
            onResizeStart?.(task.id, "right", task.duration, e)
          }
        />
      )}

      {/* Ghost bar while dragging */}
      {isDragging && (
        <rect
          x={ghostX}
          y={barY}
          width={width}
          height={barHeight}
          fill="transparent"
          stroke="var(--aia-corp-main)"
          strokeWidth={2}
          strokeDasharray="4,4"
          opacity={0.5}
          rx={4}
          pointerEvents="none"
        />
      )}

      {/* A qué día va a caer: sin esto, arrastrar es adivinar (E30) */}
      {isDragging && (
        <text
          data-testid="drag-destination"
          x={ghostX + 4}
          y={barY - 6}
          fontSize={10}
          fill="var(--color-text-muted)"
          pointerEvents="none"
        >
          {dragDestinationLabel(task.start, dragState?.dayDelta ?? 0)}
        </text>
      )}

      {/* Duration tooltip while resizing */}
      {isResizing && durationLabel && (
        <g pointerEvents="none">
          <rect
            x={x + width / 2 - 20}
            y={barY - 22}
            width={40}
            height={18}
            fill="var(--aia-corp-dark)"
            rx={3}
          />
          <text
            x={x + width / 2}
            y={barY - 10}
            fill="white"
            fontSize={11}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {durationLabel}
          </text>
        </g>
      )}

      {/* Connection points — visible on hover or during dependency creation */}
      {showConnPoints && (
        <>
          <circle
            cx={x}
            cy={connCy}
            r={5}
            fill="var(--aia-corp-main)"
            stroke="white"
            strokeWidth={2}
            cursor="crosshair"
            data-testid="dep-point-left"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDepStart(task.id, "left", e);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              onDepEnd?.(task.id, "left");
            }}
            onMouseEnter={() => onDepHoverEdge?.("left")}
            onMouseLeave={() => onDepHoverEdge?.(null)}
          />
          <circle
            cx={x + width}
            cy={connCy}
            r={5}
            fill="var(--aia-corp-main)"
            stroke="white"
            strokeWidth={2}
            cursor="crosshair"
            data-testid="dep-point-right"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDepStart(task.id, "right", e);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              onDepEnd?.(task.id, "right");
            }}
            onMouseEnter={() => onDepHoverEdge?.("right")}
            onMouseLeave={() => onDepHoverEdge?.(null)}
          />
        </>
      )}
    </g>
  );
}
