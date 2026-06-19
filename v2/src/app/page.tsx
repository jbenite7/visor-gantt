import Link from "next/link";
import pool from "@/lib/db";
import { listProjects } from "@/app/actions/project";
import ProjectList from "@/components/ProjectList";

export const dynamic = "force-dynamic";

export default async function Home() {
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
    <div className="min-h-screen bg-[var(--aia-alabaster)]">
      {/* Header */}
      <header className="px-6 py-5 bg-white border-b border-[var(--gray-200)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--aia-corp-dark)] font-[var(--font-heading)]">
              Visor Gantt v2
            </h1>
            <p className="text-sm text-[var(--gray-500)] mt-1">
              Next.js + PostgreSQL
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--gray-600)]">
              DB:
              <span
                className={`ml-1.5 inline-block w-2 h-2 rounded-full ${
                  dbStatus === "Conectado"
                    ? "bg-emerald-500"
                    : "bg-red-500"
                }`}
              />
              <span className="ml-1">{dbStatus}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto p-6">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--aia-corp-dark)] font-[var(--font-heading)]">
            Mis Proyectos
          </h2>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--aia-corp-main)] text-white text-sm font-medium hover:bg-[var(--aia-corp-dark)] transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nuevo Proyecto
          </Link>
        </div>

        {/* Project list */}
        {projects.length > 0 ? (
          <ProjectList projects={projects} />
        ) : (
          <div className="text-center py-16 rounded-xl border-2 border-dashed border-[var(--gray-300)] bg-white">
            <svg
              className="mx-auto w-12 h-12 text-[var(--gray-400)] mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <p className="text-[var(--gray-600)] font-medium">
              No hay proyectos guardados
            </p>
            <p className="text-sm text-[var(--gray-500)] mt-1">
              Sube un archivo .mpp o crea uno nuevo para comenzar
            </p>
            <Link
              href="/upload"
              className="inline-block mt-4 px-5 py-2 rounded-lg bg-[var(--aia-corp-main)] text-white text-sm font-medium hover:bg-[var(--aia-corp-dark)] transition-colors"
            >
              Subir Archivo .mpp
            </Link>
          </div>
        )}

        {/* Quick links */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/gantt-demo"
            className="text-sm text-[var(--aia-corp-main)] hover:text-[var(--aia-corp-dark)] font-medium transition-colors"
          >
            Ver Demo Gantt →
          </Link>
        </div>
      </main>
    </div>
  );
}
