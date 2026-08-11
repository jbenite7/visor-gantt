/**
 * Traduce un fallo de guardado a algo que quien está en obra pueda usar.
 *
 * `saveProject` devolvía `err.message` tal cual y `GanttView` lo pinta en
 * pantalla, así que un fallo de base enseñaba `connect ECONNREFUSED
 * 127.0.0.1:5432` o `column "version" does not exist`. Ni le dice qué hacer, ni
 * conviene contar tanto del servidor.
 *
 * Es el mismo patrón que `humanParserError` ya aplicaba a los errores del
 * analizador: el detalle técnico se queda en el registro del servidor.
 */

/**
 * Mensajes que la propia app escribió **para el usuario** y pasan intactos.
 *
 * Se reconocen por cómo empiezan, no por el texto entero: así una corrección de
 * redacción no los convierte de golpe en «error inesperado».
 */
const ESCRITOS_PARA_EL_USUARIO = [
  "Otra pestaña guardó",
  "Este proyecto no es tuyo",
  "No tienes permisos",
  "No autenticado",
  "El archivo supera",
];

export function humanSaveError(mensaje: string | undefined): string {
  if (!mensaje) {
    return "No pudimos guardar. Inténtalo otra vez; si sigue igual, avisa a quien administra el proyecto.";
  }

  if (ESCRITOS_PARA_EL_USUARIO.some((inicio) => mensaje.startsWith(inicio))) {
    return mensaje;
  }

  // Un fallo de conexión es el único que el usuario puede llegar a resolver
  // -esperar, reintentar-, así que se distingue.
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection|socket/i.test(mensaje)) {
    return "No pudimos conectar con el servidor. Tu trabajo sigue en pantalla: espera un momento y vuelve a intentarlo.";
  }

  return "No pudimos guardar los cambios. Tu trabajo sigue en pantalla; vuelve a intentarlo y, si sigue igual, avisa a quien administra el proyecto.";
}
