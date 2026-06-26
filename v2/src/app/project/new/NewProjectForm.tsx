"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
      <div className="shrink-0 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-[var(--gray-300)] overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setMode("matrix")}
            className={`px-3 py-2 text-sm font-semibold ${
              mode === "matrix"
                ? "bg-[var(--aia-corp-main)] text-white"
                : "bg-white text-[var(--aia-corp-dark)]"
            }`}
          >
            Crear desde Programación Matricial
          </button>
          <button
            type="button"
            onClick={() => setMode("blank")}
            className={`px-3 py-2 text-sm font-semibold ${
              mode === "blank"
                ? "bg-[var(--aia-corp-main)] text-white"
                : "bg-white text-[var(--aia-corp-dark)]"
            }`}
          >
            Crear cronograma vacío
          </button>
        </div>
        {error && (
          <p className="text-sm text-[var(--aia-alert-main)]">{error}</p>
        )}
      </div>

      {mode === "matrix" ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--gray-200)] bg-white">
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
          className="max-w-3xl bg-white border border-[var(--gray-200)] rounded-lg p-6 space-y-5"
        >
          <div>
            <label
              htmlFor="blank-project-name"
              className="block text-sm font-semibold text-[var(--aia-corp-dark)] mb-1"
            >
              Nombre del proyecto
            </label>
            <input
              id="blank-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-[var(--gray-300)] px-3 py-2 text-sm outline-none focus:border-[var(--aia-corp-main)]"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="blank-project-start-date"
              className="block text-sm font-semibold text-[var(--aia-corp-dark)] mb-1"
            >
              Fecha de inicio
            </label>
            <input
              id="blank-project-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-md border border-[var(--gray-300)] px-3 py-2 text-sm outline-none focus:border-[var(--aia-corp-main)]"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-md bg-[var(--aia-corp-main)] text-white text-sm font-semibold disabled:opacity-60"
            >
              {isPending ? "Creando..." : "Crear cronograma vacío"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-md text-[var(--aia-corp-dark)] text-sm font-semibold hover:bg-[var(--aia-corp-xlight)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
