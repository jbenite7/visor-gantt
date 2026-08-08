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

  const toggle = (id: string) =>
    setRejected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const accepted = <T extends { id: string }>(items: T[]) =>
    items.filter((item) => !rejected.has(item.id)).map((item) => item.id);

  const isEmpty =
    proposal.locations.length === 0 &&
    proposal.scopes.length === 0 &&
    proposal.recipes.length === 0;

  const renderGroup = (
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
                checked={!rejected.has(item.id)}
                onChange={() => toggle(item.id)}
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

      {renderGroup("Ubicaciones", proposal.locations, "proposal-locations")}
      {renderGroup("Alcances", proposal.scopes, "proposal-scopes")}
      {renderGroup("Recetas", proposal.recipes, "proposal-recipes")}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isEmpty}
          onClick={() =>
            onAccept({
              locationIds: accepted(proposal.locations),
              scopeIds: accepted(proposal.scopes),
              recipeIds: accepted(proposal.recipes),
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
