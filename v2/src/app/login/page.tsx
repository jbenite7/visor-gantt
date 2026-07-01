import Link from "next/link";
import { loginAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="min-h-screen bg-[var(--aia-alabaster)] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-[var(--gray-200)] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--aia-corp-dark)]">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-[var(--gray-500)]">
            Accede a tus cronogramas y proyectos guardados.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] px-3 py-2 text-sm text-[var(--aia-alert-main)]">
            {error}
          </p>
        )}

        <form action={loginAction} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[var(--aia-corp-dark)]">
              Correo
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-[var(--gray-300)] px-3 py-2 text-sm outline-none focus:border-[var(--aia-corp-main)]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[var(--aia-corp-dark)]">
              Contraseña
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              className="w-full rounded-md border border-[var(--gray-300)] px-3 py-2 text-sm outline-none focus:border-[var(--aia-corp-main)]"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-[var(--aia-corp-main)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aia-corp-dark)]"
          >
            Entrar
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase text-[var(--gray-500)]">
          <span className="h-px flex-1 bg-[var(--gray-200)]" />
          o
          <span className="h-px flex-1 bg-[var(--gray-200)]" />
        </div>

        <Link
          href="/api/auth/microsoft/start"
          className="block w-full rounded-md border border-[var(--gray-300)] px-4 py-2 text-center text-sm font-semibold text-[var(--aia-corp-dark)] hover:bg-[var(--aia-corp-xlight)]"
        >
          Entrar con Microsoft 365
        </Link>

        <p className="mt-5 text-xs text-[var(--gray-500)]">
          En una base limpia, el primer correo que entra se crea como administrador.
        </p>
      </section>
    </main>
  );
}
