/**
 * Cuánto dura un enlace sin cuenta, **sin arrastrar nada del servidor**.
 *
 * Vivía en `shareToken.ts`, que importa `node:crypto` para generar el token.
 * En cuanto una pantalla de cliente quiso enseñar el plazo, ese import se
 * coló en el paquete del navegador y **el build de producción dejó de
 * compilar**. La constante no necesita criptografía: se separa para que las
 * dos partes puedan usarla.
 */
export const SHARE_TTL_DAYS = 7;
