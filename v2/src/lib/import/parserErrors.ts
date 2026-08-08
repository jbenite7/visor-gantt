/**
 * El servicio que lee los .mpp responde en inglés y con detalle técnico. Eso
 * no le sirve a quien está en obra: necesita saber qué hacer a continuación.
 * El detalle crudo se queda en el registro del servidor.
 */
export function humanParserError(raw: string, status: number): string {
  const texto = raw.toLowerCase();

  if (texto.includes("too large") || status === 413) {
    return "El archivo pesa más de 50 MB. Guárdalo de nuevo desde MS Project sin las líneas base ni los archivos incrustados.";
  }
  if (texto.includes("too small") || texto.includes("invalid file type")) {
    return "Ese archivo no parece un cronograma de MS Project. Comprueba que sea el .mpp y no un acceso directo.";
  }
  if (texto.includes("could not parse") || texto.includes("conversion failed")) {
    return "No pudimos leer el cronograma. Ábrelo en MS Project y vuelve a guardarlo como .mpp.";
  }
  return "El servicio que lee los cronogramas no respondió. Inténtalo de nuevo en un minuto.";
}
