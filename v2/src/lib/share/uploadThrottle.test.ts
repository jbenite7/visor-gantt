import {
  ANONYMOUS_UPLOADS_PER_HOUR,
  checkUploadAllowance,
  resetUploadThrottle,
} from "./uploadThrottle";

describe("uploadThrottle (E51: quitar la sesión abre el analizador a internet)", () => {
  beforeEach(() => {
    resetUploadThrottle();
  });

  const t0 = new Date("2026-08-10T09:00:00.000Z");

  test("las primeras cinco subidas de una hora pasan", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      expect(checkUploadAllowance("1.2.3.4", t0).allowed).toBe(true);
    }
  });

  test("la sexta se frena y dice cuánto falta", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    const verdict = checkUploadAllowance("1.2.3.4", t0);

    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBe(3600);
  });

  test("una hora después vuelve a pasar", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    const unaHoraDespues = new Date("2026-08-10T10:00:01.000Z");

    expect(checkUploadAllowance("1.2.3.4", unaHoraDespues).allowed).toBe(true);
  });

  test("el freno de una conexión no afecta a otra", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    expect(checkUploadAllowance("5.6.7.8", t0).allowed).toBe(true);
  });

  test("el tiempo que falta baja según avanza la hora", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    const media = new Date("2026-08-10T09:30:00.000Z");

    expect(checkUploadAllowance("1.2.3.4", media).retryAfterSeconds).toBe(1800);
  });
});
