import { shouldWarnBeforeUnload } from "./pendingChanges";

describe("aviso al cerrar (M33)", () => {
  test("no molesta cuando no hay nada pendiente", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "idle" }),
    ).toBe(false);
  });

  test("avisa cuando quedan cambios sin guardar", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: true, saveStatus: "idle" }),
    ).toBe(true);
  });

  test("avisa mientras se está guardando: cerrar ahora corta el envío", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "saving" }),
    ).toBe(true);
  });

  test("avisa si el último intento falló, aunque el estado ya esté limpio", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "error" }),
    ).toBe(true);
  });

  test("no avisa tras un guardado correcto", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "saved" }),
    ).toBe(false);
  });
});
