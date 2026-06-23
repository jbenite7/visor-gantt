"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import { computeNetworkLayout } from "@/lib/layout/networkLayout";
import NetworkNode from "@/components/network/NetworkNode";
import NetworkArrow from "@/components/network/NetworkArrow";

interface NetworkDiagramViewProps {
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
}

export default function NetworkDiagramView({
  tasks,
  onTaskClick,
}: NetworkDiagramViewProps) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<
    string | number | null
  >(null);

  const panRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
  }>({
    dragging: false,
    startX: 0,
    startY: 0,
    originPanX: 0,
    originPanY: 0,
  });

  const layout = useMemo(() => computeNetworkLayout(tasks), [tasks]);

  // ── Zoom (scroll wheel) ──
  const handleZoom = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.3, Math.min(3, z + delta)));
    },
    [],
  );

  // ── Pan (mouse drag) ──
  const handlePanStart = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Only start pan on left button and not on a node click
      if (e.button !== 0) return;
      const target = e.target as SVGElement;
      if (target.closest("[data-testid='network-node']")) return;

      panRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        originPanX: panX,
        originPanY: panY,
      };
    },
    [panX, panY],
  );

  const handlePanMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!panRef.current.dragging) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setPanX(panRef.current.originPanX + dx);
    setPanY(panRef.current.originPanY + dy);
  }, []);

  const handlePanEnd = useCallback(() => {
    panRef.current.dragging = false;
  }, []);

  // ── Node click ──
  const handleNodeClick = useCallback(
    (taskId: string | number) => {
      setSelectedTaskId(taskId);
      if (onTaskClick) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) onTaskClick(task);
      }
    },
    [tasks, onTaskClick],
  );

  // ── Reset view ──
  const handleReset = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[var(--aia-linen)]"
      data-testid="network-diagram-view"
    >
      <svg
        width="100%"
        height="100%"
        onWheel={handleZoom}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        style={{ display: "block" }}
      >
        <g
          transform={`translate(${panX}, ${panY}) scale(${zoom})`}
          style={{ transformOrigin: "0 0" }}
        >
          {/* Edges first (behind nodes) */}
          {layout.edges.map((edge) => (
            <NetworkArrow
              key={`${edge.fromTaskId}-${edge.toTaskId}`}
              edge={edge}
            />
          ))}
          {/* Nodes on top */}
          {layout.nodes.map((node) => (
            <NetworkNode
              key={node.taskId}
              node={node}
              onClick={handleNodeClick}
              isSelected={selectedTaskId === node.taskId}
            />
          ))}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
          className="w-8 h-8 flex items-center justify-center rounded-md text-white text-sm font-semibold"
          style={{ backgroundColor: "var(--aia-corp-dark)" }}
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
          className="w-8 h-8 flex items-center justify-center rounded-md text-white text-sm font-semibold"
          style={{ backgroundColor: "var(--aia-corp-dark)" }}
          title="Zoom out"
        >
          &minus;
        </button>
        <button
          onClick={handleReset}
          className="px-3 h-8 flex items-center justify-center rounded-md text-white text-xs font-semibold"
          style={{ backgroundColor: "var(--aia-corp-dark)" }}
          title="Reset view"
        >
          Reset
        </button>
      </div>

      {/* Empty state */}
      {layout.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[var(--aia-corp-mid)] text-lg opacity-60">
            No hay tareas para mostrar en el diagrama de red
          </p>
        </div>
      )}
    </div>
  );
}
