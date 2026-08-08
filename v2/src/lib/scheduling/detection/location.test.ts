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
