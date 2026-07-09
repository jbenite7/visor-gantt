"use client";

import {
  useId,
  useMemo,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { GanttScale } from "@/components/gantt/types";
import type { LOBActivity, LOBUnit } from "@/types/lob";
import {
  computeLOBLayout,
  diagnoseLOB,
  type LOBDiagnostic,
} from "@/lib/scheduling/lob";

// ── Layout constants ──────────────────────────────────────────────

const MARGIN = { top: 40, right: 140, bottom: 60, left: 180 };
const BOTTLENECK_TOOLTIP_WIDTH = 320;
const BOTTLENECK_TOOLTIP_HEIGHT = 92;
const BOTTLENECK_TOOLTIP_LINE_HEIGHT = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;
const PAN_VISIBLE_RATIO_STEP = 0.25;

// ── Helper functions ──────────────────────────────────────────────

type LOBScale = GanttScale;

const LOB_SCALE_OPTIONS: Array<{ scale: LOBScale; label: string }> = [
  { scale: "day", label: "Día" },
  { scale: "week", label: "Semanas" },
  { scale: "month", label: "Meses" },
  { scale: "quarter", label: "Trimestre" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dateToX(date: Date, min: Date, max: Date, width: number): number {
  const range = max.getTime() - min.getTime();
  if (range === 0) return width / 2;
  return MARGIN.left + ((date.getTime() - min.getTime()) / range) * width;
}

function unitToY(unitIndex: number, maxUnit: number, height: number): number {
  if (maxUnit === 0) return height - MARGIN.bottom;
  // Invert: unit 0 at bottom, maxUnit at top
  return (
    height -
    MARGIN.bottom -
    (unitIndex / maxUnit) * (height - MARGIN.top - MARGIN.bottom)
  );
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function startOfMonth(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

function startOfQuarter(date: Date): Date {
  const result = startOfMonth(date);
  result.setMonth(Math.floor(result.getMonth() / 3) * 3);
  return result;
}

function getISOWeek(date: Date): number {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 4 - (result.getDay() || 7));
  const yearStart = new Date(result.getFullYear(), 0, 1);
  return Math.ceil(((result.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
}

function getScaledDateDomain(min: Date, max: Date, scale: LOBScale): { min: Date; max: Date } {
  const minTime = min.getTime();
  const maxTime = max.getTime();
  const range = Math.max(maxTime - minTime, MS_PER_DAY);
  const minimumPadding = scale === "day" ? MS_PER_DAY : MS_PER_DAY * 2;
  const padding = Math.max(range * 0.08, minimumPadding);
  const domainMin =
    scale === "day"
      ? startOfDay(min)
      : scale === "week"
        ? startOfWeek(min)
        : scale === "month"
          ? startOfMonth(min)
          : startOfQuarter(min);

  return {
    min: domainMin,
    max: new Date(maxTime + padding),
  };
}

function getZoomedDateDomain(
  domain: { min: Date; max: Date },
  zoomLevel: number,
  centerRatio: number,
): { min: Date; max: Date } {
  if (zoomLevel <= ZOOM_MIN) return domain;

  const minTime = domain.min.getTime();
  const maxTime = domain.max.getTime();
  const range = Math.max(maxTime - minTime, MS_PER_DAY);
  const visibleRange = Math.max(range / zoomLevel, MS_PER_DAY);
  const bounds = getZoomCenterBounds(domain, zoomLevel);
  const center = minTime + range * clamp(centerRatio, bounds.min, bounds.max);

  return {
    min: new Date(center - visibleRange / 2),
    max: new Date(center + visibleRange / 2),
  };
}

function getZoomCenterBounds(
  domain: { min: Date; max: Date },
  zoomLevel: number,
): { min: number; max: number } {
  if (zoomLevel <= ZOOM_MIN) return { min: 0.5, max: 0.5 };

  const range = Math.max(domain.max.getTime() - domain.min.getTime(), MS_PER_DAY);
  const visibleRange = Math.max(range / zoomLevel, MS_PER_DAY);
  const edgePadding = Math.min(0.5, visibleRange / range / 2);
  return {
    min: edgePadding,
    max: 1 - edgePadding,
  };
}

function clampZoomCenterRatio(
  domain: { min: Date; max: Date },
  zoomLevel: number,
  centerRatio: number,
): number {
  const bounds = getZoomCenterBounds(domain, zoomLevel);
  return clamp(centerRatio, bounds.min, bounds.max);
}

function getAnchoredZoomCenterRatio(
  domain: { min: Date; max: Date },
  currentZoom: number,
  currentCenterRatio: number,
  nextZoom: number,
  anchorRatio: number,
): number {
  if (nextZoom <= ZOOM_MIN) return 0.5;

  const minTime = domain.min.getTime();
  const maxTime = domain.max.getTime();
  const range = Math.max(maxTime - minTime, MS_PER_DAY);
  const currentDomain = getZoomedDateDomain(domain, currentZoom, currentCenterRatio);
  const currentRange = Math.max(
    currentDomain.max.getTime() - currentDomain.min.getTime(),
    MS_PER_DAY,
  );
  const anchorTime =
    currentDomain.min.getTime() + currentRange * clamp(anchorRatio, 0, 1);
  const nextVisibleRange = Math.max(range / nextZoom, MS_PER_DAY);
  const nextCenterTime =
    anchorTime - (clamp(anchorRatio, 0, 1) - 0.5) * nextVisibleRange;

  return clampZoomCenterRatio(
    domain,
    nextZoom,
    (nextCenterTime - minTime) / range,
  );
}

function panZoomCenterRatio(
  domain: { min: Date; max: Date },
  zoomLevel: number,
  centerRatio: number,
  visibleRatioDelta: number,
): number {
  if (zoomLevel <= ZOOM_MIN) return 0.5;
  return clampZoomCenterRatio(
    domain,
    zoomLevel,
    centerRatio + visibleRatioDelta / zoomLevel,
  );
}

function formatTickLabel(date: Date, scale: LOBScale): string {
  if (scale === "day") {
    const day = date.getDate();
    const month = date.toLocaleString("es-ES", { month: "short" });
    return `${day} ${month}`;
  }

  if (scale === "month") {
    return date.toLocaleString("es-ES", {
      month: "short",
      year: "numeric",
    });
  }

  if (scale === "quarter") {
    return `T${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }

  const day = date.getDate();
  const month = date.toLocaleString("es-ES", { month: "short" });
  return `S${getISOWeek(date)} - ${day} ${month}`;
}

function generateDateTicks(min: Date, max: Date, scale: LOBScale): Date[] {
  const ticks: Date[] = [];
  const dayRange = Math.max(
    1,
    Math.ceil((max.getTime() - min.getTime()) / MS_PER_DAY) + 1,
  );
  const dayStep = scale === "day" ? Math.max(1, Math.ceil(dayRange / 16)) : 1;
  const pushTick = (tick: Date) => {
    const previous = ticks.at(-1);
    if (!previous || previous.getTime() !== tick.getTime()) {
      ticks.push(new Date(tick));
    }
  };
  const current =
    scale === "day"
      ? startOfDay(min)
      : scale === "week"
        ? startOfWeek(min)
        : scale === "month"
          ? startOfMonth(min)
          : startOfQuarter(min);

  while (current < min) {
    if (scale === "day") {
      current.setDate(current.getDate() + dayStep);
    } else if (scale === "week") {
      current.setDate(current.getDate() + 7);
    } else if (scale === "month") {
      current.setMonth(current.getMonth() + 1);
    } else {
      current.setMonth(current.getMonth() + 3);
    }
  }

  while (current <= max) {
    pushTick(current);
    if (scale === "day") {
      current.setDate(current.getDate() + dayStep);
    } else if (scale === "week") {
      current.setDate(current.getDate() + 7);
    } else if (scale === "month") {
      current.setMonth(current.getMonth() + 1);
    } else {
      current.setMonth(current.getMonth() + 3);
    }
  }
  if (ticks.length === 0) ticks.push(new Date(min));
  return ticks;
}

function severityLabel(severity: LOBDiagnostic["severity"]): string {
  if (severity === "high") return "Alta";
  if (severity === "medium") return "Media";
  return "Baja";
}

function formatUnits(unitIndices: number[]): string {
  if (unitIndices.length === 0) return "General";
  return `Unid. ${unitIndices.map((unitIndex) => unitIndex + 1).join(", ")}`;
}

function wrapTooltipText(value: string, maxLineLength = 54, maxLines = 4): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]$/, "")}...`;
  }
  return lines;
}

function isBottleneckDiagnostic(diagnostic: LOBDiagnostic): boolean {
  return diagnostic.kind !== "insufficientUnits";
}

// ── Component ─────────────────────────────────────────────────────

interface LineOfBalanceProps {
  activities: LOBActivity[];
  units: LOBUnit[];
  scale?: GanttScale;
  onScaleChange?: (scale: GanttScale) => void;
}

export default function LineOfBalance({
  activities,
  units,
  scale: controlledScale,
  onScaleChange,
}: LineOfBalanceProps) {
  const clipPathId = useId().replace(/:/g, "");
  const [localScale, setLocalScale] = useState<LOBScale>("day");
  const scale = controlledScale ?? localScale;
  const [zoomLevel, setZoomLevel] = useState(ZOOM_MIN);
  const [zoomCenterRatio, setZoomCenterRatio] = useState(0.5);
  const [dragState, setDragState] = useState<{
    pointerId: number;
    startClientX: number;
    startCenterRatio: number;
  } | null>(null);
  const [showBottlenecks, setShowBottlenecks] = useState(false);
  const [activeBottleneckId, setActiveBottleneckId] = useState<string | null>(null);
  const layout = useMemo(
    () => computeLOBLayout(activities, units),
    [activities, units],
  );
  const diagnostics = useMemo(
    () => diagnoseLOB(activities, units),
    [activities, units],
  );

  // Responsive dimensions
  const width = 980;
  const height = Math.max(400, 200 + layout.totalUnits * 50);

  const chartWidth = width - MARGIN.left - MARGIN.right;
  const chartHeight = height - MARGIN.top - MARGIN.bottom;

  const dataXScale = useMemo(() => {
    const dates = layout.lines.flatMap((line) =>
      line.points.map((point) => point.date.getTime()),
    );
    if (dates.length === 0) return layout.xScale;
    return {
      min: new Date(Math.min(...dates)),
      max: new Date(Math.max(...dates)),
    };
  }, [layout.lines, layout.xScale]);

  const baseXScale = useMemo(
    () => getScaledDateDomain(dataXScale.min, dataXScale.max, scale),
    [dataXScale.max, dataXScale.min, scale],
  );
  const zoomBounds = useMemo(
    () => getZoomCenterBounds(baseXScale, zoomLevel),
    [baseXScale, zoomLevel],
  );
  const boundedZoomCenterRatio = clamp(
    zoomCenterRatio,
    zoomBounds.min,
    zoomBounds.max,
  );

  const chartXScale = useMemo(
    () => getZoomedDateDomain(baseXScale, zoomLevel, boundedZoomCenterRatio),
    [baseXScale, boundedZoomCenterRatio, zoomLevel],
  );

  const dateTicks = useMemo(
    () => generateDateTicks(chartXScale.min, chartXScale.max, scale),
    [chartXScale.max, chartXScale.min, scale],
  );

  const unitLabels = useMemo(() => {
    const labels: { index: number; label: string }[] = [];
    const unitNamesByIndex = new Map<number, string>();
    for (const unit of units) {
      if (unit.unitName && !unitNamesByIndex.has(unit.unitIndex)) {
        unitNamesByIndex.set(unit.unitIndex, unit.unitName);
      }
    }

    const unitLabel = activities.length > 0 ? activities[0].unitLabel : "Unidad";
    for (let i = 0; i <= layout.totalUnits; i++) {
      labels.push({ index: i, label: unitNamesByIndex.get(i) ?? `${unitLabel} ${i + 1}` });
    }
    return labels;
  }, [layout.totalUnits, activities, units]);

  // ── Tolerance bands (±10% of chart height) ────────────────────
  const toleranceBandHeight = chartHeight * 0.1;

  // ── Group lines by activityId (planned + actual share color) ───
  const plannedLines = layout.lines.filter((l) => !l.activityName.includes("(Real)"));
  const actualLines = layout.lines.filter((l) => l.activityName.includes("(Real)"));

  // ── Unique activity names for legend (without plan/real suffix) ──
  const legendItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { name: string; color: string }[] = [];
    for (const line of layout.lines) {
      const baseName = line.activityName
        .replace(" (Planificado)", "")
        .replace(" (Real)", "");
      if (!seen.has(baseName)) {
        seen.add(baseName);
        items.push({ name: baseName, color: line.color });
      }
    }
    return items;
  }, [layout.lines]);

  const bottleneckMarkers = useMemo(() => {
    return diagnostics
      .filter(isBottleneckDiagnostic)
      .map((diagnostic, index) => {
        const points = diagnostic.activityIds.flatMap((activityId) => {
          const line = plannedLines.find((candidate) => candidate.activityId === activityId);
          if (!line) return [];
          const unitIndices =
            diagnostic.unitIndices.length > 0
              ? diagnostic.unitIndices
              : line.points.map((point) => point.unitIndex);
          return unitIndices
            .map((unitIndex) => line.points.find((point) => point.unitIndex === unitIndex))
            .filter((point): point is (typeof line.points)[number] => point != null);
        });

        if (points.length === 0) return null;

        const maxUnit = layout.totalUnits || 1;
        const x =
          points.reduce(
            (sum, point) => sum + dateToX(point.date, chartXScale.min, chartXScale.max, chartWidth),
            0,
          ) / points.length;
        const y =
          points.reduce(
            (sum, point) => sum + unitToY(point.unitIndex, maxUnit, height),
            0,
          ) / points.length;

        return {
          id: `${diagnostic.kind}-${diagnostic.activityIds.join("-")}-${index}`,
          diagnostic,
          x,
          y,
          title: `Cuello de botella ${severityLabel(diagnostic.severity).toLowerCase()} - ${formatUnits(diagnostic.unitIndices)}`,
          lines: wrapTooltipText(`${diagnostic.message} ${diagnostic.recommendation}`),
        };
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker != null);
  }, [chartWidth, chartXScale.max, chartXScale.min, diagnostics, height, layout.totalUnits, plannedLines]);

  const hasLines = layout.lines.length > 0;
  const activeBottleneck = bottleneckMarkers.find(
    (marker) => marker.id === activeBottleneckId,
  );
  const zoomLabel = `${Math.round(zoomLevel * 100)}%`;
  const plotClipPathId = `${clipPathId}-lob-plot`;
  const canPanLeft = zoomLevel > ZOOM_MIN && boundedZoomCenterRatio > zoomBounds.min;
  const canPanRight = zoomLevel > ZOOM_MIN && boundedZoomCenterRatio < zoomBounds.max;

  const plotRatioFromClientX = (
    clientX: number,
    target: SVGSVGElement,
  ): number => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return 0.5;
    const svgX = ((clientX - rect.left) / rect.width) * width;
    return clamp((svgX - MARGIN.left) / chartWidth, 0, 1);
  };

  const updateZoom = (nextZoom: number, anchorRatio = 0.5) => {
    const boundedNextZoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
    const nextCenterRatio = getAnchoredZoomCenterRatio(
      baseXScale,
      zoomLevel,
      boundedZoomCenterRatio,
      boundedNextZoom,
      anchorRatio,
    );
    setZoomLevel(boundedNextZoom);
    setZoomCenterRatio(nextCenterRatio);
    if (boundedNextZoom <= ZOOM_MIN) {
      setDragState(null);
    }
  };

  const handleScaleChange = (nextScale: GanttScale) => {
    if (controlledScale === undefined) {
      setLocalScale(nextScale);
    }
    onScaleChange?.(nextScale);
  };

  const panChart = (direction: -1 | 1) => {
    setZoomCenterRatio((current) =>
      panZoomCenterRatio(
        baseXScale,
        zoomLevel,
        current,
        direction * PAN_VISIBLE_RATIO_STEP,
      ),
    );
  };

  const handleChartWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const anchorRatio = plotRatioFromClientX(event.clientX, event.currentTarget);
    const direction = event.deltaY < 0 ? 1 : -1;
    updateZoom(zoomLevel + direction * ZOOM_STEP, anchorRatio);
  };

  const handleChartPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (zoomLevel <= ZOOM_MIN || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startCenterRatio: boundedZoomCenterRatio,
    });
  };

  const handleChartPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId || zoomLevel <= ZOOM_MIN) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const plotScreenWidth = Math.max((chartWidth / width) * rect.width, 1);
    const visibleRatioDelta = -(event.clientX - dragState.startClientX) / plotScreenWidth;
    setZoomCenterRatio(
      panZoomCenterRatio(
        baseXScale,
        zoomLevel,
        dragState.startCenterRatio,
        visibleRatioDelta,
      ),
    );
  };

  const handleChartPointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    if (dragState?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragState(null);
    }
  };

  return (
    <div
      data-testid="line-of-balance"
      data-scale={scale}
      data-zoom={zoomLevel}
      data-zoom-center={boundedZoomCenterRatio.toFixed(3)}
      className="apple-module flex h-full min-w-0 flex-col overflow-hidden"
    >
      <div className="apple-module-header flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <h2 className="lob-header__title">
            Línea de Balance — Producción por Unidad
          </h2>
          <p className="lob-header__description">
            Eje X: Tiempo &middot; Eje Y: Ubicación/nivel &middot; Líneas sólidas: Planificado &middot; Líneas punteadas: Real
          </p>
        </div>
        <div className="lob-header-actions">
          <div
            role="group"
            aria-label="Zoom del gráfico"
            className="lob-zoom-controls"
          >
            <button
              type="button"
              className="lob-zoom-button"
              data-testid="lob-pan-left"
              aria-label="Mover gráfico a fechas anteriores"
              title="Mover gráfico a fechas anteriores"
              disabled={!canPanLeft}
              onClick={() => panChart(-1)}
            >
              <ChevronLeft className="lob-zoom-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lob-zoom-button"
              data-testid="lob-zoom-out"
              aria-label="Alejar gráfico"
              title="Alejar gráfico"
              disabled={zoomLevel <= ZOOM_MIN}
              onClick={() => updateZoom(zoomLevel - ZOOM_STEP)}
            >
              <ZoomOut className="lob-zoom-icon" aria-hidden="true" />
            </button>
            <span className="lob-zoom-value" data-testid="lob-zoom-value">
              {zoomLabel}
            </span>
            <button
              type="button"
              className="lob-zoom-button"
              data-testid="lob-zoom-in"
              aria-label="Acercar gráfico"
              title="Acercar gráfico"
              disabled={zoomLevel >= ZOOM_MAX}
              onClick={() => updateZoom(zoomLevel + ZOOM_STEP)}
            >
              <ZoomIn className="lob-zoom-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lob-zoom-button"
              data-testid="lob-pan-right"
              aria-label="Mover gráfico a fechas posteriores"
              title="Mover gráfico a fechas posteriores"
              disabled={!canPanRight}
              onClick={() => panChart(1)}
            >
              <ChevronRight className="lob-zoom-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lob-zoom-button"
              data-testid="lob-zoom-reset"
              aria-label="Restablecer zoom"
              title="Restablecer zoom"
              disabled={zoomLevel === ZOOM_MIN}
              onClick={() => {
                setZoomLevel(ZOOM_MIN);
                setZoomCenterRatio(0.5);
                setDragState(null);
              }}
            >
              <RotateCcw className="lob-zoom-icon" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showBottlenecks}
            data-testid="lob-bottleneck-toggle"
            className="lob-bottleneck-switch"
            data-active={showBottlenecks}
            onClick={() => {
              setShowBottlenecks((current) => !current);
              setActiveBottleneckId(null);
            }}
          >
            <span className="lob-bottleneck-switch__track" aria-hidden="true">
              <span className="lob-bottleneck-switch__thumb" />
            </span>
            <span>Cuellos</span>
            <span className="lob-bottleneck-switch__count">
              {bottleneckMarkers.length}
            </span>
          </button>
          <div className="lob-scale-toggle">
            {LOB_SCALE_OPTIONS.map((option) => (
              <button
                key={option.scale}
                type="button"
                className="lob-scale-toggle__button"
                data-active={scale === option.scale}
                data-testid={`lob-scale-${option.scale}`}
                aria-pressed={scale === option.scale}
                onClick={() => handleScaleChange(option.scale)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasLines ? (
        <div className="apple-empty-state lob-empty-state flex-1">
          <p>
            No se detectaron actividades repetitivas suficientes para generar Línea de Balance.
            <br />
            <span className="lob-empty-state__hint">
              Usa tareas con WBS/nombres por nivel, piso o unidad para construir flujo de producción.
            </span>
          </p>
        </div>
      ) : null}

      {hasLines && diagnostics.length > 0 && (
        <section
          data-testid="lob-feedback"
          className="apple-module-header grid gap-2 px-4 py-3 md:grid-cols-3"
        >
          {diagnostics.slice(0, 3).map((diagnostic, index) => (
            <article
              key={`${diagnostic.kind}-${diagnostic.activityIds.join("-")}-${index}`}
              data-testid="lob-feedback-card"
              className="apple-section px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="lob-feedback-card__severity text-[0.6875rem] font-semibold uppercase text-[var(--color-text-muted)]"
                >
                  {diagnostic.severity === "high"
                    ? "Alta"
                    : diagnostic.severity === "medium"
                      ? "Media"
                      : "Baja"}
                </span>
                <span className="text-[0.6875rem] text-[var(--color-text-muted)]">
                  {diagnostic.unitIndices.length > 0
                    ? `Unid. ${diagnostic.unitIndices.map((unitIndex) => unitIndex + 1).join(", ")}`
                    : "General"}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-strong)]">
                {diagnostic.message}
              </p>
              <p
                className="lob-feedback-card__recommendation mt-1 overflow-hidden text-xs text-[var(--color-text-muted)]"
              >
                {diagnostic.recommendation}
              </p>
            </article>
          ))}
        </section>
      )}

      {hasLines ? (
        <div className="flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-x-hidden overflow-y-auto p-4">
          <svg
            data-testid="lob-chart-svg"
            data-pannable={zoomLevel > ZOOM_MIN}
            data-dragging={dragState != null}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMinYMin meet"
            className="lob-chart"
            onWheel={handleChartWheel}
            onPointerDown={handleChartPointerDown}
            onPointerMove={handleChartPointerMove}
            onPointerUp={handleChartPointerEnd}
            onPointerCancel={handleChartPointerEnd}
            onPointerLeave={handleChartPointerEnd}
          >
          <defs>
            <clipPath id={plotClipPathId}>
              <rect
                x={MARGIN.left}
                y={MARGIN.top}
                width={chartWidth}
                height={chartHeight}
              />
            </clipPath>
          </defs>
          {/* Background */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={chartWidth}
            height={chartHeight}
            fill="var(--color-bg-elevated)"
            stroke="var(--color-hairline)"
            strokeWidth={1}
            className="lob-chart__frame"
          />

          <g clipPath={`url(#${plotClipPathId})`}>
            {/* Horizontal grid lines (units) */}
            {unitLabels.map((ul) => {
              const y = unitToY(ul.index, layout.totalUnits, height);
              return (
                <line
                  key={`hgrid-${ul.index}`}
                  x1={MARGIN.left}
                  y1={y}
                  x2={width - MARGIN.right}
                  y2={y}
                  stroke="var(--aia-corp-mid)"
                  strokeOpacity={0.15}
                  strokeWidth={1}
                />
              );
            })}

            {/* Vertical grid lines (dates) */}
            {dateTicks.map((tick) => {
              const x = dateToX(tick, chartXScale.min, chartXScale.max, chartWidth);
              return (
                <line
                  key={`vgrid-${tick.getTime()}`}
                  data-testid="lob-x-grid"
                  x1={x}
                  y1={MARGIN.top}
                  x2={x}
                  y2={height - MARGIN.bottom}
                  stroke="var(--aia-corp-mid)"
                  strokeOpacity={0.15}
                  strokeWidth={1}
                />
              );
            })}

            {/* Tolerance bands — ±10% around each planned line */}
            {plannedLines.map((line) => {
              if (line.points.length < 2) return null;
              const maxUnit = layout.totalUnits || 1;
              const bandPoints = line.points.map((p) => {
                const x = dateToX(p.date, chartXScale.min, chartXScale.max, chartWidth);
                const yCenter = unitToY(p.unitIndex, maxUnit, height);
                return { x, yCenter };
              });

              // Build a polygon: top edge → bottom edge (reversed)
              const topEdge = bandPoints.map(
                (bp) => `${bp.x},${bp.yCenter - toleranceBandHeight}`,
              );
              const bottomEdge = bandPoints
                .map((bp) => `${bp.x},${bp.yCenter + toleranceBandHeight}`)
                .reverse();
              const polygonPoints = [...topEdge, ...bottomEdge].join(" ");

              return (
                <polygon
                  key={`band-${line.activityId}`}
                  points={polygonPoints}
                  fill={line.color}
                  fillOpacity={0.08}
                  stroke="none"
                />
              );
            })}

            {/* Planned lines (solid) */}
            {plannedLines.map((line) => {
              const maxUnit = layout.totalUnits || 1;
              const polyline = line.points
                .map((p) => {
                  const x = dateToX(p.date, chartXScale.min, chartXScale.max, chartWidth);
                  const y = unitToY(p.unitIndex, maxUnit, height);
                  return `${x},${y}`;
                })
                .join(" ");

              return (
                <g key={`planned-${line.activityId}`}>
                  <polyline
                    data-testid="lob-planned-line"
                    points={polyline}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* Data points */}
                  {line.points.map((p) => {
                    const x = dateToX(p.date, chartXScale.min, chartXScale.max, chartWidth);
                    const y = unitToY(p.unitIndex, maxUnit, height);
                    return (
                      <circle
                        key={`point-${line.activityId}-${p.unitIndex}`}
                        cx={x}
                        cy={y}
                        r={4}
                        fill={line.color}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Actual lines (dashed) */}
            {actualLines.map((line) => {
              const maxUnit = layout.totalUnits || 1;
              const polyline = line.points
                .map((p) => {
                  const x = dateToX(p.date, chartXScale.min, chartXScale.max, chartWidth);
                  const y = unitToY(p.unitIndex, maxUnit, height);
                  return `${x},${y}`;
                })
                .join(" ");

              return (
                <g key={`actual-${line.activityId}`}>
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={2}
                    strokeDasharray="6,4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeOpacity={0.85}
                  />
                  {line.points.map((p) => {
                    const x = dateToX(p.date, chartXScale.min, chartXScale.max, chartWidth);
                    const y = unitToY(p.unitIndex, maxUnit, height);
                    return (
                      <circle
                        key={`actual-point-${line.activityId}-${p.unitIndex}`}
                        cx={x}
                        cy={y}
                        r={3.5}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Critical deviation highlights — red segments where actual > planned by >20% */}
            {(() => {
              const highlights: React.ReactElement[] = [];
              for (const actualLine of actualLines) {
                const plannedLine = plannedLines.find(
                  (pl) => pl.activityId === actualLine.activityId.replace("-actual", ""),
                );
                if (!plannedLine) continue;

                const maxUnit = layout.totalUnits || 1;
                for (const aPoint of actualLine.points) {
                  const matchingPlanned = plannedLine.points.find(
                    (pp) => pp.unitIndex === aPoint.unitIndex,
                  );
                  if (!matchingPlanned) continue;

                  const deviationMs = aPoint.date.getTime() - matchingPlanned.date.getTime();
                  const plannedDurationMs = Math.abs(
                    plannedLine.points.length > 1
                      ? plannedLine.points[plannedLine.points.length - 1].date.getTime() -
                        plannedLine.points[0].date.getTime()
                      : 86400000,
                  );

                  if (plannedDurationMs > 0 && deviationMs > plannedDurationMs * 0.2) {
                    const x1 = dateToX(matchingPlanned.date, chartXScale.min, chartXScale.max, chartWidth);
                    const y1 = unitToY(matchingPlanned.unitIndex, maxUnit, height);
                    const x2 = dateToX(aPoint.date, chartXScale.min, chartXScale.max, chartWidth);
                    const y2 = unitToY(aPoint.unitIndex, maxUnit, height);

                    highlights.push(
                      <line
                        key={`critical-${actualLine.activityId}-${aPoint.unitIndex}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="var(--aia-alert-main)"
                        strokeWidth={3}
                        strokeOpacity={0.6}
                        strokeDasharray="4,3"
                      />,
                    );
                  }
                }
              }
              return highlights;
            })()}

            {showBottlenecks ? (
              <g data-testid="lob-bottleneck-markers">
                {bottleneckMarkers.map((marker) => (
                  <g
                    key={marker.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${marker.title}. ${marker.diagnostic.message}`}
                    data-testid="lob-bottleneck-marker"
                    className="lob-bottleneck-marker"
                    transform={`translate(${marker.x}, ${marker.y})`}
                    onClick={() => setActiveBottleneckId(marker.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveBottleneckId(marker.id);
                      }
                    }}
                    onMouseEnter={() => setActiveBottleneckId(marker.id)}
                    onMouseLeave={() => setActiveBottleneckId(null)}
                    onFocus={() => setActiveBottleneckId(marker.id)}
                    onBlur={() => setActiveBottleneckId(null)}
                  >
                    <circle className="lob-bottleneck-marker__halo" r={12} />
                    <circle className="lob-bottleneck-marker__dot" r={6} />
                    <text
                      className="lob-bottleneck-marker__glyph"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      !
                    </text>
                  </g>
                ))}
              </g>
            ) : null}
          </g>

          {showBottlenecks && activeBottleneck ? (
            <g
              data-testid="lob-bottleneck-tooltip"
              className="lob-bottleneck-tooltip"
              transform={`translate(${clamp(
                activeBottleneck.x + 16,
                MARGIN.left,
                width - MARGIN.right - BOTTLENECK_TOOLTIP_WIDTH,
              )}, ${clamp(
                activeBottleneck.y - BOTTLENECK_TOOLTIP_HEIGHT - 12,
                MARGIN.top,
                height - MARGIN.bottom - BOTTLENECK_TOOLTIP_HEIGHT,
              )})`}
            >
              <rect
                className="lob-bottleneck-tooltip__panel"
                width={BOTTLENECK_TOOLTIP_WIDTH}
                height={BOTTLENECK_TOOLTIP_HEIGHT}
              />
              <text
                className="lob-bottleneck-tooltip__title"
                x={12}
                y={18}
              >
                {activeBottleneck.title}
              </text>
              <text className="lob-bottleneck-tooltip__body" x={12} y={38}>
                {activeBottleneck.lines.map((line, index) => (
                  <tspan
                    key={`${activeBottleneck.id}-${index}`}
                    x={12}
                    dy={index === 0 ? 0 : BOTTLENECK_TOOLTIP_LINE_HEIGHT}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ) : null}

          {/* X-axis labels (dates) */}
          {dateTicks.map((tick) => {
            const x = dateToX(tick, chartXScale.min, chartXScale.max, chartWidth);
            return (
              <text
                key={`xlabel-${tick.getTime()}`}
                x={x}
                y={height - MARGIN.bottom + 18}
                textAnchor="middle"
                data-testid="lob-x-tick-label"
                className="lob-chart__tick-label"
              >
                {formatTickLabel(tick, scale)}
              </text>
            );
          })}

          {/* Y-axis labels (units) */}
          {unitLabels.map((ul) => {
            const y = unitToY(ul.index, layout.totalUnits, height);
            return (
              <text
                key={`ylabel-${ul.index}`}
                x={MARGIN.left - 10}
                y={y + 4}
                textAnchor="end"
                className="lob-chart__tick-label"
              >
                {ul.label}
              </text>
            );
          })}

          {/* Axis labels */}
          <text
            x={MARGIN.left + chartWidth / 2}
            y={height - 8}
            textAnchor="middle"
            className="lob-chart__axis-label"
          >
            Tiempo
          </text>
          <text
            x={12}
            y={MARGIN.top + chartHeight / 2}
            textAnchor="middle"
            className="lob-chart__axis-label"
            transform={`rotate(-90, 12, ${MARGIN.top + chartHeight / 2})`}
          >
            Unidades de Producción
          </text>

          {/* Axes border */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top}
            x2={MARGIN.left}
            y2={height - MARGIN.bottom}
            stroke="var(--gray-400)"
            strokeWidth={1}
          />
          <line
            x1={MARGIN.left}
            y1={height - MARGIN.bottom}
            x2={width - MARGIN.right}
            y2={height - MARGIN.bottom}
            stroke="var(--gray-400)"
            strokeWidth={1}
          />

          {/* Legend — bottom right */}
          <g
            transform={`translate(${width - MARGIN.right + 12}, ${MARGIN.top})`}
          >
            <text
              x={0}
              y={0}
              className="lob-chart__legend-title"
            >
              Leyenda
            </text>
            {legendItems.map((item, i) => (
              <g
                key={item.name}
                transform={`translate(0, ${20 + i * 22})`}
              >
                <line
                  x1={0}
                  y1={0}
                  x2={18}
                  y2={0}
                  stroke={item.color}
                  strokeWidth={2.5}
                />
                <circle cx={9} cy={0} r={3} fill={item.color} stroke="white" strokeWidth={1} />
                <text
                  x={24}
                  y={4}
                  className="lob-chart__legend-label"
                >
                  {item.name}
                </text>
              </g>
            ))}
            {/* Legend for line styles */}
            <g transform={`translate(0, ${20 + legendItems.length * 22 + 10})`}>
              <text
                x={0}
                y={0}
                className="lob-chart__legend-style"
              >
                ─── Planificado
              </text>
              <text
                x={0}
                y={14}
                className="lob-chart__legend-style"
              >
                - - - Real
              </text>
            </g>
          </g>
        </svg>
      </div>
      ) : null}
    </div>
  );
}
