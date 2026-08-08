"use client";

import { useState } from "react";
import type { MatrixProposal, ProposalAcceptance } from "@/lib/matrix/matrixProposal";

interface ProposalReviewProps {
  proposal: MatrixProposal;
  onAccept: (acceptance: ProposalAcceptance) => void;
  onCancel: () => void;
}

/**
 * Revisión de la propuesta antes de que se construya nada.
 *
 * Todo llega marcado, porque el usuario pidió generarla; lo que se hace aquí
 * es poder quitar lo que no cuadre. Cada elemento enseña su evidencia para
 * que desmarcarlo sea una decisión informada.
 */
export default function ProposalReview({
  proposal,
  onAccept,
  onCancel,
}: ProposalReviewProps) {
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  type Group = "location" | "scope" | "recipe";

  const key = (group: Group, id: string) => `${group}:${id}`;

  const toggle = (group: Group, id: string) =>
    setRejected((current) => {
      const next = new Set(current);
      const itemKey = key(group, id);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });

  const accepted = <T extends { id: string }>(group: Group, items: T[]) =>
    items.filter((item) => !rejected.has(key(group, item.id))).map((item) => item.id);

  const isEmpty =
    proposal.locations.length === 0 &&
    proposal.scopes.length === 0 &&
    proposal.recipes.length === 0;

  const renderGroup = (
    group: Group,
    title: string,
    items: Array<{ id: string; name: string; evidence: string }>,
    testId: string,
  ) => (
    <div data-testid={testId}>
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{title}</h3>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                aria-label={item.name}
                checked={!rejected.has(key(group, item.id))}
                onChange={() => toggle(group, item.id)}
              />
              <span>
                {item.name}
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {item.evidence}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="apple-section space-y-4 p-3" data-testid="proposal-review">
      <p data-testid="proposal-summary" className="text-sm">
        {proposal.summary}
      </p>

      {renderGroup("location", "Ubicaciones", proposal.locations, "proposal-locations")}
      {renderGroup("scope", "Alcances", proposal.scopes, "proposal-scopes")}
      {renderGroup("recipe", "Recetas", proposal.recipes, "proposal-recipes")}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isEmpty}
          onClick={() =>
            onAccept({
              locationIds: accepted("location", proposal.locations),
              scopeIds: accepted("scope", proposal.scopes),
              recipeIds: proposal.recipes
                .filter(
                  (recipe) =>
                    !rejected.has(key("recipe", recipe.id)) &&
                    !rejected.has(key("scope", recipe.scopeId)),
                )
                .map((recipe) => recipe.id),
            })
          }
        >
          Crear la matriz
        </button>
        <button type="button" onClick={onCancel}>
          Descartar la propuesta
        </button>
      </div>
    </section>
  );
}
