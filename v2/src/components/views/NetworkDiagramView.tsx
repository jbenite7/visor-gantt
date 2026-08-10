"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import { computeNetworkLayout } from "@/lib/layout/networkLayout";
import { resolveDependencyDraft } from "@/lib/gantt/networkDependencyEditing";
import NetworkNode from "@/components/network/NetworkNode";
import NetworkArrow from "@/components/network/NetworkArrow";
import { RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";

interface NetworkDiagramViewProps {
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
  onCreateDependency?: (
    fromId: string | number,
    toId: string | number,
    type: "FS" | "SS" | "FF" | "SF",
  ) => void;
  onDeleteDependency?: (dependency: {
    from: string | number;
    to: string | number;
  }) => void;
  onRejectEdit?: (reason: string) => void;
}

export default function NetworkDiagramView({
  tasks,
  onTaskClick,
  onCreateDependency,
  onDeleteDependency,
  onRejectEdit,
}: NetworkDiagramViewProps) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<
    string | number | null
  >(null);
  const [connectFromId, setConnectFromId] = useState<string | number | null>(
    null,
  );
  const [selectedEdge, setSelectedEdge] = useState<{
    from: string | number;
    to: string | number;
  } | null>(null);

  useEffect(() => {
    if (connectFromId === null) return;
    const cancelar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConnectFromId(null);
    };
    window.addEventListener("keydown", cancelar);
    return () => window.removeEventListener("keydown", cancelar);
  }, [connectFromId]);

  // Elegir un origen para una dependencia nueva y elegir una flecha para
  // borrarla son dos modos que no pueden convivir: si había un origen a
  // medio elegir, empezar a conectar de nuevo lo suelta.
  const handleStartConnection = useCallback((taskId: string | number) => {
    setSelectedEdge(null);
    setConnectFromId((current) => (current === taskId ? null : taskId));
  }, []);

  const handleSelectEdge = useCallback(
    (edge: { fromTaskId: string | number; toTaskId: string | number }) => {
      setConnectFromId(null);
      setSelectedEdge({ from: edge.fromTaskId, to: edge.toTaskId });
    },
    [],
  );

  const handleDeleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    onDeleteDependency?.(selectedEdge);
    setSelectedEdge(null);
  }, [selectedEdge, onDeleteDependency]);

  useEffect(() => {
    if (!selectedEdge) return;
    const borrar = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        handleDeleteSelectedEdge();
      }
      if (event.key === "Escape") setSelectedEdge(null);
    };
    window.addEventListener("keydown", borrar);
    return () => window.removeEventListener("keydown", borrar);
  }, [selectedEdge, handleDeleteSelectedEdge]);

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
      setSelectedEdge(null);

      if (connectFromId !== null) {
        const draft = resolveDependencyDraft(tasks, connectFromId, taskId);
        setConnectFromId(null);
        if (!draft.ok) {
          onRejectEdit?.(draft.message);
          return;
        }
        onCreateDependency?.(
          draft.dependency.from,
          draft.dependency.to,
          draft.dependency.type,
        );
        return;
      }

      setSelectedTaskId(taskId);
      if (onTaskClick) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) onTaskClick(task);
      }
    },
    [connectFromId, tasks, onCreateDependency, onRejectEdit, onTaskClick],
  );

  // ── Reset view ──
  const handleReset = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  return (
    <div
      className="apple-module relative h-full w-full overflow-hidden"
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
              isSelected={
                selectedEdge?.from === edge.fromTaskId &&
                selectedEdge?.to === edge.toTaskId
              }
              onSelect={onDeleteDependency ? handleSelectEdge : undefined}
            />
          ))}
          {/* Nodes on top */}
          {layout.nodes.map((node) => (
            <NetworkNode
              key={node.taskId}
              node={node}
              onClick={handleNodeClick}
              onStartConnection={handleStartConnection}
              isSelected={selectedTaskId === node.taskId}
              isConnectSource={connectFromId === node.taskId}
            />
          ))}
        </g>
      </svg>

      {connectFromId !== null && (
        <div
          data-testid="network-connect-hint"
          className="absolute left-4 top-4 apple-section px-3 py-2 text-xs"
        >
          Elige la actividad que va después. Escape cancela.
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        {selectedEdge && (
          <button
            data-testid="network-delete-dependency"
            onClick={handleDeleteSelectedEdge}
            className="apple-icon-button"
            title="Borrar la dependencia elegida"
            type="button"
          >
            <Trash2 size={15} />
          </button>
        )}
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
          className="apple-icon-button"
          title="Zoom in"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
          className="apple-icon-button"
          title="Zoom out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={handleReset}
          className="apple-icon-button"
          title="Volver a encuadrar el diagrama"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Empty state */}
      {layout.nodes.length === 0 && (
        <div className="apple-empty-state absolute inset-0">
          <p>
            No hay tareas para mostrar en el diagrama de red
          </p>
        </div>
      )}
    </div>
  );
}
