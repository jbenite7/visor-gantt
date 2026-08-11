/**
 * Si toca lanzar un guardado ahora mismo.
 *
 * `doSave` no tenía guarda de petición en vuelo: el temporizador de 750 ms
 * podía disparar mientras el guardado anterior seguía viajando, y dos escrituras
 * del mismo usuario llegaban al servidor sin orden garantizado. Desde que hay
 * control de versión eso es peor: el segundo choca contra el primero y el
 * usuario ve un conflicto consigo mismo.
 *
 * Lo pendiente no se pierde por esperar: sigue marcado como sucio, así que el
 * siguiente ciclo lo recoge.
 */
export function shouldStartSave({
  hasPendingChanges,
  saveInFlight,
}: {
  hasPendingChanges: boolean;
  saveInFlight: boolean;
}): boolean {
  return hasPendingChanges && !saveInFlight;
}
