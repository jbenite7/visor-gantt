"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions/project";
import { formatProjectDate } from "@/lib/date/projectDate";

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
    return formatProjectDate(new Date(date), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  };

  return (
    <div className="grid gap-3">
      {projects.map((project) => (
        <div
          key={project.id}
          className="apple-card flex items-center justify-between gap-4 px-5 py-4 transition-shadow hover:shadow-md"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] text-[var(--aia-corp-main)]">
              <FolderOpen size={19} aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[var(--color-text-strong)] font-[var(--font-heading)]">
                {project.name}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Guardado: {formatDate(project.updatedAt)}
              </p>
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            <Link
              href={`/project/${project.id}`}
              className="apple-button-secondary inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              Abrir
            </Link>
            <button
              onClick={() => handleDelete(project.id, project.name)}
              disabled={deleting === project.id}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-transparent px-3 py-1.5 text-sm font-semibold text-[var(--aia-alert-main)] transition-colors hover:border-[var(--aia-alert-main)] hover:bg-[var(--aia-alert-xlight)] disabled:opacity-50"
            >
              <Trash2 size={14} aria-hidden />
              {deleting === project.id ? "..." : "Eliminar"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
