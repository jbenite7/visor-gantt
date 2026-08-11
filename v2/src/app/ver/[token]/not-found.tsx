import Link from "next/link";
import { Clock, Upload } from "lucide-react";
import { SHARE_TTL_DAYS } from "@/lib/share/shareTtl";

/**
 * Lo que ve quien abre un enlace que ya no vale.
 *
 * El 404 general está escrito para alguien con cuenta: ofrece «Volver a mis
 * cronogramas», que pide iniciar sesión. Quien llega por un enlace compartido
 * no tiene cuenta ni la pidió, así que ese camino lo deja en una pantalla de
 * login sin explicación.
 *
 * Aquí la causa probable tampoco es la misma: no es un enlace mal escrito, es
 * que caducó. Decirlo evita que quien lo recibió piense que le borraron el
 * cronograma, y le deja claro a quién pedirle uno nuevo.
 *
 * **No distingue caducado de inexistente**, y eso no cambia: separarlos le
 * confirmaría a un desconocido que ese enlace existió.
 */
export default function EnlaceNoDisponible() {
  return (
    <main className="apple-page flex items-center justify-center px-4 py-10">
      <section className="apple-surface w-full max-w-md rounded-lg p-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] text-[var(--aia-corp-main)] shadow-sm">
          <Clock size={28} aria-hidden />
        </div>

        <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">
          Este enlace ya no está disponible
        </h1>

        <p
          data-testid="share-gone"
          className="mt-2 text-sm text-[var(--color-text-muted)]"
        >
          Los enlaces para ver un cronograma caducan a los {SHARE_TTL_DAYS}{" "}
          días. Pídele uno nuevo a quien te lo compartió; el cronograma sigue
          ahí.
        </p>

        <Link
          data-testid="share-gone-cta"
          href="/"
          className="apple-button-primary mt-6 inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <Upload size={16} aria-hidden />
          Abrir un cronograma mío
        </Link>
      </section>
    </main>
  );
}
