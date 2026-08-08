"use client";

import { useState } from "react";
import { ChevronDown, Save, Trash2 } from "lucide-react";

export interface BaselineMenuProps {
  baselines: { id: string; name: string }[];
  activeBaselineId?: string;
  /** Nombre que se ofrece si el usuario no escribe ninguno. */
  proposedName: string;
  onSave: (name: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Guardar una línea base es un acto con fecha y motivo («antes de la lluvia»,
 * «aprobada por la interventoría»). Un número correlativo no dice nada tres
 * meses después, por eso se pide nombre al guardar.
 */
export default function BaselineMenu({
  baselines,
  activeBaselineId,
  proposedName,
  onSave,
  onSelect,
  onDelete,
}: BaselineMenuProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(proposedName);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeName =
    baselines.find((b) => b.id === activeBaselineId)?.name ?? "Línea base";

  const openNaming = () => {
    setName(proposedName);
    setNaming(true);
  };

  const confirm = () => {
    onSave(name.trim() || proposedName);
    setNaming(false);
  };

  return (
    <div className="gantt-project-toolbar__group gantt-project-toolbar__baseline-group">
      <button
        type="button"
        data-testid="baseline-save-open"
        onClick={openNaming}
        title="Guardar línea base"
        className="gantt-project-toolbar__button gantt-project-toolbar__button--text"
      >
        <Save className="gantt-project-toolbar__small-icon" aria-hidden />
        <span>Línea base</span>
      </button>

      {naming && (
        <>
          <input
            autoFocus
            data-testid="baseline-name-input"
            value={name}
            aria-label="Nombre de la línea base"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirm();
              if (event.key === "Escape") setNaming(false);
            }}
            className="gantt-project-toolbar__baseline-name"
          />
          <button
            type="button"
            data-testid="baseline-save-confirm"
            onClick={confirm}
            className="gantt-project-toolbar__button gantt-project-toolbar__button--text"
          >
            Guardar
          </button>
        </>
      )}

      {baselines.length > 0 && (
        <div className="relative">
          <button
            type="button"
            data-testid="baseline-menu-open"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            title="Elegir o borrar una línea base"
            data-active={Boolean(activeBaselineId)}
            className="gantt-project-toolbar__button gantt-project-toolbar__button--text gantt-project-toolbar__baseline-select"
          >
            <span className="truncate">{activeName}</span>
            <ChevronDown className="gantt-project-toolbar__chevron" aria-hidden />
          </button>

          {menuOpen && (
            <div className="gantt-project-toolbar__baseline-menu">
              {baselines.map((baseline) => (
                <div
                  key={baseline.id}
                  className="gantt-project-toolbar__baseline-option"
                  data-active={baseline.id === activeBaselineId}
                >
                  <button
                    type="button"
                    data-testid={`baseline-select-${baseline.id}`}
                    onClick={() => {
                      onSelect(baseline.id);
                      setMenuOpen(false);
                    }}
                    className="gantt-project-toolbar__baseline-option-name"
                  >
                    {baseline.name}
                    {baseline.id === activeBaselineId && (
                      <span className="gantt-project-toolbar__baseline-current">
                        ●
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    data-testid={`baseline-delete-${baseline.id}`}
                    onClick={() => onDelete(baseline.id)}
                    className="gantt-project-toolbar__baseline-delete"
                  >
                    <Trash2
                      className="gantt-project-toolbar__small-icon"
                      aria-hidden
                    />
                    Borrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
