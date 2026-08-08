import type { UISettings } from "@/types/ui";

/**
 * El modo Simple estaba pensado como puerta de entrada, no como preferencia
 * permanente: se ofrece la primera vez y a partir de ahí manda lo que el
 * usuario haya elegido (E36).
 */
export function resolveInteractionMode(
  settings: Pick<UISettings, "interactionMode">,
  context: { isFirstVisit: boolean; hasHistory?: boolean },
): "simple" | "advanced" {
  if (settings.interactionMode) return settings.interactionMode;
  if (context.hasHistory) return "advanced";
  return context.isFirstVisit ? "simple" : "advanced";
}
