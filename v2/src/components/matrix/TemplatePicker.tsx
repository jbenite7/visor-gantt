"use client";

import type { MatrixTemplate } from "@/types/matrix";
import { listFactoryTemplates } from "@/lib/matrix/templateCatalog";

interface TemplatePickerProps {
  ownTemplates?: MatrixTemplate[];
  canGenerateFromSchedule: boolean;
  onPickTemplate: (template: MatrixTemplate) => void;
  onGenerateFromSchedule: () => void;
}

export default function TemplatePicker({
  ownTemplates = [],
  canGenerateFromSchedule,
  onPickTemplate,
  onGenerateFromSchedule,
}: TemplatePickerProps) {
  const factory = listFactoryTemplates();

  return (
    <section className="apple-section space-y-4 p-3" data-testid="template-picker">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
          Plantillas por tipo de obra
        </h3>
        <ul className="mt-2 space-y-1">
          {factory.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--color-hairline)] px-3 py-2 text-left text-sm"
                onClick={() => onPickTemplate(template)}
              >
                {template.name}
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                {`${template.scopeTree.length} alcances · ${template.areas.length} ubicaciones · ${template.recipes.length} recetas`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="template-picker-own">
        <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
          Tus plantillas
        </h3>
        {ownTemplates.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            Todavía no has guardado ninguna matriz como plantilla.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {ownTemplates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-[var(--color-hairline)] px-3 py-2 text-left text-sm"
                  onClick={() => onPickTemplate(template)}
                >
                  {template.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          type="button"
          disabled={!canGenerateFromSchedule}
          onClick={onGenerateFromSchedule}
          className="w-full rounded-lg border border-[var(--color-hairline)] px-3 py-2 text-sm"
        >
          Generar matriz desde el cronograma
        </button>
        {!canGenerateFromSchedule && (
          <p
            data-testid="template-picker-generate-hint"
            className="text-xs text-[var(--color-text-muted)]"
          >
            Carga primero un cronograma para que la matriz proponga alcances y ubicaciones.
          </p>
        )}
      </div>
    </section>
  );
}
