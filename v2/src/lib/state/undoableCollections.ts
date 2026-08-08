/**
 * Helpers para deshacer cambios sobre listas sin restaurar la lista entera.
 *
 * Restaurar un snapshot completo parece más simple, pero borra en silencio todo
 * lo que el usuario haya añadido entre la acción y el deshacer ("borro un
 * recurso, agrego otro, deshago" → el nuevo desaparecía). Revertir con la
 * operación inversa respeta esos cambios intermedios.
 */

export function removeWhere<T>(items: T[], match: (item: T) => boolean): T[] {
  return items.filter((item) => !match(item));
}

/**
 * Quita por posición, no por parecido. Dos asignaciones del mismo recurso a la
 * misma actividad son indistinguibles por sus campos: filtrarlas por igualdad
 * se lleva las dos, y deshacer un alta borraría también la que ya estaba.
 */
export function removeAt<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return [...items];
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

export function insertAt<T>(items: T[], index: number, item: T): T[] {
  const position = Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, position), item, ...items.slice(position)];
}

export function replaceWhere<T>(
  items: T[],
  match: (item: T) => boolean,
  next: T,
): T[] {
  return items.map((item) => (match(item) ? next : item));
}
