/**
 * Las etiquetas del eje de tiempo de la Línea de Balance.
 *
 * **Corrección del 2026-08-11.** Esto se extrajo creyendo que arreglaba un
 * desfase de un día, y **ese desfase no existía**. La «prueba» usó una fecha a
 * medianoche UTC, que es una fecha que este código nunca produce: las marcas
 * del eje se construyen con `setHours(0, 0, 0, 0)`, o sea medianoche **local**,
 * y sobre esas leer en local o en UTC da exactamente lo mismo. Medido:
 *
 *     marca real del gráfico : 2026-08-05T05:00:00.000Z
 *       lectura local        : 5 ago
 *       lectura UTC          : 5 ago
 *
 * Lo que sí queda, y por eso el módulo se conserva:
 *
 * 1. La función estaba **encerrada dentro del componente** y no se podía probar.
 * 2. Formateaba en `es-ES` mientras el resto de la app usa `es-CO`.
 * 3. Leer UTC es lo correcto para el otro caso que sí llega aquí: una fecha que
 *    venga de un ISO de solo día (`new Date("2026-08-05")` es medianoche UTC).
 *    Con marcas locales da igual; con esas, no.
 *
 * Se deja escrito el error para que nadie repita la deducción sin medirla.
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
