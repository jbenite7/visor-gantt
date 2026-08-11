"use client";

import Link from "next/link";
import { Eye, UserPlus } from "lucide-react";
import GanttView from "@/components/views/GanttView";
import type { GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";

export interface SharedProjectViewProps {
  token: string;
  projectName: string;
  tasks: GanttTask[];
  calendar?: ProjectCalendar;
  /** ISO de la caducidad. Se enseña: caducar de sorpresa es perder confianza. */
  expiresAt: string;
}

function enDia(iso: string): string {
  const fecha = new Date(iso);
  return `${fecha.getUTCDate()}/${fecha.getUTCMonth() + 1}/${fecha.getUTCFullYear()}`;
}

/**
 * La pantalla de un cronograma abierto por enlace, sin cuenta.
 *
 * Monta el mismo `GanttView` de siempre en modo mirador. Eso es cortesía, no
 * cerradura: la garantía es que aquí no hay sesión y que un temporal no tiene
 * dueño, así que el servidor rechaza cualquier escritura aunque un control se
 * escapara en pantalla.
 */
export default function SharedProjectView({
  token,
  projectName,
  tasks,
  calendar,
  expiresAt,
}: SharedProjectViewProps) {
  return (
    <div className="apple-page flex h-screen min-w-0 flex-col overflow-hidden">
      <header className="apple-page-header shrink-0 px-6 py-4">
        <div className="mx-auto flex max-w-7xl min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-[var(--color-text-strong)]">
              {projectName}
            </h1>
            <p
              data-testid="share-readonly-notice"
              className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
            >
              <Eye size={14} aria-hidden />
              Estás viendo el cronograma. No se puede editar desde este enlace.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Link
              data-testid="share-adopt"
              href={`/login?next=${encodeURIComponent(`/adoptar/${token}`)}`}
              className="apple-button-primary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-4 py-2 text-sm font-semibold"
            >
              <UserPlus size={15} aria-hidden />
              Crear cuenta y quedármelo
            </Link>
            <p
              data-testid="share-expiry"
              className="text-xs text-[var(--color-text-muted)]"
            >
              Este enlace deja de valer el {enDia(expiresAt)}.
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <GanttView
          projectName={projectName}
          tasks={tasks}
          calendar={calendar}
          readOnly
        />
      </div>
    </div>
  );
}
