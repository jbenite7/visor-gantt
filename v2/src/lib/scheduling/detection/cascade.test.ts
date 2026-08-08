import { resolveSystem } from "./cascade";
import { EMPTY_DETECTION_DICTIONARY, rememberCorrection } from "./dictionary";

const FRENTES = [
  "ESTRUCTURA",
  "MAMPOSTERÍA",
  "VENTANERÍA",
  "URBANISMO",
  "RED HIDROSANITARIA Y DE GAS",
];

describe("resolveSystem · la cascada de PDC V2", () => {
  test("el nombre exacto gana cuando existe", () => {
    const result = resolveSystem({ name: "Urbanismo", candidates: FRENTES });

    expect(result.system).toBe("URBANISMO");
    expect(result.origin).toBe("exacta");
    expect(result.evidence).toContain("se llama igual");
  });

  test("si no hay exacta, la similitud de palabras resuelve", () => {
    const result = resolveSystem({
      name: "URBANISMO Y OBRAS EXTERIORES",
      candidates: FRENTES,
    });

    expect(result.system).toBe("URBANISMO");
    expect(result.origin).toBe("similitud");
    expect(result.score).toBeCloseTo(1 / 3, 5);
    expect(result.evidence).toContain("se parece");
  });

  test("el diccionario gana a la similitud, que es el caso que el texto resuelve mal", () => {
    const dictionary = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "sistema",
      name: "CARPINTERIA EN MADERA",
      value: "VENTANERÍA",
      note: "En obra la carpintería de madera la monta la cuadrilla de ventanería.",
      recordedAt: "2026-08-07T10:00:00.000Z",
    });

    const conDiccionario = resolveSystem({
      name: "CARPINTERIA EN MADERA",
      candidates: [...FRENTES, "CARPINTERIA METALICA"],
      dictionary,
    });
    const sinDiccionario = resolveSystem({
      name: "CARPINTERIA EN MADERA",
      candidates: [...FRENTES, "CARPINTERIA METALICA"],
    });

    expect(conDiccionario.system).toBe("VENTANERÍA");
    expect(conDiccionario.origin).toBe("diccionario");
    expect(conDiccionario.evidence).toContain("cuadrilla de ventanería");
    // Sin el diccionario, el texto se equivoca con seguridad:
    expect(sinDiccionario.system).toBe("CARPINTERIA METALICA");
  });

  test("cuando nada casa, cae en el clasificador automático", () => {
    const result = resolveSystem({
      name: "MESONES DE COCINA",
      candidates: FRENTES,
      automatic: () => "Arquitectura",
    });

    expect(result.system).toBe("Arquitectura");
    expect(result.origin).toBe("automatica");
  });

  test("si tampoco el automático sabe, lo dice y cuenta qué probó", () => {
    const result = resolveSystem({
      name: "MESONES DE COCINA",
      candidates: FRENTES,
      automatic: () => null,
    });

    expect(result.system).toBeNull();
    expect(result.origin).toBe("sin_resolver");
    expect(result.evidence).toContain("diccionario");
    expect(result.evidence).toContain("similitud");
  });
});
