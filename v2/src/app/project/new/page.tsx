import NewProjectForm from "./NewProjectForm";

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-[var(--aia-alabaster)]">
      <header className="px-6 py-5 bg-white border-b border-[var(--gray-200)]">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-[var(--aia-corp-dark)] font-[var(--font-heading)]">
            Crear cronograma
          </h1>
          <p className="text-sm text-[var(--gray-500)] mt-1">
            Inicia desde Programación Matricial o desde una hoja vacía.
          </p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <NewProjectForm />
      </main>
    </div>
  );
}
