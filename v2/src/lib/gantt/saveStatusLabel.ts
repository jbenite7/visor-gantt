export type SaveStatus = "idle" | "saving" | "saved" | "error";

function timeOfDay(at: Date): string {
  const hours = String(at.getHours()).padStart(2, "0");
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Texto del indicador de guardado.
 *
 * Decir la hora del último guardado —y no solo «Guardado»— es lo que permite
 * distinguir «mi último cambio está a salvo» de «esto se guardó hace una hora».
 */
export function saveStatusLabel(
  status: SaveStatus,
  lastSavedAt: Date | null,
  opciones: { readOnly?: boolean } = {},
): string {
  // En modo mirador (E51) no se guarda nada, así que ninguno de los mensajes de
  // abajo es cierto. Decía «Guardado automático activo» en la única pantalla
  // donde el guardado no existe: un control que promete y no cumple.
  if (opciones.readOnly) return "Solo lectura · no se guardan cambios";

  if (status === "saving") return "Guardando…";
  if (status === "error") return "No se pudo guardar";

  if (lastSavedAt) return `Guardado a las ${timeOfDay(lastSavedAt)}`;
  return "Guardado automático activo";
}
