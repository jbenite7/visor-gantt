/**
 * El tope de tamaño de un `.mpp`, escrito **una sola vez**.
 *
 * Estaba copiado en cinco sitios: las dos rutas de subida, los dos componentes
 * que avisan antes de subir, y un comentario. El día que alguien lo cambie en
 * uno, los demás mienten — la pantalla rechazando algo que el servidor acepta,
 * o peor, prometiendo un tope que el servidor no da.
 */
export const MAX_FILE_SIZE_MB = 50;

export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** El mismo aviso, con las mismas palabras, en todas las puertas. */
export function archivoDemasiadoGrande(): string {
  return `El archivo supera el máximo de ${MAX_FILE_SIZE_MB} MB`;
}
