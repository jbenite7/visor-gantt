/**
 * Dónde empieza el día, la semana, el mes y el trimestre — **en UTC**.
 *
 * El eje de la Línea de Balance colocaba cada marca con `setHours(0, 0, 0, 0)`,
 * que es medianoche **local**. Con las fechas del `.mpp` real de obra eso movía
 * la marca al día anterior: hay 1.185 tareas guardadas a medianoche UTC exacta,
 * y en Bogotá esa hora es el día de antes a las 19:00.
 *
 *     tarea del cronograma : 2026-01-05T00:00:00.000Z  (5 de enero)
 *     marca con setHours   : 2026-01-04T05:00:00.000Z  → «4 ene»
 *
 * Las tres formas de fecha que existen de verdad en la base —05:00Z de los
 * proyectos creados en la app, 14:00Z de las tareas del `.mpp`, y 00:00Z de esas
 * 1.185— caen en el día correcto calculando en UTC. En local, la tercera no.
 */
export function inicioDeDiaUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function inicioDeSemanaUTC(date: Date): Date {
  const dia = inicioDeDiaUTC(date);
  // La semana empieza en lunes: `getUTCDay()` da 0 para domingo.
  const diaDeSemana = dia.getUTCDay() || 7;
  dia.setUTCDate(dia.getUTCDate() - diaDeSemana + 1);
  return dia;
}

export function inicioDeMesUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function inicioDeTrimestreUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1),
  );
}
