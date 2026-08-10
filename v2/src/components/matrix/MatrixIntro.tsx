"use client";

import { Grid3X3 } from "lucide-react";
import type { MatrixTemplate } from "@/types/matrix";
import TemplatePicker from "./TemplatePicker";

/**
 * La portada de la Matriz.
 *
 * Era un botón de 12 caracteres —«Crear matriz»— con 26 tareas de trabajo
 * construidas detrás que no se intuían desde la puerta. La revisión en frío
 * del 2026-08-08 lo señaló como el hallazgo más caro: el patrón que este goal
 * existía para eliminar, sobreviviendo justo donde más duele.
 *
 * No construye nada nuevo: enseña lo que ya está. Y ofrece **tres** salidas,
 * no una — plantilla de fábrica, generar desde el cronograma, o empezar en
 * blanco— porque «crear matriz en blanco» sin saber qué es una matriz es
 * exactamente el muro que había antes.
 */
export interface MatrixIntroProps {
  ownTemplates?: MatrixTemplate[];
  /** Hay cronograma del que proponer una matriz. */
  canGenerateFromSchedule: boolean;
  onPickTemplate: (template: MatrixTemplate) => void;
  onGenerateFromSchedule: () => void;
  onCreateBlank: () => void;
}

const QUE_OBTIENES = [
  "El cronograma sale solo: cada celda genera sus tareas con sus fechas y sus dependencias.",
  "Cambiar un rendimiento recalcula toda la torre, no una tarea.",
  "La Línea de Balance y la Unidad Típica se llenan con las ubicaciones que declares aquí.",
];

export default function MatrixIntro({
  ownTemplates = [],
  canGenerateFromSchedule,
  onPickTemplate,
  onGenerateFromSchedule,
  onCreateBlank,
}: MatrixIntroProps) {
  return (
    <div
      data-testid="matrix-editor-empty"
      className="apple-module h-full overflow-auto"
    >
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <header className="flex items-start gap-3">
          <Grid3X3 size={20} color="var(--aia-corp-main)" className="mt-0.5 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-strong)]">
              Programación matricial
            </h2>
            <p className="mt-1 max-w-prose text-sm text-[var(--color-text-muted)]">
              Cruzas <strong>qué se hace</strong> —estructura, mampostería,
              acabados— con <strong>dónde se hace</strong> —piso 1, piso 2,
              torre B— y la app arma el cronograma celda por celda, con el ritmo
              de la obra.
            </p>
          </div>
        </header>

        <section data-testid="matrix-intro-benefits">
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
            Qué obtienes
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--color-text-muted)]">
            {QUE_OBTIENES.map((linea) => (
              <li key={linea} className="flex gap-2">
                <span aria-hidden>·</span>
                <span>{linea}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
            Por dónde empezar
          </h3>
          <div className="mt-2">
            <TemplatePicker
              ownTemplates={ownTemplates}
              canGenerateFromSchedule={canGenerateFromSchedule}
              onPickTemplate={onPickTemplate}
              onGenerateFromSchedule={onGenerateFromSchedule}
            />
          </div>
        </section>

        <section className="border-t border-[var(--color-hairline)] pt-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            ¿Prefieres armarla tú desde cero?
          </p>
          <button
            type="button"
            data-testid="matrix-create-blank"
            onClick={onCreateBlank}
            className="apple-button-secondary mt-2 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          >
            <Grid3X3 size={16} />
            Crear matriz en blanco
          </button>
        </section>
      </div>
    </div>
  );
}
