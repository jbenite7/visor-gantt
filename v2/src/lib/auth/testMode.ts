/**
 * El modo de prueba: entrar a las vistas con cuenta sin escribir una contraseña.
 *
 * **Por qué existe.** Los dos mejores hallazgos del 2026-08-11 —el enlace
 * público que entregaba media aplicación, y su 404 hablándole a alguien con
 * cuenta— salieron de mirar la app funcionando, y los dos eran invisibles
 * leyendo el código, porque cada pieza por separado estaba bien. La ruta
 * pública `/ver/<token>` sirvió de mirador para las vistas de análisis, pero no
 * alcanza lo que solo existe con cuenta: guardar, adoptar y listar. La cookie
 * de sesión es `httpOnly` y no se inyecta desde JS, y una sesión de revisión no
 * escribe contraseñas en formularios.
 *
 * **Por qué esto no es una puerta trasera, y qué lo sostiene.** Una ruta que
 * abre sesión sin credenciales lo sería si pudiera estar encendida sin que
 * nadie lo decidiera. Se apaga sola: hace falta `VISOR_TEST_MODE=1` **exacto**
 * en el entorno del servidor. Ausente, vacía, `true`, `0` o `01` la dejan
 * apagada, y apagada la ruta responde 404 —no 403— para no delatar siquiera que
 * existe. Eso está fijado en `testMode.test.ts`, cuyas pruebas son en su
 * mayoría del lado apagado a propósito.
 *
 * **Límite conocido y deliberado:** el candado es una variable de entorno, no
 * `NODE_ENV`. La suite e2e y la revisión en navegador corren contra un build de
 * producción (`next build && next start`), así que atar el modo a
 * `NODE_ENV !== "production"` lo habría dejado inservible justo donde se usa.
 * Quien despliega no debe definir `VISOR_TEST_MODE` en producción.
 */
export type EntornoDeProceso = Record<string, string | undefined>;

/** El único valor que enciende el modo. Exacto, sin recortar ni normalizar. */
const VALOR_QUE_ENCIENDE = "1";

const CORREO_POR_DEFECTO = "modo-prueba@visor.local";

/**
 * El segundo cerrojo: una instalación servida por `https://` no enciende el
 * modo ni con la variable puesta.
 *
 * Son las mismas variables que ya decide `cookie-security` para marcar la
 * cookie como `secure`, así que la señal no es nueva ni hay que mantener otra:
 * si la app se anuncia por https, es un despliegue real y no una máquina de
 * revisión. Barato en local —nadie configura `https://` para `next dev`— y
 * atrapa el caso que importa: la variable filtrada a producción.
 */
function servidaPorHttps(env: EntornoDeProceso): boolean {
  const urlConfigurada =
    env.PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? env.APP_URL;
  return urlConfigurada ? urlConfigurada.trim().startsWith("https://") : false;
}

export function modoPruebaActivo(env: EntornoDeProceso): boolean {
  if (servidaPorHttps(env)) return false;
  return env.VISOR_TEST_MODE === VALOR_QUE_ENCIENDE;
}

/**
 * La cuenta que se abre. Es siempre una cuenta de prueba propia: el modo nunca
 * suplanta a una persona real, ni siquiera si le pasan su correo por la URL.
 */
export function correoDeModoPrueba(env: EntornoDeProceso): string {
  const configurado = env.VISOR_TEST_MODE_EMAIL?.trim().toLowerCase();
  return configurado ? configurado : CORREO_POR_DEFECTO;
}
