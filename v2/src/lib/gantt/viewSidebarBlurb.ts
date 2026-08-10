import type { ViewType } from "@/components/gantt/toolbar/viewTypes";
import { viewHelpFor } from "./viewHelp";

/**
 * Lo que la entrada del menú dice de sí misma.
 *
 * «Matriz» era un botón de 12 caracteres con 26 tareas de trabajo detrás: la
 * puerta no delataba la habitación. El texto no se redacta aquí de cero — el
 * propósito de cada vista ya estaba escrito en la ayuda por vista (E8) — pero
 * las dos vistas que dependen de que haya datos cargados dicen además cuánto
 * hay, porque «26 ubicaciones» convence de entrar y «Matriz» no.
 */
export interface ViewSidebarContext {
  /** Ubicaciones del plan matricial, si lo hay. */
  areaCount?: number;
  /** Recursos cargados en el proyecto. */
  resourceCount?: number;
}

export function viewSidebarBlurb(
  view: ViewType,
  context: ViewSidebarContext = {},
): string {
  if (view === "matrix") {
    const areas = context.areaCount ?? 0;
    if (areas <= 0) {
      return "Todavía no hay matriz: cruza alcances con ubicaciones para armar la obra por celdas.";
    }
    return areas === 1
      ? "1 ubicación programada"
      : `${areas} ubicaciones programadas`;
  }

  if (view === "resources") {
    const resources = context.resourceCount ?? 0;
    if (resources <= 0) {
      return "Todavía no hay recursos: aquí se ve quién y qué hace falta en cada actividad.";
    }
    return resources === 1
      ? "1 recurso asignado"
      : `${resources} recursos asignados`;
  }

  return viewHelpFor(view)?.purpose ?? "";
}
