"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutGrid, PlusCircle } from "lucide-react";
import { createBlankProject, createMatrixProject } from "@/app/actions/project";
import MatrixEditorView from "@/components/views/MatrixEditorView";
import { toDateInputValue } from "@/lib/date/projectDate";
import { createEmptyMatrixPlan } from "@/lib/matrix/templates";
import type { MatrixPlan } from "@/types/matrix";

type CreationMode = "matrix" | "blank";

function createSeedMatrixPlan(
  name: string,
  startDate: string,
  draftKey: string,
): MatrixPlan {
  return createEmptyMatrixPlan({
    id: `matrix-new-project-${draftKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    name: name.trim() || "Nuevo cronograma",
    startDate,
  });
}

interface NewProjectFormProps {
  draftKey?: string;
}

export default function NewProjectForm({ draftKey = "default" }: NewProjectFormProps) {
  return <NewProjectFormState key={draftKey} draftKey={draftKey} />;
}

function NewProjectFormState({ draftKey }: Required<NewProjectFormProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("Nuevo cronograma");
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [mode, setMode] = useState<CreationMode>("matrix");
  const [matrixPlan] = useState<MatrixPlan>(() =>
    createSeedMatrixPlan("Nuevo cronograma", toDateInputValue(new Date()), draftKey),
  );
  const [error, setError] = useState<string | null>(null);
  const inputClass =
    "mt-1 w-full rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] shadow-sm outline-none transition focus:border-[var(--aia-corp-main)] focus:ring-2 focus:ring-[var(--aia-corp-main)]/15";

  const handleCreateMatrixProject = (draft: MatrixPlan) => {
    setError(null);

    startTransition(async () => {
      const projectName = draft.name.trim() || "Nuevo cronograma";
      const result = await createMatrixProject({
        name: projectName,
        matrixPlan: draft,
      });

      if (!result.success || !result.id) {
        setError(result.error ?? "No se pudo crear el proyecto matricial");
        return;
      }

      router.push(`/project/${result.id}`);
    });
  };

  const handleCreateBlankProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createBlankProject({
        name: name.trim() || "Nuevo cronograma",
        startDate,
      });

      if (!result.success || !result.id) {
        setError(result.error ?? "No se pudo crear el cronograma");
        return;
      }

      router.push(`/project/${result.id}`);
    });
  };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[640px] flex flex-col gap-4">
      <div className="apple-section shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="apple-segmented">
          <button
            type="button"
            onClick={() => setMode("matrix")}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition ${
              mode === "matrix"
                ? "apple-button-primary"
                : "text-[var(--color-text-strong)] hover:bg-[var(--color-bg-elevated)]"
            }`}
          >
            <LayoutGrid size={15} aria-hidden />
            Crear desde Programación Matricial
          </button>
          <button
            type="button"
            onClick={() => setMode("blank")}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition ${
              mode === "blank"
                ? "apple-button-primary"
                : "text-[var(--color-text-strong)] hover:bg-[var(--color-bg-elevated)]"
            }`}
          >
            <PlusCircle size={15} aria-hidden />
            Crear cronograma vacío
          </button>
        </div>
        {error && (
          <p className="rounded-[var(--radius-lg)] border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] px-3 py-2 text-sm text-[var(--aia-alert-main)]">
            {error}
          </p>
        )}
      </div>

      {mode === "matrix" ? (
        <div className="apple-card min-h-0 flex-1 overflow-hidden">
          <MatrixEditorView
            key={draftKey}
            matrixPlan={matrixPlan}
            tasks={[]}
            onApplyMatrixPlan={handleCreateMatrixProject}
            onSyncFromGantt={() => undefined}
            applyLabel={isPending ? "Generando..." : "Guardar y generar cronograma"}
          />
        </div>
      ) : (
        <form
          onSubmit={handleCreateBlankProject}
          className="apple-section max-w-3xl p-6 space-y-5"
        >
          <div className="border-b border-[var(--color-hairline)] pb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">
              Cronograma vacío
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Crea una base limpia para construir tareas, dependencias y recursos manualmente.
            </p>
          </div>

          <div>
            <label
              htmlFor="blank-project-name"
              className="block text-sm font-semibold text-[var(--color-text-strong)]"
            >
              Nombre del proyecto
            </label>
            <input
              id="blank-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="blank-project-start-date"
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]"
            >
              <CalendarDays size={15} aria-hidden />
              Fecha de inicio
            </label>
            <input
              id="blank-project-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-hairline)] pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="apple-button-primary rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
            >
              {isPending ? "Creando..." : "Crear cronograma vacío"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="apple-button-secondary rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
