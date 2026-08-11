import { shouldStartSave } from "./saveGuard";

/**
 * `doSave` no tenía guarda de petición en vuelo: dos guardados propios podían
 * solaparse —el temporizador de 750 ms disparando mientras el anterior seguía
 * viajando— y llegar al servidor en orden distinto al que se generaron.
 * Con control de versión eso además provoca un conflicto contra uno mismo.
 */
describe("shouldStartSave", () => {
  test("sin cambios pendientes no se guarda", () => {
    expect(
      shouldStartSave({ hasPendingChanges: false, saveInFlight: false }),
    ).toBe(false);
  });

  test("con cambios y nada en vuelo, se guarda", () => {
    expect(
      shouldStartSave({ hasPendingChanges: true, saveInFlight: false }),
    ).toBe(true);
  });

  test("con un guardado ya en vuelo, se espera", () => {
    expect(
      shouldStartSave({ hasPendingChanges: true, saveInFlight: true }),
    ).toBe(false);
  });
});
