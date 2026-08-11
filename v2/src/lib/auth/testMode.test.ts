import { correoDeModoPrueba, modoPruebaActivo } from "./testMode";

/**
 * El candado, probado por su lado apagado.
 *
 * Un modo de prueba que abre sesión sin contraseña es, visto desde fuera, una
 * puerta trasera. Lo único que lo separa de serlo es que esté **apagado salvo
 * que alguien lo encienda a propósito**, así que eso es lo que se fija aquí:
 * la mayoría de estas pruebas comprueban que NO se enciende.
 */
describe("modoPruebaActivo", () => {
  test("apagado sin variable de entorno — el caso de producción", () => {
    expect(modoPruebaActivo({})).toBe(false);
  });

  test("apagado con la variable vacía", () => {
    expect(modoPruebaActivo({ VISOR_TEST_MODE: "" })).toBe(false);
  });

  test("apagado con cualquier valor que no sea exactamente 1", () => {
    // "true", "yes" y "0" son las tres formas en que alguien cree haberlo
    // apagado o encendido. Solo una lo enciende, y es la documentada.
    for (const valor of ["0", "true", "yes", "on", "sí", "1 ", "01"]) {
      expect(modoPruebaActivo({ VISOR_TEST_MODE: valor })).toBe(false);
    }
  });

  test("encendido solo con VISOR_TEST_MODE=1", () => {
    expect(modoPruebaActivo({ VISOR_TEST_MODE: "1" })).toBe(true);
  });
});

describe("correoDeModoPrueba", () => {
  test("usa una cuenta propia por defecto, nunca una del usuario", () => {
    expect(correoDeModoPrueba({})).toBe("modo-prueba@visor.local");
  });

  test("se puede apuntar a otra cuenta de prueba", () => {
    expect(
      correoDeModoPrueba({ VISOR_TEST_MODE_EMAIL: "  Revision@Visor.Local " }),
    ).toBe("revision@visor.local");
  });

  test("un valor en blanco cae al de por defecto en vez de a la cuenta vacía", () => {
    expect(correoDeModoPrueba({ VISOR_TEST_MODE_EMAIL: "   " })).toBe(
      "modo-prueba@visor.local",
    );
  });
});
