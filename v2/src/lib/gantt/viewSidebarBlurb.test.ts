import { viewSidebarBlurb } from "./viewSidebarBlurb";

describe("viewSidebarBlurb (R0: la entrada del menú dice qué hay dentro)", () => {
  test("con matriz, la Matriz dice cuántas ubicaciones tiene", () => {
    expect(viewSidebarBlurb("matrix", { areaCount: 26 })).toBe(
      "26 ubicaciones programadas",
    );
  });

  test("con una sola ubicación no dice «1 ubicaciones»", () => {
    expect(viewSidebarBlurb("matrix", { areaCount: 1 })).toBe(
      "1 ubicación programada",
    );
  });

  test("sin matriz, lo dice en corto: explicar es tarea de la vista", () => {
    expect(viewSidebarBlurb("matrix", { areaCount: 0 })).toBe(
      "Sin matriz todavía",
    );
  });

  test("con recursos, Recursos dice cuántos hay", () => {
    expect(viewSidebarBlurb("resources", { resourceCount: 12 })).toBe(
      "12 recursos asignados",
    );
  });

  test("sin recursos, lo dice en corto por el mismo motivo", () => {
    expect(viewSidebarBlurb("resources", { resourceCount: 0 })).toBe(
      "Sin recursos todavía",
    );
  });

  test("el resto de vistas reutiliza el propósito ya escrito en la ayuda por vista", () => {
    expect(viewSidebarBlurb("scurve")).toBe(
      "Cómo se acumula el avance en el tiempo, para comparar lo planeado con lo real.",
    );
  });

  test("Observaciones tiene propósito escrito, no cadena vacía", () => {
    expect(viewSidebarBlurb("observaciones").length).toBeGreaterThan(0);
  });
});

describe("la descripción del menú es una etiqueta, no un párrafo (revisión de cierre)", () => {
  /**
   * Medido en producción el 2026-08-08 sobre la demo: con las frases largas,
   * la entrada «Matriz» ocupaba 152 px y «Recursos» 140, frente a 52 del resto.
   * El menú pedía 881 px en 624 disponibles — no cabía, que es exactamente el
   * problema que R0 venía a arreglar, reaparecido en el caso vacío.
   *
   * La explicación completa ya vive dentro de la vista desde R8 y R9: la puerta
   * dice cuánto hay, la habitación explica qué es.
   */
  const LARGO_MAXIMO = 32;

  test("ninguna descripción pasa de una línea corta, con datos o sin ellos", () => {
    const vistas = ["matrix", "resources"] as const;
    const largas: string[] = [];

    for (const vista of vistas) {
      for (const contexto of [
        { areaCount: 0, resourceCount: 0 },
        { areaCount: 26, resourceCount: 17 },
      ]) {
        const texto = viewSidebarBlurb(vista, contexto);
        if (texto.length > LARGO_MAXIMO) largas.push(`${vista}: «${texto}»`);
      }
    }

    expect(largas).toEqual([]);
  });

  test("sin datos sigue diciendo que no hay, no se queda mudo", () => {
    expect(viewSidebarBlurb("matrix", { areaCount: 0 })).toMatch(/sin matriz/i);
    expect(viewSidebarBlurb("resources", { resourceCount: 0 })).toMatch(
      /sin recursos/i,
    );
  });
});
