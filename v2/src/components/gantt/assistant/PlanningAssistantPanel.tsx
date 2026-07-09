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
      className="apple-module-header gantt-aux-panel"
    >
      <div className="gantt-aux-panel__content">
        <div className="gantt-aux-panel__summary">
          {recommendations.length > 0 ? (
            <Lightbulb className="gantt-aux-panel__icon" aria-hidden />
          ) : (
            <CheckCircle2 className="gantt-aux-panel__icon gantt-aux-panel__icon--ok" aria-hidden />
          )}
          <div className="gantt-aux-panel__copy">
            <h3 className="gantt-aux-panel__title">
              {locale === "en" ? "Planning assistant" : "Asistente de planificacion"}
            </h3>
            <p className="gantt-aux-panel__description">
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
          <div className="gantt-aux-panel__cards">
            {visible.map((recommendation) => (
              <article
                key={recommendation.id}
                data-testid="planning-recommendation"
                className="apple-section gantt-aux-panel__card"
              >
                <div className="gantt-aux-panel__card-header">
                  <AlertTriangle
                    className="gantt-aux-panel__severity-icon"
                    data-severity={recommendation.severity}
                    aria-hidden
                  />
                  <span
                    className="gantt-aux-panel__severity"
                    data-severity={recommendation.severity}
                  >
                    {severityLabel(recommendation.severity, locale)}
                  </span>
                </div>
                <p className="gantt-aux-panel__card-title">
                  {recommendation.title}
                </p>
                <p className="gantt-aux-panel__card-description">
                  {recommendation.action}
                </p>
              </article>
            ))}
          </div>
        )}

        {canNormalizeStructure && onPreviewStructureNormalization && (
          <div
            data-testid="planning-structure-action"
            className="apple-section gantt-aux-panel__structure-action"
          >
            <div className="gantt-aux-panel__copy">
              <p className="gantt-aux-panel__title">
                {locale === "en" ? "Normalize WBS and hierarchy" : "Normalizar EDT y jerarquia"}
              </p>
              <p className="gantt-aux-panel__description">
                {structurePreview
                  ? locale === "en"
                    ? `${structurePreview.changedTaskCount} tasks will change · ${structurePreview.changedWbsCount} WBS codes · ${structurePreview.changedSummaryCount} summaries`
                    : `${structurePreview.changedTaskCount} tareas cambiaran · ${structurePreview.changedWbsCount} EDT · ${structurePreview.changedSummaryCount} resumenes`
                  : locale === "en"
                    ? "Review the proposed structure update before applying it."
                    : "Revisa la actualizacion propuesta antes de aplicarla."}
              </p>
            </div>
            <div className="gantt-aux-panel__actions">
              {!structurePreview ? (
                <button
                  type="button"
                  data-testid="planning-preview-structure"
                  onClick={onPreviewStructureNormalization}
                  className="apple-button-secondary gantt-aux-panel__button"
                >
                  {locale === "en" ? "Preview" : "Previsualizar"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="planning-cancel-structure"
                    onClick={onCancelStructurePreview}
                    className="apple-button-secondary gantt-aux-panel__button"
                  >
                    {locale === "en" ? "Cancel" : "Cancelar"}
                  </button>
                  <button
                    type="button"
                    data-testid="planning-apply-structure"
                    onClick={onApplyStructureNormalization}
                    className="apple-button-primary gantt-aux-panel__button"
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
