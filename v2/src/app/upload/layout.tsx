import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * La importación necesita sesión para poder guardar el proyecto. Sin este guard,
 * un usuario anónimo subía el archivo, esperaba todo el parseo y recibía
 * "No autenticado" como error de servidor.
 */
export default async function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?motivo=sesion-expirada&next=/upload");
  }

  return <>{children}</>;
}
