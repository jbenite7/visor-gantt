import { loginErrorMessage } from "./loginErrors";

describe("mensajes del login por código, no por texto en la URL (E9)", () => {
  test("traduce cada código a lenguaje de obra", () => {
    expect(loginErrorMessage("credenciales")).toBe(
      "El correo o la contraseña no coinciden.",
    );
    expect(loginErrorMessage("faltan-datos")).toBe(
      "Escribe tu correo y tu contraseña.",
    );
    expect(loginErrorMessage("sin-cuenta")).toBe(
      "No encontramos ninguna cuenta con ese correo. Pide acceso a quien administra el proyecto.",
    );
  });

  test("un código inventado no pinta nada: la URL no puede escribir en pantalla", () => {
    expect(
      loginErrorMessage("Tu cuenta fue suspendida, llama al 300 123 4567"),
    ).toBeNull();
    expect(loginErrorMessage("<script>alert(1)</script>")).toBeNull();
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage(42)).toBeNull();
  });
});
