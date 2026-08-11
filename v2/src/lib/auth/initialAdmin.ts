/**
 * Quién se lleva el rol de administrador, y quién no.
 *
 * Hasta el 2026-08-10 `upsertMicrosoftUser` hacía
 * `assignRole(userId, existingUsers === 0 ? "admin" : "member")`: con la tabla
 * de usuarios vacía, **la primera identidad Microsoft que llegara se llevaba
 * admin completo**, coincidiera o no con el correo semilla. El camino de
 * contraseña sí aplicaba ese candado; este se había quedado sin él.
 *
 * Importa más desde que un proyecto tiene dueño: el admin ve y edita
 * **cualquier** proyecto, así que ser admin por accidente pasa de molesto a
 * grave.
 *
 * **Límite conocido, y es deliberado:** sin `INITIAL_ADMIN_EMAIL` configurada,
 * nadie recibe admin por esta vía. Una instalación sin administrador se arregla
 * poniendo la variable; una donde el primer desconocido se lleva el control, no
 * se arregla.
 */
export type RolAsignado = "admin" | "member";

export function roleForMicrosoftUser({
  email,
  correoSemilla,
}: {
  /** Si es el primer usuario de la instalación. Ya no decide por sí solo. */
  esPrimerUsuario: boolean;
  email: string;
  correoSemilla: string | undefined;
}): RolAsignado {
  if (!correoSemilla) return "member";

  const normalizado = email.trim().toLowerCase();
  return normalizado === correoSemilla.trim().toLowerCase()
    ? "admin"
    : "member";
}
