"use client";

import { HelpCircle } from "lucide-react";
import type { ViewType } from "@/components/gantt/toolbar/viewTypes";
import { viewHelpFor } from "@/lib/gantt/viewHelp";

interface ViewHelpPanelProps {
  view: ViewType;
  onClose: () => void;
}

export default function ViewHelpPanel({ view, onClose }: ViewHelpPanelProps) {
  const help = viewHelpFor(view);
  if (!help) return null;

  return (
    <aside className="gantt-view-help" role="dialog" aria-label="Ayuda de esta vista">
      <header className="gantt-view-help__header">
        <h2>
          <HelpCircle size={15} aria-hidden /> {help.title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Cerrar ayuda">
          ×
        </button>
      </header>
      <p data-testid="view-help-purpose">{help.purpose}</p>
      <p data-testid="view-help-needs" className="gantt-view-help__needs">
        <strong>Qué necesita:</strong> {help.needs}
      </p>
    </aside>
  );
}
