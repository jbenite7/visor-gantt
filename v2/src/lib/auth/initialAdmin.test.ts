import { roleForMicrosoftUser } from "./initialAdmin";

/**
 * El candado que faltaba.
 *
 * `upsertMicrosoftUser` daba admin a la primera identidad que llegara cuando la
 * tabla estaba vacía, **sin mirar `INITIAL_ADMIN_EMAIL`** — un candado que el
 * camino de contraseña sí aplicaba. Con la tabla vacía, quien primero acertara
 * a entrar por Microsoft se llevaba el control completo de la instalación.
 *
 * Importa más ahora: por la decisión de propiedad, el admin ve y edita
 * **cualquier** proyecto. Ser admin por accidente pasa de molesto a grave.
 */
describe("roleForMicrosoftUser", () => {
  const semilla = "jefe@obra.com";

  test("el primero en llegar NO se lleva admin solo por ser el primero", () => {
    expect(
      roleForMicrosoftUser({
        esPrimerUsuario: true,
        email: "cualquiera@internet.com",
        correoSemilla: semilla,
      }),
    ).toBe("member");
  });

  test("el correo semilla sí se lleva admin", () => {
    expect(
      roleForMicrosoftUser({
        esPrimerUsuario: true,
        email: semilla,
        correoSemilla: semilla,
      }),
    ).toBe("admin");
  });

  test("y lo recibe aunque no sea el primero en entrar", () => {
    expect(
      roleForMicrosoftUser({
        esPrimerUsuario: false,
        email: semilla,
        correoSemilla: semilla,
      }),
    ).toBe("admin");
  });

  test("compara sin distinguir mayúsculas ni espacios sobrantes", () => {
    expect(
      roleForMicrosoftUser({
        esPrimerUsuario: true,
        email: "  JEFE@Obra.com ",
        correoSemilla: semilla,
      }),
    ).toBe("admin");
  });

  test("sin correo semilla configurado, nadie se lleva admin automáticamente", () => {
    // Preferimos una instalación sin admin -que se arregla configurando la
    // variable- a una donde el primer desconocido se lleve el control.
    expect(
      roleForMicrosoftUser({
        esPrimerUsuario: true,
        email: "cualquiera@internet.com",
        correoSemilla: undefined,
      }),
    ).toBe("member");
  });
});
