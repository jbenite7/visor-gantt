function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Distancia de edición acotada: si supera el tope, corta y devuelve el tope. */
function distancia(a: string, b: string, tope: number): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    let minimoFila = fila[0];

    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = temp;
      minimoFila = Math.min(minimoFila, fila[j]);
    }

    if (minimoFila > tope) return tope + 1;
  }

  return fila[b.length];
}

/**
 * La paleta filtraba con `includes`: una errata y no encontraba nada, que es
 * exactamente cuando más falta hace. Tolerar no es adivinar — el margen es de
 * una o dos letras según lo que se haya escrito (M36).
 */
export function fuzzyMatches(haystack: string, needle: string): boolean {
  const consulta = normalizar(needle).trim();
  if (!consulta) return true;

  const texto = normalizar(haystack);
  if (texto.includes(consulta)) return true;

  const tope = consulta.length <= 4 ? 1 : 2;

  // Se prueban ventanas de varios largos: una errata puede sobrar o faltar
  // letras, y una ventana de largo fijo penalizaría la diferencia dos veces.
  for (let i = 0; i < texto.length; i++) {
    for (
      let largo = Math.max(1, consulta.length - tope);
      largo <= consulta.length + tope;
      largo++
    ) {
      if (i + largo > texto.length + tope) break;
      if (distancia(consulta, texto.slice(i, i + largo), tope) <= tope) {
        return true;
      }
    }
  }

  return false;
}
