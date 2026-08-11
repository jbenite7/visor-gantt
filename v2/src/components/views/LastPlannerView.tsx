"use client";

import { useEffect, useMemo, useState } from "react";
import { formatIsoDay } from "@/lib/date/projectDate";
import { AlertTriangle, Download } from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import type { LastPlannerPreview } from "@/lib/integrations/lastPlanner";
import { formatProjectDate } from "@/lib/date/projectDate";

interface LastPlannerViewProps {
  tasks: GanttTask[];
  /** Fecha de corte en ISO: desde cuándo se arman los compromisos. */
  statusDate?: string;
}

/** Las fechas viajan como texto: la API recibe JSON, no objetos `Date`. */
function serializeTask(task: GanttTask) {
  return {
    ...task,
    start: task.start.toISOString(),
    finish: task.finish.toISOString(),
  };
}


/**
 * Compromiso semanal al estilo Last Planner.
 *
 * El motor que arma estas semanas —con sus restricciones— llevaba tiempo
 * construido y probado en `api/integrations/last-planner/preview`, y ningún
 * botón lo llamaba: era la función mejor hecha y peor conectada del producto
 * (M26). Esta vista es la que le faltaba.
 */
export default function LastPlannerView({
  tasks,
  statusDate,
}: LastPlannerViewProps) {
  const [preview, setPreview] = useState<LastPlannerPreview | null>(null);
  const [fallo, setFallo] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (tasks.length === 0) return;

    let cancelado = false;
    setCargando(true);
    setFallo(false);

    void (async () => {
      try {
        const response = await fetch(
          "/api/integrations/last-planner/preview",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tasks: tasks.map(serializeTask),
              ...(statusDate ? { statusDate } : {}),
            }),
          },
        );

        if (cancelado) return;
        if (!response.ok) {
          setFallo(true);
          return;
        }
        setPreview((await response.json()) as LastPlannerPreview);
      } catch {
        if (!cancelado) setFallo(true);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [tasks, statusDate]);

  const csv = useMemo(() => {
    if (!preview) return "";
    const filas = preview.weeks.flatMap((semana) =>
      semana.commitments.map((compromiso) =>
        [
          formatIsoDay(semana.weekStart),
          compromiso.wbs ?? "",
          compromiso.name,
          formatIsoDay(compromiso.start),
          formatIsoDay(compromiso.finish),
          compromiso.constraints.map((r) => r.message).join(" · "),
        ]
          .map((celda) => (/[;"]/.test(celda) ? `"${celda}"` : celda))
          .join(";"),
      ),
    );
    return [
      "Semana;EDT;Actividad;Inicio;Fin;Restricciones",
      ...filas,
    ].join("\n");
  }, [preview]);

  const descargar = () => {
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `compromiso-semanal-${formatProjectDate(new Date()).replace(/\//g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (tasks.length === 0) {
    return (
      <div
        data-testid="last-planner-view"
        className="apple-module h-full overflow-auto"
      >
        <div
          data-testid="lps-empty"
          className="apple-section m-5 flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-[var(--color-text-muted)]"
        >
          <p className="font-semibold text-[var(--color-text-strong)]">
            Todavía no hay compromisos que armar
          </p>
          <p>
            El compromiso semanal se arma con las actividades del cronograma.
            Importa un archivo de MS Project o crea las primeras tareas y aquí
            aparecerán las dos próximas semanas, con lo que falta para poder
            comprometerlas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="last-planner-view"
      className="apple-module h-full overflow-auto"
    >
      <div className="apple-module-header flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">
            Compromiso semanal
          </h2>
          {preview && (
            <p data-testid="lps-summary" className="text-sm text-[var(--color-text-muted)]">
              {preview.summary.totalCommitments === 1
                ? "1 compromiso"
                : `${preview.summary.totalCommitments} compromisos`}{" "}
              · {preview.summary.constrainedCommitments} con restricciones ·{" "}
              {preview.summary.criticalCommitments} en la ruta crítica
            </p>
          )}
        </div>

        {preview && (
          <button
            type="button"
            data-testid="lps-export"
            onClick={descargar}
            className="apple-button-secondary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-1.5 text-sm font-semibold"
          >
            <Download size={14} aria-hidden />
            Descargar CSV
          </button>
        )}
      </div>

      {fallo && (
        <div
          role="alert"
          className="apple-section m-5 px-4 py-3 text-sm text-[var(--aia-alert-main)]"
        >
          No pudimos armar los compromisos de estas semanas. Inténtalo de nuevo
          en un minuto.
        </div>
      )}

      {cargando && !preview && !fallo && (
        <p role="status" className="px-5 py-4 text-sm text-[var(--color-text-muted)]">
          Armando el compromiso de las próximas semanas…
        </p>
      )}

      {preview?.weeks.map((semana) => (
        <section key={semana.weekStart} className="apple-section m-5 p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
            Semana del {formatIsoDay(semana.weekStart)} al{" "}
            {formatIsoDay(semana.weekEnd)}
          </h3>

          {semana.commitments.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              No hay actividades programadas para esta semana.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {semana.commitments.map((compromiso) => (
                <li
                  key={String(compromiso.taskId)}
                  data-testid="lps-commitment"
                  data-critical={compromiso.isCritical}
                  className="border-t border-[var(--color-hairline)] pt-3 first:border-0 first:pt-0"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                    {compromiso.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {compromiso.wbs ? `${compromiso.wbs} · ` : ""}
                    {formatIsoDay(compromiso.start)} a{" "}
                    {formatIsoDay(compromiso.finish)} ·{" "}
                    {compromiso.percentComplete}% avanzado
                  </p>

                  {compromiso.constraints.map((restriccion, i) => (
                    <p
                      key={i}
                      data-testid="lps-constraint"
                      className="mt-1 flex items-center gap-1.5 text-sm text-[var(--aia-warn-main)]"
                    >
                      <AlertTriangle size={13} aria-hidden />
                      {restriccion.message}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
