"use client";

import { Users } from "lucide-react";
import type { UILocale } from "@/types/ui";

interface ResourcesEmptyStateProps {
  locale?: UILocale;
  /** Lleva a la Hoja de Recursos, donde se crea el primero a mano. */
  onCreateResource: () => void;
  /** El presupuesto no necesita recursos: se llega igual desde aquí. */
  onOpenBudget: () => void;
}

interface SubTabCopy {
  name: string;
  what: string;
}

interface EmptyStateCopy {
  title: string;
  what: string;
  origen: string;
  subTabsIntro: string;
  subTabs: SubTabCopy[];
  create: string;
  budget: string;
}

/**
 * «Recursos» era la última vista muda: 217 caracteres, «0 / 0 recursos» y cinco
 * sub-pestañas vacías detrás, sin una palabra de qué son ni de dónde salen.
 *
 * Se llena en vez de esconderse porque está medido sobre los tres `.mpp` reales
 * del repositorio: **17, 1 y 0 recursos con nombre** (449, 1.475 y 213
 * asignaciones). Contar en crudo daría 18, 2 y 1, pero los tres archivos traen
 * además el recurso nulo de MS Project, sin nombre.
 *
 * Las dos caras de esa medición mandan en el diseño: **un tercio de las obras
 * usa la hoja en serio**, así que esconderla escondería contenido real; pero
 * **dos de tres llegan vacías**, así que este estado es el caso mayoritario y
 * tiene que enseñar, no disculparse (F7 · R9).
 */
export default function ResourcesEmptyState({
  locale = "es",
  onCreateResource,
  onOpenBudget,
}: ResourcesEmptyStateProps) {
  const copy: EmptyStateCopy =
    locale === "en"
      ? {
          title: "This schedule has no resources yet",
          what: "The resource sheet is the site roster: crews, equipment and materials — the rebar helper, the excavator, the column formwork. Each one is assigned to schedule tasks, and that is where the weekly demand for people and machines comes from.",
          origen:
            "They come from two places. If you import a Microsoft Project .mpp file, its resources and assignments come inside and show up here on their own — real site schedules usually carry between two and twenty crews. If the schedule was built here, you create them by hand, one at a time.",
          subTabsIntro: "As soon as there is one resource, five tabs appear here:",
          subTabs: [
            { name: "Resource Sheet", what: "the roster, with each rate and availability" },
            { name: "Resource Usage", what: "how many hours each crew takes, week by week" },
            { name: "Assignments", what: "which resource works on which task, and at what units" },
            { name: "Budget", what: "the planned cost, importable from CSV" },
            { name: "Mapping", what: "which budget line matches which task" },
          ],
          create: "Create the first resource",
          budget: "Open the budget",
        }
      : {
          title: "Este cronograma todavía no tiene recursos",
          what: "La hoja de recursos es la lista de la obra: cuadrillas, equipos y materiales — el ayudante de armado, la retroexcavadora, la formaleta de columnas. Cada uno se asigna a las tareas del cronograma, y de ahí sale cuánta gente y cuánta máquina pide cada semana.",
          origen:
            "Salen de dos sitios. Si importas un archivo .mpp de Microsoft Project, los recursos y sus asignaciones vienen dentro y aparecen aquí solos — los cronogramas de obra reales suelen traer entre dos y veinte cuadrillas. Si el cronograma se armó aquí, se crean a mano, uno por uno.",
          subTabsIntro: "En cuanto haya un recurso aparecen aquí cinco pestañas:",
          subTabs: [
            { name: "Hoja de Recursos", what: "la lista, con la tarifa y la disponibilidad de cada uno" },
            { name: "Uso de Recursos", what: "cuántas horas pide cada cuadrilla, semana a semana" },
            { name: "Asignaciones", what: "qué recurso trabaja en qué tarea y con qué dedicación" },
            { name: "Presupuesto", what: "el costo previsto, importable desde un CSV" },
            { name: "Mapeo", what: "qué partida del presupuesto corresponde a qué tarea" },
          ],
          create: "Crear el primer recurso",
          budget: "Abrir el presupuesto",
        };

  return (
    <div
      data-testid="resources-empty-state"
      className="apple-module h-full overflow-auto"
    >
      <div className="mx-auto max-w-prose px-6 py-10">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[var(--aia-corp-main)]" />
          <h2 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--color-text-strong)]">
            {copy.title}
          </h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {copy.what}
        </p>

        <p
          data-testid="resources-empty-origen"
          className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]"
        >
          {copy.origen}
        </p>

        <p className="mt-6 text-sm font-semibold text-[var(--color-text-strong)]">
          {copy.subTabsIntro}
        </p>
        <ul className="mt-2 space-y-1.5">
          {copy.subTabs.map((tab) => (
            <li
              key={tab.name}
              data-testid="resources-empty-subtab"
              className="text-sm text-[var(--color-text-muted)]"
            >
              <span className="font-semibold text-[var(--color-text-strong)]">
                {tab.name}
              </span>
              {` · ${tab.what}`}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="resources-empty-create"
            onClick={onCreateResource}
            className="rounded-lg bg-[var(--aia-corp-main)] px-4 py-2 text-xs font-semibold text-white"
          >
            {copy.create}
          </button>
          <button
            type="button"
            data-testid="resources-empty-budget"
            onClick={onOpenBudget}
            className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)]"
          >
            {copy.budget}
          </button>
        </div>
      </div>
    </div>
  );
}
