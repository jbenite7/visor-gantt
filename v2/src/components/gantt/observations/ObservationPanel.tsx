"use client";

import { useState } from "react";
import { Download, MessageSquarePlus } from "lucide-react";
import {
  observationsToCsv,
  observationsToLpsCsv,
  type Observation,
} from "@/lib/observations/observations";

interface ObservationPanelProps {
  taskId: string | number;
  taskName: string;
  observations: Observation[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * Anotar sobre la actividad seleccionada, sin salir del cronograma.
 * Es la entrada del loop: anotar → ver el pendiente sobre la barra → atender.
 */
export default function ObservationPanel({
  taskId,
  taskName,
  observations,
  onAdd,
  onToggle,
  onDelete,
  onClose,
}: ObservationPanelProps) {
  const [text, setText] = useState("");
  const forTask = observations.filter((o) => o.taskId === taskId);
  const canSave = text.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onAdd(text);
    setText("");
  };

  // El registro se comparte con el equipo: por eso el export vive junto a la lista.
  const download = (kind: "csv" | "lps") => {
    const content =
      kind === "csv"
        ? observationsToCsv(observations)
        : observationsToLpsCsv(observations);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      kind === "csv" ? "observaciones.csv" : "observaciones-lps.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="gantt-observation-panel" data-testid="observation-panel">
      <header className="gantt-observation-panel__header">
        <strong>{taskName}</strong>
        <button type="button" onClick={onClose} aria-label="Cerrar observaciones">
          ×
        </button>
      </header>

      <div className="gantt-observation-panel__list">
        {forTask.length === 0 ? (
          <p className="gantt-observation-panel__empty">
            Sin observaciones. Anota lo que encontraste en obra para que quede
            registrado sobre el cronograma.
          </p>
        ) : (
          forTask.map((o) => (
            <div key={o.id} className="gantt-observation-item" data-status={o.status}>
              <p>{o.text}</p>
              <div className="gantt-observation-item__actions">
                <button
                  type="button"
                  onClick={() => onToggle(o.id)}
                  className="gantt-observation-item__status"
                >
                  {o.status === "pending" ? "Pendiente" : "Atendida"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(o.id)}
                  aria-label="Eliminar observación"
                  className="gantt-observation-item__delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {observations.length > 0 && (
        <div className="gantt-observation-panel__export">
          <button type="button" onClick={() => download("csv")}>
            <Download size={13} aria-hidden />
            CSV
          </button>
          <button type="button" onClick={() => download("lps")}>
            <Download size={13} aria-hidden />
            CSV (Last Planner)
          </button>
          <span>{observations.length} en el proyecto</span>
        </div>
      )}

      <div className="gantt-observation-panel__form">
        <textarea
          rows={2}
          value={text}
          placeholder="Agregar una observación…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              save();
            }
          }}
        />
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="apple-button-primary gantt-observation-panel__save"
        >
          <MessageSquarePlus size={15} aria-hidden />
          Guardar observación
        </button>
      </div>
    </aside>
  );
}
