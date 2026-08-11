/**
 * Las etiquetas del eje de tiempo de la Línea de Balance.
 *
 * **Se leen en UTC a propósito.** Las fechas del cronograma se construyen a
 * medianoche UTC, y el eje las leía con `date.getDate()` y
 * `toLocaleString("es-ES")`, que usan la zona de la máquina: en Bogotá (UTC-5)
 * la medianoche UTC del día 5 es el día 4 por la tarde, así que **cada marca
 * del eje iba corrida un día**. Justo en la pantalla que sirve para ver a qué
 * ritmo avanza cada piso, donde el día es el dato.
 *
 * De paso, formateaba en `es-ES` mientras el resto de la app usa `es-CO`.
 */
export type LobTickScale = "day" | "week" | "month" | "quarter";

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/**
 * Semana ISO leída en UTC.
 *
 * Se calcula sobre los mismos números que el resto de la etiqueta: mezclar UTC
 * y hora local aquí devolvería la semana de otro día.
 */
export function isoWeekUTC(date: Date): number {
  const referencia = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const diaDeSemana = referencia.getUTCDay() || 7;
  referencia.setUTCDate(referencia.getUTCDate() + 4 - diaDeSemana);
  const inicioDeAnio = new Date(Date.UTC(referencia.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((referencia.getTime() - inicioDeAnio.getTime()) / 86_400_000 + 1) / 7,
  );
}

export function formatLobTickLabel(date: Date, scale: LobTickScale): string {
  const dia = date.getUTCDate();
  const mes = MESES_CORTOS[date.getUTCMonth()];
  const anio = date.getUTCFullYear();

  if (scale === "day") return `${dia} ${mes}`;
  if (scale === "month") return `${mes} ${anio}`;
  if (scale === "quarter") {
    return `T${Math.floor(date.getUTCMonth() / 3) + 1} ${anio}`;
  }
  return `S${isoWeekUTC(date)} - ${dia} ${mes}`;
}
