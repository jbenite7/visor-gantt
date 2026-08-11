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

  // El segundo cerrojo: el caso que importa no es el candado bien puesto, sino
  // la variable que se filtra a un despliegue real.
  test("apagado en una instalación servida por https, aunque la variable esté puesta", () => {
    for (const variable of ["PUBLIC_SITE_URL", "NEXT_PUBLIC_SITE_URL", "APP_URL"]) {
      expect(
        modoPruebaActivo({
          VISOR_TEST_MODE: "1",
          [variable]: "https://visor.aia.com.co",
        }),
      ).toBe(false);
    }
  });

  test("una URL http de desarrollo no lo apaga", () => {
    expect(
      modoPruebaActivo({
        VISOR_TEST_MODE: "1",
        PUBLIC_SITE_URL: "http://127.0.0.1:3001",
      }),
    ).toBe(true);
  });

  test("y sin la variable sigue apagado, con https o sin él", () => {
    expect(modoPruebaActivo({ PUBLIC_SITE_URL: "http://127.0.0.1:3001" })).toBe(false);
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
