import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { adoptSharedProject } from "@/lib/share/adoptSharedProject";
import { SHARE_TTL_DAYS } from "@/lib/share/shareTtl";

/**
 * Quedarse el cronograma que se abrió sin cuenta.
 *
 * **Exige sesión**, y es el único sitio donde un temporal cambia de manos. Sin
 * sesión se manda al login con el destino puesto —el retorno que ya construyó
 * E18—, para que al volver se adopte sin repetir la subida: pedir el archivo
 * otra vez sería pedir esfuerzo en el peor momento.
 *
 * `userId` sale de la sesión y nunca de la URL: si viniera de la URL,
 * cualquiera podría adoptar en nombre de otro.
 */
export default async function AdoptarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/adoptar/${token}`)}`);
  }

  const resultado = await adoptSharedProject(token, user.id);

  if (resultado.ok) {
    redirect(`/project/${resultado.id}`);
  }

  // Una pantalla en blanco dejaría al usuario sin saber qué pasó con el
  // cronograma que acababa de ver.
  return (
    <main className="apple-page flex min-h-screen items-center justify-center px-6">
      <section className="apple-section max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-text-strong)]">
          No pudimos quedárnoslo
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {resultado.error}
        </p>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Los enlaces sin cuenta caducan a los {SHARE_TTL_DAYS} días. Puedes volver a subir el
          archivo desde tus proyectos.
        </p>
        <Link
          href="/"
          className="apple-button-primary mt-4 inline-flex rounded-[var(--radius-lg)] px-4 py-2 text-sm font-semibold"
        >
          Ir a mis proyectos
        </Link>
      </section>
    </main>
  );
}
