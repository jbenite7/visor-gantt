/**
 * El mensaje de error del login viajaba como texto dentro de la URL, así que
 * cualquiera podía enviar un enlace que pintara lo que quisiera bajo la marca
 * del producto. Ahora viaja un código y el texto lo pone la app.
 */
export type LoginErrorCode = "credenciales" | "faltan-datos" | "sin-cuenta";

const MENSAJES: Record<LoginErrorCode, string> = {
  credenciales: "El correo o la contraseña no coinciden.",
  "faltan-datos": "Escribe tu correo y tu contraseña.",
  "sin-cuenta":
    "No encontramos ninguna cuenta con ese correo. Pide acceso a quien administra el proyecto.",
};

export function loginErrorMessage(code: unknown): string | null {
  if (typeof code !== "string") return null;
  return MENSAJES[code as LoginErrorCode] ?? null;
}
