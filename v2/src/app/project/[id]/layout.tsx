import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Abrir un cronograma exige sesión. Sin este guard, un enlace directo a un
 * proyecto acababa en la pantalla de entrada sin decir por qué ni recordar a
 * dónde iba (E18).
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(
      `/login?motivo=sesion-expirada&next=${encodeURIComponent(`/project/${id}`)}`,
    );
  }

  return <>{children}</>;
}
