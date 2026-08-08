/**
 * Durante el arrastre, la sombra ya salta por días —`pixelsToDays` redondea—
 * pero no decía a qué día. Ver la fecha destino es la diferencia entre mover
 * y adivinar (E30).
 */
export function dragDestinationLabel(start: Date, dayDelta: number): string {
  const destino = new Date(start);
  destino.setDate(destino.getDate() + dayDelta);

  const dd = String(destino.getDate()).padStart(2, "0");
  const mm = String(destino.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${destino.getFullYear()}`;
}
