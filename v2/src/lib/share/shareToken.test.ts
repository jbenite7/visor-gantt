import {
  SHARE_TOKEN_BYTES,
  SHARE_TTL_DAYS,
  createShareToken,
  isShareExpired,
  shareExpiryFrom,
} from "./shareToken";

describe("shareToken (E51: el enlace no se adivina y no dura para siempre)", () => {
  test("el token es largo: adivinarlo probando no es una opción", () => {
    expect(SHARE_TOKEN_BYTES).toBe(32);
    expect(createShareToken().length).toBeGreaterThanOrEqual(32);
  });

  test("dos tokens seguidos no se parecen", () => {
    expect(createShareToken()).not.toBe(createShareToken());
  });

  test("el token solo lleva caracteres seguros para una URL", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(createShareToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  // Los tres de arriba —largo, distintos, caracteres de URL— los pasa también
  // un token derivado del reloj: `Date.now().toString(36)` es único y casa con
  // `[A-Za-z0-9_-]`. Y un token derivado del reloj **se adivina**: quien sube
  // un archivo sabe a qué hora subió el de al lado.
  //
  // Estos dos sí separan lo fuerte de lo débil, y sin atarse a la
  // implementación: no comprueban que se llame a `randomBytes`, comprueban que
  // el resultado no se comporte como un contador.
  test("los tokens no salen ordenados en el tiempo: no vienen del reloj", () => {
    const generados = Array.from({ length: 50 }, () => createShareToken());
    const ordenados = [...generados].sort();

    expect(ordenados).not.toEqual(generados);
  });

  test("dos tokens seguidos no comparten un prefijo largo", () => {
    const a = createShareToken();
    const b = createShareToken();

    let comunes = 0;
    while (comunes < a.length && a[comunes] === b[comunes]) comunes += 1;

    expect(comunes).toBeLessThan(4);
  });

  test("caduca siete días después de subirlo", () => {
    const subida = new Date("2026-08-10T09:00:00.000Z");

    expect(shareExpiryFrom(subida).toISOString()).toBe(
      "2026-08-17T09:00:00.000Z",
    );
    expect(SHARE_TTL_DAYS).toBe(7);
  });

  test("antes del plazo sigue vivo; después, no", () => {
    const caduca = new Date("2026-08-17T09:00:00.000Z");

    expect(isShareExpired(caduca, new Date("2026-08-16T23:59:00.000Z"))).toBe(
      false,
    );
    expect(isShareExpired(caduca, new Date("2026-08-17T09:00:01.000Z"))).toBe(
      true,
    );
  });

  test("acepta la fecha como texto, que es como viene de la base de datos", () => {
    expect(
      isShareExpired(
        "2026-08-17T09:00:00.000Z",
        new Date("2026-08-18T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  test("un proyecto sin fecha de caducidad no es temporal: nunca caduca", () => {
    expect(isShareExpired(null, new Date())).toBe(false);
    expect(isShareExpired(undefined, new Date())).toBe(false);
  });
});
