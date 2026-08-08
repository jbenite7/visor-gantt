import { ESTACION_16_NAMES } from "./estacion16";
import { extractLocation } from "../location";

describe("vocabulario real de PROGRAMACION ESTACION 16", () => {
  test.each(ESTACION_16_NAMES)("«$name» → $label $value", (caso) => {
    const resultado = extractLocation(caso.name);
    expect(resultado?.label ?? null).toBe(caso.label);
    expect(resultado?.value ?? null).toBe(caso.value);
    if (caso.span) {
      expect(resultado?.span?.from).toBe(caso.span.from);
      expect(resultado?.span?.to).toBe(caso.span.to);
      expect(resultado?.span?.crossesGrids).toBe(caso.span.crossesGrids);
    }
  });

  test("las trampas del archivo siguen sin resolver", () => {
    // Las cinco «torregrúa» son la máquina, no una torre. Las cuatro
    // «nivel superior» son una descripción, no un nivel. Y «EDIFICIO
    // DESCENDENTE» no lleva número.
    for (const name of [
      "Montaje torregrúa",
      "Dado para torregrua",
      "Pilotaje para torregrua por ML1",
      "Prealistamiento de torregrúas",
      "Aprobacion de diseño cimentacion torregrua",
      "Rellenos laterales y nivelacion hasta nivel superior Viga de Cimentacion",
      "EDIFICIO DESCENDENTE",
    ]) {
      expect(extractLocation(name)).toBeNull();
    }
  });

  test("el vocabulario de obra lineal queda cubierto", () => {
    const resueltos = ESTACION_16_NAMES.filter((caso) => caso.label !== null);
    expect(resueltos.length).toBeGreaterThanOrEqual(20);

    const etiquetas = new Set(resueltos.map((caso) => caso.label));
    expect(etiquetas).toContain("Eje");
    expect(etiquetas).toContain("Módulo");
    expect(etiquetas).toContain("Edificio");
    expect(etiquetas).toContain("Piso");
  });
});
