"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import LastPlannerView from "./LastPlannerView";
import {
  observationsToCsv,
  observationsToLpsCsv,
  type Observation,
} from "@/lib/observations/observations";

interface ObservationsViewProps {
  observations: Observation[];
  /** El compromiso semanal se arma con las actividades del cronograma. */
  tasks: GanttTask[];
  /** Fecha de corte en ISO, para el compromiso. */
  statusDate?: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

type Pestana = "registro" | "compromiso";

function formatDay(iso: string): string {
  const fecha = new Date(iso);
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}

/**
 * Todas las observaciones del proyecto en una pantalla.
 *
 * El panel por tarea sirve para anotar sobre la barra, pero no para pasar
 * revista: quien llega el lunes quiere ver todo lo pendiente de la obra sin ir
 * tarea por tarea. Es la vista que tenía el visor 1.0.
 */
/**
 * Lo anotado y lo comprometido, en la misma pantalla.
 *
 * Una restricción de Last Planner **es** una observación con responsable y
 * fecha —el CSV de compromisos sale de aquí mismo—, así que son dos vistas de
 * lo mismo, no dos entradas del menú. El menú se recortó de 14 a 9 con
 * esfuerzo: cada puerta nueva hay que justificarla.
 */
export default function ObservationsView({
  observations,
  tasks,
  statusDate,
  onToggle,
  onDelete,
}: ObservationsViewProps) {
  const [pestana, setPestana] = useState<Pestana>("registro");
  const pendientes = observations.filter((o) => o.status === "pending");
  const atendidas = observations.filter((o) => o.status === "done");

  const descargar = (kind: "csv" | "lps") => {
    const contenido =
      kind === "csv"
        ? observationsToCsv(observations)
        : observationsToLpsCsv(observations);
    const blob = new Blob([`﻿${contenido}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      kind === "csv" ? "observaciones.csv" : "observaciones-lps.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const pestanas = (
    <div className="apple-segmented m-5 mb-0 inline-flex">
      {(
        [
          ["registro", "Observaciones"],
          ["compromiso", "Compromiso semanal"],
        ] as const
      ).map(([id, etiqueta]) => (
        <button
          key={id}
          type="button"
          data-testid={`observations-tab-${id}`}
          data-active={pestana === id}
          aria-pressed={pestana === id}
          onClick={() => setPestana(id)}
          className="gantt-typical-unit-mode rounded-md px-3 py-1 text-sm font-semibold"
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );

  if (pestana === "compromiso") {
    return (
      <div
        data-testid="observations-view"
        className="apple-module flex h-full flex-col overflow-auto"
      >
        {pestanas}
        <div className="min-h-0 flex-1">
          <LastPlannerView tasks={tasks} statusDate={statusDate} />
        </div>
      </div>
    );
  }

  if (observations.length === 0) {
    return (
      <div
        data-testid="observations-view"
        className="apple-module h-full overflow-auto"
      >
        {pestanas}
        <div
          data-testid="observations-empty"
          className="apple-section m-5 flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-[var(--color-text-muted)]"
        >
          <p className="font-semibold text-[var(--color-text-strong)]">
            Todavía no hay observaciones
          </p>
          <p>
            Una observación es lo que encuentras en obra y no está en el plan:
            «falta acero de refuerzo en el eje 3», «el andamio llega el jueves».
            Se anotan sobre la actividad, desde el cronograma, y aparecen aquí
            para pasar revista y compartirlas con el equipo.
          </p>
        </div>
      </div>
    );
  }

  const lista = (items: Observation[], testId: string) => (
    <ul data-testid={testId} className="flex flex-col">
      {items.map((o) => (
        <li
          key={o.id}
          data-status={o.status}
          className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-hairline)] px-5 py-3 last:border-0"
        >
          <div className="min-w-0">
            <p className="text-sm text-[var(--color-text-strong)]">{o.text}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {o.wbs ? `${o.wbs} · ` : ""}
              {o.taskName} · {formatDay(o.createdAt)}
              {o.responsible ? ` · ${o.responsible}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-testid={`observation-toggle-${o.id}`}
              onClick={() => onToggle(o.id)}
              className="apple-button-secondary rounded-[var(--radius-lg)] px-3 py-1 text-sm font-semibold"
            >
              {o.status === "pending" ? "Marcar atendida" : "Reabrir"}
            </button>
            <button
              type="button"
              data-testid={`observation-delete-${o.id}`}
              onClick={() => onDelete(o.id)}
              aria-label={`Eliminar la observación «${o.text}»`}
              className="gantt-project-toolbar__button gantt-project-toolbar__button--danger"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      data-testid="observations-view"
      className="apple-module h-full overflow-auto"
    >
      {pestanas}
      <div className="apple-module-header flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">
            Observaciones de la obra
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {pendientes.length === 1
              ? "1 pendiente"
              : `${pendientes.length} pendientes`}{" "}
            · {atendidas.length} atendidas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="observations-export-csv"
            onClick={() => descargar("csv")}
            className="apple-button-secondary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-1.5 text-sm font-semibold"
          >
            <Download size={14} aria-hidden />
            CSV
          </button>
          <button
            type="button"
            data-testid="observations-export-lps"
            onClick={() => descargar("lps")}
            className="apple-button-secondary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-1.5 text-sm font-semibold"
          >
            <Download size={14} aria-hidden />
            CSV (Last Planner)
          </button>
        </div>
      </div>

      <section className="apple-section m-5">
        <h3 className="px-5 py-3 text-sm font-semibold text-[var(--color-text-strong)]">
          Pendientes
        </h3>
        {pendientes.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-[var(--color-text-muted)]">
            Nada pendiente. Todo lo anotado está atendido.
          </p>
        ) : (
          lista(pendientes, "observations-pending")
        )}
      </section>

      <section className="apple-section m-5">
        <h3 className="px-5 py-3 text-sm font-semibold text-[var(--color-text-strong)]">
          Atendidas
        </h3>
        {atendidas.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-[var(--color-text-muted)]">
            Todavía no se ha atendido ninguna.
          </p>
        ) : (
          lista(atendidas, "observations-done")
        )}
      </section>
    </div>
  );
}
