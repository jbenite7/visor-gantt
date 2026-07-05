"use client";

import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import type { PlanningRecommendation } from "@/lib/gantt/planningRecommendations";
import type { UILocale } from "@/types/ui";

interface PlanningAssistantPanelProps {
  recommendations: PlanningRecommendation[];
  locale: UILocale;
  structurePreview?: {
    changedTaskCount: number;
    changedWbsCount: number;
    changedSummaryCount: number;
  };
  onPreviewStructureNormalization?: () => void;
  onApplyStructureNormalization?: () => void;
  onCancelStructurePreview?: () => void;
}

function severityLabel(severity: PlanningRecommendation["severity"], locale: UILocale): string {
  if (locale === "en") {
    if (severity === "high") return "High";
    if (severity === "medium") return "Medium";
    return "Low";
  }
  if (severity === "high") return "Alta";
  if (severity === "medium") return "Media";
  return "Baja";
}

function severityColor(severity: PlanningRecommendation["severity"]): string {
  if (severity === "high") return "var(--aia-alert-main)";
  if (severity === "medium") return "var(--aia-warn-main)";
  return "var(--aia-proj-main)";
}

export default function PlanningAssistantPanel({
  recommendations,
  locale,
  structurePreview,
  onPreviewStructureNormalization,
  onApplyStructureNormalization,
  onCancelStructurePreview,
}: PlanningAssistantPanelProps) {
  const highCount = recommendations.filter((item) => item.severity === "high").length;
  const mediumCount = recommendations.filter((item) => item.severity === "medium").length;
  const visible = recommendations.slice(0, 3);
  const canNormalizeStructure = recommendations.some((item) =>
    ["wbsMismatch", "outlineJump", "summaryWithoutChildren"].includes(item.kind),
  );

  return (
    <section
      data-testid="planning-assistant-panel"
      className="apple-module-header px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {recommendations.length > 0 ? (
            <Lightbulb size={16} color="var(--aia-corp-main)" />
          ) : (
            <CheckCircle2 size={16} color="var(--aia-proj-main)" />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
              {locale === "en" ? "Planning assistant" : "Asistente de planificacion"}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {recommendations.length > 0
                ? locale === "en"
                  ? `${recommendations.length} recommendations · ${highCount} high · ${mediumCount} medium`
                  : `${recommendations.length} recomendaciones · ${highCount} altas · ${mediumCount} medias`
                : locale === "en"
                  ? "No preventive recommendations detected"
                  : "Sin recomendaciones preventivas detectadas"}
            </p>
          </div>
        </div>

        {visible.length > 0 && (
          <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
            {visible.map((recommendation) => (
              <article
                key={recommendation.id}
                data-testid="planning-recommendation"
                className="apple-section min-w-0 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} color={severityColor(recommendation.severity)} />
                  <span
                    className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase text-[var(--color-text-muted)]"
                    style={{ letterSpacing: 0 }}
                  >
                    {severityLabel(recommendation.severity, locale)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-[var(--color-text-strong)]">
                  {recommendation.title}
                </p>
                <p
                  className="mt-1 overflow-hidden text-xs text-[var(--color-text-muted)]"
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                >
                  {recommendation.action}
                </p>
              </article>
            ))}
          </div>
        )}

        {canNormalizeStructure && onPreviewStructureNormalization && (
          <div
            data-testid="planning-structure-action"
            className="apple-section flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text-strong)]">
                {locale === "en" ? "Normalize WBS and hierarchy" : "Normalizar EDT y jerarquia"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {structurePreview
                  ? locale === "en"
                    ? `${structurePreview.changedTaskCount} tasks will change · ${structurePreview.changedWbsCount} WBS codes · ${structurePreview.changedSummaryCount} summaries`
                    : `${structurePreview.changedTaskCount} tareas cambiaran · ${structurePreview.changedWbsCount} EDT · ${structurePreview.changedSummaryCount} resumenes`
                  : locale === "en"
                    ? "Review the proposed structure update before applying it."
                    : "Revisa la actualizacion propuesta antes de aplicarla."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!structurePreview ? (
                <button
                  type="button"
                  data-testid="planning-preview-structure"
                  onClick={onPreviewStructureNormalization}
                  className="apple-button-secondary rounded-lg px-3 py-1 text-xs font-semibold"
                >
                  {locale === "en" ? "Preview" : "Previsualizar"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="planning-cancel-structure"
                    onClick={onCancelStructurePreview}
                    className="apple-button-secondary rounded-lg px-3 py-1 text-xs font-semibold"
                  >
                    {locale === "en" ? "Cancel" : "Cancelar"}
                  </button>
                  <button
                    type="button"
                    data-testid="planning-apply-structure"
                    onClick={onApplyStructureNormalization}
                    className="apple-button-primary rounded-lg px-3 py-1 text-xs font-semibold"
                  >
                    {locale === "en" ? "Apply" : "Aplicar"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
