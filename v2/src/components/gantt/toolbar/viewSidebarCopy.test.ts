import { VIEW_TABS } from "./ViewSidebar";
import { viewSidebarBlurb } from "@/lib/gantt/viewSidebarBlurb";

/**
 * El reverso de la valla: R0 arregla las entradas de hoy, este test impide
 * que la número doce entre muda. Es el mismo patrón del detector de copy.
 */
describe("Detector de entradas mudas en el menú (R0)", () => {
  test("toda entrada del menú tiene descripción, con datos y sin ellos", () => {
    const mudasSinDatos = VIEW_TABS.filter(
      (tab) =>
        viewSidebarBlurb(tab.id, { areaCount: 0, resourceCount: 0 }).trim() === "",
    ).map((tab) => tab.id);

    const mudasConDatos = VIEW_TABS.filter(
      (tab) =>
        viewSidebarBlurb(tab.id, { areaCount: 5, resourceCount: 5 }).trim() === "",
    ).map((tab) => tab.id);

    expect({ mudasSinDatos, mudasConDatos }).toEqual({
      mudasSinDatos: [],
      mudasConDatos: [],
    });
  });

  test("ninguna descripción repite literalmente su etiqueta", () => {
    const redundantes = VIEW_TABS.filter(
      (tab) =>
        viewSidebarBlurb(tab.id, { areaCount: 5, resourceCount: 5 }) ===
        tab.labelEs,
    ).map((tab) => tab.id);

    expect(redundantes).toEqual([]);
  });
});
