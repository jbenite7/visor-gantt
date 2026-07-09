import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Database, FolderKanban, Plus, UploadCloud } from "lucide-react";
import pool from "@/lib/db";
import { listProjects } from "@/app/actions/project";
import AuthMenu from "@/components/auth/AuthMenu";
import ProjectList from "@/components/ProjectList";
import HomeMppUploadAction from "@/components/upload/HomeMppUploadAction";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  let dbStatus = "Desconectado";
  let projects: { id: string; name: string; updatedAt: Date }[] = [];

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1 FROM projects LIMIT 1");
      dbStatus = "Conectado";
    } finally {
      client.release();
    }

    projects = await listProjects();
  } catch (err) {
    dbStatus = "Error";
    console.error("Home page DB error:", (err as Error).message);
  }

  return (
    <div className="apple-page">
      <header className="apple-page-header px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-strong)] font-[var(--font-heading)]">
              Visor Gantt v2
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Cronogramas, matriz, recursos y control de obra en un solo panel.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="apple-panel inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
              <Database size={13} aria-hidden />
              <span
                className={`ml-1.5 inline-block h-2 w-2 rounded-[var(--radius-pill)] ${
                  dbStatus === "Conectado"
                    ? "bg-[var(--aia-corp-main)]"
                    : "bg-[var(--aia-alert-main)]"
                }`}
              />
              <span className="ml-1">{dbStatus}</span>
            </span>
            <AuthMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-strong)] font-[var(--font-heading)]">
              Mis Proyectos
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Abre un proyecto existente, importa un .mpp o crea un cronograma nuevo.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <HomeMppUploadAction className="flex flex-col items-end gap-2" />
            <form action="/project/new" method="get">
              <button
                type="submit"
                className="apple-button-primary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                <Plus size={16} aria-hidden />
                Nuevo Proyecto
              </button>
            </form>
          </div>
        </div>

        {projects.length > 0 ? (
          <ProjectList projects={projects} />
        ) : (
          <div className="apple-dropzone rounded-[var(--radius-lg)] px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] text-[var(--aia-corp-main)] shadow-sm">
              <FolderKanban size={28} aria-hidden />
            </div>
            <p className="font-semibold text-[var(--color-text-strong)]">
              No hay proyectos guardados
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Sube un archivo .mpp o crea uno nuevo para comenzar
            </p>
            <HomeMppUploadAction />
          </div>
        )}

        <div className="mt-8 flex gap-4">
          <Link
            href="/gantt-demo"
            className="apple-button-secondary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 text-sm font-semibold transition-colors"
          >
            <UploadCloud size={15} aria-hidden />
            Ver Demo Gantt
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </main>
    </div>
  );
}
