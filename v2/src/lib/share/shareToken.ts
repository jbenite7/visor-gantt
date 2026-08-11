import { randomBytes } from "node:crypto";
import { SHARE_TTL_DAYS } from "./shareTtl";

/**
 * El enlace de un cronograma que se ve sin cuenta.
 *
 * Los proyectos normales viven en rutas con identificador propio y exigen
 * sesión. Un temporal es público para quien tenga el enlace, así que el enlace
 * **es** la credencial: tiene que ser imposible de acertar probando, y tiene
 * que dejar de valer solo.
 */

/**
 * 32 bytes: 256 bits de azar, 43 caracteres en base64url.
 *
 * Sale de `randomBytes` y de nada más. Ni el reloj, ni el nombre del archivo,
 * ni un contador: cualquiera de esos es único —que es lo que se suele
 * comprobar— y aun así **adivinable**, porque quien sube un archivo sabe a qué
 * hora subió el de al lado.
 */
export const SHARE_TOKEN_BYTES = 32;

// La constante vive aparte para que las pantallas de cliente puedan enseñar el
// plazo sin arrastrar `node:crypto` al navegador.
export { SHARE_TTL_DAYS } from "./shareTtl";

export function createShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

export function shareExpiryFrom(now: Date): Date {
  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + SHARE_TTL_DAYS);
  return expiry;
}

export function isShareExpired(
  expiresAt: Date | string | null | undefined,
  now: Date,
): boolean {
  // Sin fecha no es temporal: es un proyecto normal y no caduca nunca.
  if (expiresAt == null) return false;
  const limit = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return limit.getTime() <= now.getTime();
}
