/**
 * Solo se aceptan rutas internas: un `next` con host propio convertiría el login
 * en un redirector abierto hacia sitios de terceros.
 *
 * Vive fuera de `actions/auth.ts` porque un módulo "use server" solo puede
 * exportar funciones async.
 */
export function safeNextPath(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}
