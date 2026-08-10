import { normalizeViewType } from "./viewTypes";

/**
 * `conflictos` se fundió en «Problemas» en el recorte C2 y ya no se enruta.
 *
 * La revisión en frío del 2026-08-08 lo señaló como pantalla en blanco para
 * proyectos guardados. **Comprobado: no hay camino que llegue ahí** — `UISettings`
 * no guarda la vista activa, solo el preset de rol, y ningún preset apunta a
 * `conflictos`. Queda como red por si algún día se guarda la vista activa, que
 * es justo el cambio que reabriría el agujero.
 */
describe("vistas retiradas que sobreviven en ajustes guardados", () => {
  test("«conflictos» se reenruta a Problemas, que es donde vive ahora", () => {
    expect(normalizeViewType("conflictos")).toBe("bottlenecks");
  });

  test("las vistas vivas se quedan como están", () => {
    for (const vista of ["gantt", "matrix", "observaciones", "settings"] as const) {
      expect(normalizeViewType(vista)).toBe(vista);
    }
  });

  test("las que se alcanzan por preset o por la paleta tampoco se tocan", () => {
    expect(normalizeViewType("tracking")).toBe("tracking");
    expect(normalizeViewType("taskSheet")).toBe("taskSheet");
    expect(normalizeViewType("network")).toBe("network");
  });
});
