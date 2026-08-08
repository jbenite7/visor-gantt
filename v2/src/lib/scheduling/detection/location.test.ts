import { extractLocation } from "./location";

describe("extractLocation · pisos y sótanos (nombres reales de DA PORTO)", () => {
  test("un piso da su número", () => {
    expect(extractLocation("LOSA AÉREA PISO 5")).toEqual({
      label: "Piso",
      raw: "5",
      value: 5,
    });
  });

  test("SÓTANO 3 es el piso -3, para que ordene por debajo del piso 1", () => {
    expect(extractLocation("LOSA DE CIMENTACIÓN SÓTANO 3")).toEqual({
      label: "Sótano",
      raw: "3",
      value: -3,
    });
  });

  test("el sótano sin tilde también, que es como lo escribe el archivo real", () => {
    expect(extractLocation("ASEO DE APARTAMENTOS SOTANO 1")?.value).toBe(-1);
  });

  test("nivel y planta cuentan como piso: es el mismo sitio con otro nombre", () => {
    expect(extractLocation("MAMPOSTERÍA NIVEL 4")).toEqual({
      label: "Piso",
      raw: "4",
      value: 4,
    });
    expect(extractLocation("PINTURA PLANTA 2")?.label).toBe("Piso");
  });

  test("la etapa conserva etiqueta propia: no es un piso", () => {
    expect(extractLocation("URBANISMO ETAPA 2")).toEqual({
      label: "Etapa",
      raw: "2",
      value: 2,
    });
  });

  test("lo que no menciona ubicación devuelve null, no cero", () => {
    expect(extractLocation("EXCAVACIÓN A COTA 2110")).toBeNull();
    expect(extractLocation("DESCABECE DE PILOTES")).toBeNull();
    expect(extractLocation("MICROPILOTES INSERTOS")).toBeNull();
    expect(extractLocation("LOSAS TACOS DE ESCALAS")).toBeNull();
  });
});

import {
  extractLocation as extract,
  formatLocationLabel,
  LOCATION_PATTERNS,
  MEZZANINE_LOCATION_VALUE,
  ROOF_LOCATION_VALUE,
} from "./location";

describe("extractLocation · el resto del vocabulario de obra", () => {
  test("la torre por letra se convierte en número: A=1, C=3", () => {
    expect(extract("ESTRUCTURA TORRE A")).toEqual({
      label: "Torre",
      raw: "A",
      value: 1,
    });
    expect(extract("ACABADOS TORRE C")?.value).toBe(3);
  });

  test("la torre por número también", () => {
    expect(extract("DAPORTO TORRE 3")).toEqual({
      label: "Torre",
      raw: "3",
      value: 3,
    });
  });

  test("zona, sector y tramo conservan etiqueta propia", () => {
    expect(extract("ENGRAMADO ZONA 2")?.label).toBe("Zona");
    expect(extract("VACIADO SECTOR 4")?.label).toBe("Sector");
    expect(extract("VÍAS INTERNAS TRAMO 1")?.label).toBe("Tramo");
  });

  test("PISO CUBIERTA se resuelve, aunque no lleve número", () => {
    expect(extract("PISO CUBIERTA")).toEqual({
      label: "Piso",
      raw: "CUBIERTA",
      value: ROOF_LOCATION_VALUE,
    });
  });

  test("LOSA AÉREA CUBIERTA también: es el nombre real del archivo", () => {
    expect(extract("LOSA AÉREA CUBIERTA")?.value).toBe(ROOF_LOCATION_VALUE);
  });

  test("la cubierta ordena por encima del último piso", () => {
    expect(extract("LOSA AÉREA CUBIERTA")!.value).toBeGreaterThan(
      extract("LOSA AÉREA PISO 12")!.value,
    );
  });

  test("el mezanine va entre el sótano 1 y el piso 1", () => {
    expect(extract("MAMPOSTERÍA MEZANINE")?.value).toBe(MEZZANINE_LOCATION_VALUE);
    expect(extract("MAMPOSTERÍA MEZZANINE")?.value).toBe(MEZZANINE_LOCATION_VALUE);
    expect(MEZZANINE_LOCATION_VALUE).toBeGreaterThan(extract("SOTANO 1")!.value);
    expect(MEZZANINE_LOCATION_VALUE).toBeLessThan(extract("PISO 1")!.value);
  });

  test("los códigos cortos se reconocen: P01 es piso, S1 es sótano", () => {
    expect(extract("MURO P01")).toEqual({ label: "Piso", raw: "01", value: 1 });
    expect(extract("MURO S1")).toEqual({ label: "Sótano", raw: "1", value: -1 });
    expect(extract("MURO N-2")).toEqual({ label: "Piso", raw: "2", value: 2 });
  });

  test("una letra suelta dentro de una palabra no cuenta como código", () => {
    expect(extract("PINTURA GENERAL")).toBeNull();
    expect(extract("NIVELACIÓN Y PERFILACIÓN")).toBeNull();
    expect(extract("PERFILACIÓN Y NIVELACIÓN")).toBeNull();
  });

  test("la torregrúa es una máquina, no una torre", () => {
    // Diez tareas reales de `test_data/20260430 PROGRAMACION ESTACION 16 -
    // ML1 R2.mpp` hablan de la torregrúa. Sin el `\b` final del patrón de
    // torre, «torregrua» se leería como «Torre G» y esas tareas acabarían
    // repartidas por una ubicación inventada. Es la misma trampa que
    // documenta PDC V2: el texto se parece y significa otra cosa.
    expect(extract("Montaje torregrúa")).toBeNull();
    expect(extract("Dado para torregrua")).toBeNull();
    expect(extract("Pilotaje para torregruas")).toBeNull();
    expect(extract("Aprobacion de diseño cimentacion torregrua")).toBeNull();
    expect(extract("Prealistamiento de torregrúas")).toBeNull();
  });

  test("escrita separada tampoco: «torre grúa» sigue siendo la máquina", () => {
    expect(extract("Montaje torre grúa")).toBeNull();
    expect(extract("Montaje torre grúa 2")).toBeNull();
  });

  test("pero una torre de verdad sí se reconoce", () => {
    expect(extract("ESTRUCTURA TORRE A")?.value).toBe(1);
    expect(extract("Acabados torre B")?.value).toBe(2);
  });

  test("el piso escrito con palabra gana a un código que aparezca después", () => {
    expect(extract("MAMPOSTERÍA PISO 4 PLANO S2")?.value).toBe(4);
  });

  test("formatLocationLabel nombra la ubicación como la nombraría un residente", () => {
    expect(formatLocationLabel(extract("LOSA AÉREA PISO 5")!)).toBe("Piso 5");
    expect(formatLocationLabel(extract("COLUMNAS SÓTANO 2")!)).toBe("Sótano 2");
    expect(formatLocationLabel(extract("ESTRUCTURA TORRE B")!)).toBe("Torre B");
  });

  test("los centinelas se dicen con su nombre, nunca con su número", () => {
    // Sin esto, Unidad Típica pintaría literalmente «Nivel 900».
    expect(formatLocationLabel(extract("LOSA AÉREA CUBIERTA")!)).toBe("Cubierta");
    expect(formatLocationLabel(extract("MAMPOSTERÍA MEZANINE")!)).toBe("Mezanine");
  });

  test("dos ubicaciones distintas con el mismo número no comparten etiqueta", () => {
    // «SÓTANO 3» y «PISO 3» dan ambos raw «3». Si la etiqueta fuera solo el
    // número, Unidad Típica los contaría como un mismo nivel y perdería uno.
    expect(formatLocationLabel(extract("COLUMNAS SÓTANO 3")!)).not.toBe(
      formatLocationLabel(extract("COLUMNAS PISO 3")!),
    );
  });

  test("el patrón del sótano lleva la tilde como alternativa, porque se reutiliza sin normalizar", () => {
    // `typicalUnit.ts` recorre estos patrones para quitar la ubicación del
    // nombre y quedarse con el sistema, y lo hace sobre el nombre **tal cual**
    // para conservar las tildes de «Mampostería». Sin esta alternativa,
    // «Pintura Sótano 1» y «Pintura Piso 1» serían dos sistemas distintos.
    const sotano = LOCATION_PATTERNS.find((pattern) => pattern.label === "Sótano")!;
    expect(new RegExp(sotano.regex.source, "i").test("Pintura Sótano 1")).toBe(true);
    expect(new RegExp(sotano.regex.source, "i").test("Pintura Sotano 1")).toBe(true);
  });
});

describe("unidades nombradas con letra", () => {
  const extract = (name: string) => extractLocation(name);

  test("las zonas, etapas, sectores, lotes y tramos también se nombran con letra", () => {
    expect(extract("Excavación Zona A")).toMatchObject({ label: "Zona", raw: "A", value: 1 });
    expect(extract("Etapa B urbanismo")).toMatchObject({ label: "Etapa", raw: "B", value: 2 });
    expect(extract("Sector B")).toMatchObject({ label: "Sector", raw: "B", value: 2 });
    expect(extract("Lote A")).toMatchObject({ label: "Lote", raw: "A", value: 1 });
    expect(extract("Tramo A")).toMatchObject({ label: "Tramo", raw: "A", value: 1 });
  });

  test("el área sin guion también ubica", () => {
    expect(extract("Pintura Área 3")).toMatchObject({ label: "Zona", raw: "3", value: 3 });
    // La forma con guion, que ya existía, sigue funcionando.
    expect(extract("Pintura ÁREA X-9")?.value).toBe(9);
  });

  test("el apartamento admite el sufijo de letra y conserva el texto completo", () => {
    expect(extract("Acabados Apto 302A")).toMatchObject({
      label: "Apartamento",
      raw: "302A",
      value: 302,
    });
    expect(extract("Acabados Apto 302")).toMatchObject({ raw: "302", value: 302 });
  });

  test("una palabra pegada detrás no es una letra de unidad", () => {
    // Sin el `\b` final, «ZONA COMÚN» daría «Zona C» y «ZONA VERDE», «Zona V».
    expect(extract("ZONA COMÚN")).toBeNull();
    expect(extract("ZONA VERDE")).toBeNull();
    expect(extract("SECTOR PRIVADO")).toBeNull();
  });
});


describe("extractLocation · la ubicación puede ser un tramo", () => {
  test("lo que ya resolvía sigue sin tramo: nada cambia para obra vertical", () => {
    expect(extractLocation("LOSA AÉREA PISO 5")?.span).toBeUndefined();
    expect(extractLocation("COLUMNAS SÓTANO 2")?.span).toBeUndefined();
  });

  test("el tipo admite un tramo con principio y fin", () => {
    // Este test fija la forma del dato antes de que ningún patrón lo use.
    const conTramo = {
      label: "Eje",
      raw: "A",
      value: 1,
      span: { rawFrom: "A", rawTo: "D", from: 1, to: 4 },
    };

    expect(conTramo.span.from).toBe(conTramo.value);
    expect(conTramo.span.to).toBeGreaterThan(conTramo.span.from);
  });
});

describe("extractLocation · ejes (nombres reales de la Estación 16)", () => {
  test("un rango de ejes da un tramo con principio y fin", () => {
    const eje = extractLocation("Lucarnas (Ejes DB4-DB8)");
    expect(eje?.span).toEqual({ rawFrom: "DB4", rawTo: "DB8", from: 4, to: 8 });
  });

  test("el rango también con la palabra en singular", () => {
    expect(extractLocation("Construcción Losa Aérea (Eje D-H)")?.span).toEqual({
      rawFrom: "D",
      rawTo: "H",
      from: 4,
      to: 8,
    });
  });

  test("un rango entre familias distintas se admite y conserva los dos textos", () => {
    // Fragmento de «Módulo 2.2 (Ejes J-DB08)», un nombre real del archivo. En
    // el nombre entero gana el módulo; aquí se prueba solo la parte del eje,
    // que cruza dos rejillas. El dato lo dice; ordenarlas entre sí es
    // problema de quien las dibuje, no del extractor.
    const eje = extractLocation("Ejes J-DB08");
    expect(eje?.span?.rawFrom).toBe("J");
    expect(eje?.span?.rawTo).toBe("DB08");
  });

  test("cuando el nombre trae módulo y eje, gana el módulo", () => {
    // El módulo es la unidad de producción; el eje dice dónde está ese módulo.
    const match = extractLocation("Módulo 1.1 (Ejes A-D)");
    expect(match?.label).toBe("Módulo");
    expect(match?.value).toBe(1.1);
    expect(match?.span).toBeUndefined();
  });

  test("el rango numérico también: «Eje 3-H» es un caso real del archivo", () => {
    expect(extractLocation("Solución apuntalamiento (Eje 3-H)")?.span?.rawFrom).toBe("3");
  });

  test("un eje suelto resuelve sin tramo", () => {
    const eje = extractLocation("Refuerzo (eje A)");
    expect(eje?.label).toBe("Eje");
    expect(eje?.value).toBe(1);
    expect(eje?.span).toBeUndefined();
  });

  test("«eje» sin etiqueta detrás no resuelve", () => {
    expect(extractLocation("Replanteo de ejes")).toBeNull();
    expect(extractLocation("Nivelación hasta nivel superior")).toBeNull();
  });

  test("un guion decorativo no convierte un eje suelto en rango", () => {
    // Exige dos etiquetas alrededor del separador, no una sola.
    expect(extractLocation("Losa aérea - Eje D")?.span).toBeUndefined();
  });
});

describe("extractLocation · módulo y edificio", () => {
  test("el módulo admite decimal, porque 1.1 y 1.2 son submódulos del 1", () => {
    expect(extractLocation("Módulo 1.1 (Ejes A-D)")).toMatchObject({
      label: "Módulo",
      raw: "1.1",
      value: 1.1,
    });
    expect(extractLocation("Modulo 2.2")?.value).toBe(2.2);
  });

  test("el módulo gana al eje: es la unidad de producción de esa obra", () => {
    // «Módulo 1.1 (Ejes A-D)» tiene los dos. El módulo es donde se trabaja;
    // el eje dice dónde está ese módulo.
    expect(extractLocation("Módulo 1.1 (Ejes A-D)")?.label).toBe("Módulo");
  });

  test("un módulo entero también", () => {
    expect(extractLocation("Excavación Módulo 3")?.value).toBe(3);
  });

  test("el edificio resuelve por su número", () => {
    expect(extractLocation("Inicio de obra Edificio 1 (Sur)")).toMatchObject({
      label: "Edificio",
      value: 1,
    });
    expect(extractLocation("Edificio 2 (Norte)")?.value).toBe(2);
  });

  test("«EDIFICIO DESCENDENTE» no es una ubicación: no lleva número", () => {
    expect(extractLocation("EDIFICIO DESCENDENTE")).toBeNull();
  });

  test("los ejes de obra vertical siguen intactos", () => {
    expect(extractLocation("LOSA AÉREA PISO 5")?.label).toBe("Piso");
    expect(extractLocation("COLUMNAS SÓTANO 3")?.value).toBe(-3);
  });
});

describe("extractLocation · tareas que cruzan dos pisos", () => {
  test("«Piso 1 a 2» es un tramo, no el piso 1 a secas", () => {
    // Es un caso real del archivo de la Estación 16, y hasta ahora el
    // extractor devolvía el primer número y descartaba el resto en silencio.
    expect(extractLocation("Piso 1 a 2 (eje A)")).toMatchObject({
      label: "Piso",
      value: 1,
      span: { rawFrom: "1", rawTo: "2", from: 1, to: 2 },
    });
  });

  test("también con guion", () => {
    expect(extractLocation("Escalera piso 2-3")?.span).toEqual({
      rawFrom: "2",
      rawTo: "3",
      from: 2,
      to: 3,
    });
  });

  test("un piso normal sigue sin tramo", () => {
    expect(extractLocation("Piso 2 (eje B a D)")?.span).toBeUndefined();
    expect(extractLocation("LOSA AÉREA PISO 5")?.span).toBeUndefined();
  });

  test("el orden por value no cambia: un tramo ordena por donde empieza", () => {
    expect(extractLocation("Piso 1 a 2 (eje A)")!.value).toBeLessThan(
      extractLocation("LOSA AÉREA PISO 5")!.value,
    );
  });
});
