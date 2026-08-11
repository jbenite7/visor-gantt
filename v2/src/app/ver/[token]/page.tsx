import { notFound } from "next/navigation";
import { loadSharedProject } from "@/lib/share/loadSharedProject";
import SharedProjectView from "./SharedProjectView";

/**
 * Ver un cronograma con el enlace, sin cuenta.
 *
 * **No pide sesión a propósito**: es el punto de E51. Quien decide quién ve qué
 * es `loadSharedProject`, que autoriza por token y solo para leer.
 *
 * Un enlace caducado y uno inexistente responden **igual**. Distinguirlos le
 * diría a un desconocido que ese enlace existió, que es justo lo que un enlace
 * privado no debe filtrar.
 */
export default async function VerCronogramaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const compartido = await loadSharedProject(token);

  if (!compartido) {
    notFound();
  }

  return (
    <SharedProjectView
      token={token}
      projectName={compartido.name}
      data={compartido.data}
      expiresAt={compartido.expiresAt.toISOString()}
    />
  );
}
