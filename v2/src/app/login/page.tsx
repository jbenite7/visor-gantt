import Link from "next/link";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { safeNextPath } from "@/lib/auth/nextPath";
import { loginErrorMessage } from "@/lib/auth/loginErrors";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    next?: string;
    correo?: string;
    motivo?: string;
  }>;
}) {
  const params = await searchParams;
  const errorMessage = loginErrorMessage(params?.error);
  const correo = typeof params?.correo === "string" ? params.correo : "";
  const sesionCaducada = params?.motivo === "sesion-expirada";
  const next = safeNextPath(params?.next);
  const microsoftConfigured = Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
  );

  const inputClass =
    "mt-1 w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] shadow-sm outline-none transition focus:border-[var(--aia-corp-main)] focus:ring-2 focus:ring-[var(--aia-corp-main)]/15";

  return (
    <main className="apple-page flex items-center justify-center px-4 py-10">
      <section className="apple-surface w-full max-w-md rounded-lg p-6 sm:p-7">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] text-[var(--aia-corp-main)] shadow-sm">
            <ShieldCheck size={21} aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">
              Iniciar sesión
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Accede a tus cronogramas y proyectos guardados.
            </p>
          </div>
        </div>

        {sesionCaducada && (
          <p
            data-testid="login-motivo"
            role="status"
            className="mb-4 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text-muted)]"
          >
            Tu sesión caducó por seguridad. Entra de nuevo y te devolvemos al
            cronograma que ibas a abrir.
          </p>
        )}

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
              <Mail size={15} aria-hidden />
              Correo
            </span>
            <input
              name="email"
              type="email"
              required
              defaultValue={correo}
              autoComplete="email"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
              <LockKeyhole size={15} aria-hidden />
              Contraseña
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              className={inputClass}
            />
          </label>

          {errorMessage && (
            <p
              data-testid="login-error"
              role="alert"
              className="text-sm text-[var(--aia-alert-main)]"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="apple-button-primary w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition"
          >
            Entrar
          </button>
        </form>

        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          ¿Olvidaste tu contraseña? Pídesela a quien administra el proyecto: es
          quien crea y restablece las cuentas de la obra.
        </p>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          <span className="h-px flex-1 bg-[var(--color-hairline)]" />
          o
          <span className="h-px flex-1 bg-[var(--color-hairline)]" />
        </div>

        {microsoftConfigured ? (
          <Link
            href="/api/auth/microsoft/start"
            className="apple-button-secondary block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition"
          >
            Entrar con Microsoft 365
          </Link>
        ) : (
          <div className="apple-panel block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-text-muted)]">
            Entrar con Microsoft 365 no está disponible todavía
          </div>
        )}

        <p className="mt-5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          ¿Primera vez en este servidor? La primera persona que entra queda como
          administradora del equipo.
        </p>
      </section>
    </main>
  );
}
