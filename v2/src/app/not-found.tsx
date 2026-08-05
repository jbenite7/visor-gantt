import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="apple-page flex items-center justify-center px-4 py-10">
      <section className="apple-surface w-full max-w-md rounded-lg p-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] text-[var(--aia-corp-main)] shadow-sm">
          <Compass size={28} aria-hidden />
        </div>

        <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">
          No encontramos esta página
        </h1>

        <p
          data-testid="not-found-hint"
          className="mt-2 text-sm text-[var(--color-text-muted)]"
        >
          Puede que el enlace esté mal escrito o que el cronograma que buscas se
          haya eliminado.
        </p>

        <Link
          href="/"
          className="apple-button-primary mt-6 inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} aria-hidden />
          Volver a mis cronogramas
        </Link>
      </section>
    </main>
  );
}
