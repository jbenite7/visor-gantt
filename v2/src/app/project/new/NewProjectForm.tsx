"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBlankProject } from "@/app/actions/project";
import { createProjectDate, toDateInputValue } from "@/lib/date/projectDate";

export default function NewProjectForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("Nuevo cronograma");
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createBlankProject({
        name: name.trim() || "Nuevo cronograma",
        startDate,
      });

      if (!result.success || !result.id) {
        setError(result.error ?? "No se pudo crear el proyecto");
        return;
      }

      router.push(`/project/${result.id}`);
    });
  };

  const previewDate = createProjectDate(startDate);

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl bg-white border border-[var(--gray-200)] rounded-lg p-6 space-y-5"
    >
      <div>
        <label className="block text-sm font-semibold text-[var(--aia-corp-dark)] mb-1">
          Nombre del proyecto
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-[var(--gray-300)] px-3 py-2 text-sm outline-none focus:border-[var(--aia-corp-main)]"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--aia-corp-dark)] mb-1">
          Fecha de inicio
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="w-full rounded-md border border-[var(--gray-300)] px-3 py-2 text-sm outline-none focus:border-[var(--aia-corp-main)]"
        />
        <p className="mt-2 text-xs text-[var(--gray-500)]">
          Se creará una tarea inicial el {toDateInputValue(previewDate)}.
        </p>
      </div>

      {error && (
        <p className="text-sm text-[var(--aia-alert-main)]">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-[var(--aia-corp-main)] text-white text-sm font-semibold disabled:opacity-60"
        >
          {isPending ? "Creando..." : "Crear cronograma"}
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
  );
}
