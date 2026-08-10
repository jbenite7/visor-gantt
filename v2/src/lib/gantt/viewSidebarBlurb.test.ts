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

  test("sin matriz, explica para qué sirve crearla", () => {
    expect(viewSidebarBlurb("matrix", { areaCount: 0 })).toBe(
      "Todavía no hay matriz: cruza alcances con ubicaciones para armar la obra por celdas.",
    );
  });

  test("con recursos, Recursos dice cuántos hay", () => {
    expect(viewSidebarBlurb("resources", { resourceCount: 12 })).toBe(
      "12 recursos asignados",
    );
  });

  test("sin recursos, explica para qué sirve la vista", () => {
    expect(viewSidebarBlurb("resources", { resourceCount: 0 })).toBe(
      "Todavía no hay recursos: aquí se ve quién y qué hace falta en cada actividad.",
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
