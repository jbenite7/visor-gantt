"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/app/actions/project";

interface Project {
  id: string;
  name: string;
  updatedAt: Date;
}

export default function ProjectList({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      const confirmed = window.confirm(
        `¿Eliminar el proyecto "${name}"? Esta acción no se puede deshacer.`,
      );
      if (!confirmed) return;

      setDeleting(id);
      try {
        const result = await deleteProject(id);
        if (result.success) {
          router.refresh();
        } else {
          alert(`Error al eliminar: ${result.error}`);
        }
      } finally {
        setDeleting(null);
      }
    },
    [router],
  );

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="grid gap-3">
      {projects.map((project) => (
        <div
          key={project.id}
          className="flex items-center justify-between px-5 py-4 rounded-xl border border-[var(--gray-200)] bg-white hover:shadow-md transition-shadow"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--aia-corp-dark)] truncate font-[var(--font-heading)]">
              {project.name}
            </h3>
            <p className="text-xs text-[var(--gray-500)] mt-0.5">
              Guardado: {formatDate(project.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <Link
              href={`/project/${project.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--aia-corp-xlight)] text-[var(--aia-corp-dark)] hover:bg-[var(--aia-corp-light)] transition-colors"
            >
              Abrir
            </Link>
            <button
              onClick={() => handleDelete(project.id, project.name)}
              disabled={deleting === project.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--aia-alert-main)] hover:bg-[var(--aia-alert-xlight)] transition-colors disabled:opacity-50"
            >
              {deleting === project.id ? "..." : "Eliminar"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
