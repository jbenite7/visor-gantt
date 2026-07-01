import NewProjectForm from "./NewProjectForm";
import { redirect } from "next/navigation";
import AuthMenu from "@/components/auth/AuthMenu";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[var(--aia-alabaster)]">
      <header className="px-6 py-5 bg-white border-b border-[var(--gray-200)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--aia-corp-dark)] font-[var(--font-heading)]">
              Crear cronograma
            </h1>
            <p className="text-sm text-[var(--gray-500)] mt-1">
              Inicia desde Programación Matricial o desde una hoja vacía.
            </p>
          </div>
          <AuthMenu />
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <NewProjectForm />
      </main>
    </div>
  );
}
