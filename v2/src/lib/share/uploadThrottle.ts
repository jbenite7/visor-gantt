/**
 * Un tope de subidas por conexión y hora.
 *
 * La ruta con cuenta está protegida por exigir sesión; la de E51 no puede.
 * El analizador es un microservicio aparte que tarda hasta tres minutos con
 * archivos grandes, así que un goteo automático lo deja sin atender a los
 * usuarios de verdad.
 *
 * En memoria a propósito: es un freno contra el goteo, no contra un ataque
 * coordinado. Una tabla en base de datos sería más infraestructura de la que
 * el problema pide, y el proceso se reinicia con cada despliegue.
 */
export const ANONYMOUS_UPLOADS_PER_HOUR = 5;

const WINDOW_MS = 60 * 60 * 1000;

interface Ventana {
  startedAt: number;
  count: number;
}

const ventanas = new Map<string, Ventana>();

export interface ThrottleVerdict {
  allowed: boolean;
  /** Segundos hasta que vuelva a haber cupo. 0 cuando sí hay. */
  retryAfterSeconds: number;
}

export function checkUploadAllowance(ip: string, now: Date): ThrottleVerdict {
  const actual = ventanas.get(ip);
  const nowMs = now.getTime();

  if (!actual || nowMs - actual.startedAt >= WINDOW_MS) {
    ventanas.set(ip, { startedAt: nowMs, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (actual.count < ANONYMOUS_UPLOADS_PER_HOUR) {
    actual.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const restante = actual.startedAt + WINDOW_MS - nowMs;
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(restante / 1000),
  };
}

/** Solo para las pruebas: el contador vive en memoria del proceso. */
export function resetUploadThrottle(): void {
  ventanas.clear();
}
