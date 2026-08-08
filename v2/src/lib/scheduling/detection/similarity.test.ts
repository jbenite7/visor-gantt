import {
  SIMILARITY_THRESHOLD,
  bestMatchByTokens,
  jaccardSimilarity,
} from "./similarity";

describe("jaccardSimilarity", () => {
  test("el caso límite que el umbral tiene que dejar pasar: 1 de 3 palabras", () => {
    const score = jaccardSimilarity("URBANISMO Y OBRAS EXTERIORES", "URBANISMO");
    expect(score).toBeCloseTo(1 / 3, 5);
    expect(score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });

  test("nombres idénticos dan 1", () => {
    expect(jaccardSimilarity("RED DE GAS", "RED DE GAS")).toBe(1);
  });

  test("sin palabras en común da 0", () => {
    expect(jaccardSimilarity("VENTANERÍA", "MOVIMIENTO DE TIERRA")).toBe(0);
  });

  test("un nombre sin palabras significativas da 0 y no revienta", () => {
    expect(jaccardSimilarity("DE LA", "VENTANERÍA")).toBe(0);
  });

  test("por qué el diccionario va primero: el texto empareja mal y aun así pasa el umbral", () => {
    // «CARPINTERIA EN MADERA» y «CARPINTERIA METALICA» comparten una palabra
    // de tres: superan el umbral y NO son el mismo oficio. Es el caso que
    // documenta AmarreCronogramaService y el que el diccionario corrige.
    const score = jaccardSimilarity("CARPINTERIA EN MADERA", "CARPINTERIA METALICA");
    expect(score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });
});

describe("bestMatchByTokens", () => {
  const frentes = [
    { id: "urb", nombre: "URBANISMO" },
    { id: "est", nombre: "ESTRUCTURA" },
    { id: "red", nombre: "RED HIDROSANITARIA Y DE GAS" },
  ];

  test("devuelve el candidato más parecido con su puntuación", () => {
    const match = bestMatchByTokens(
      "URBANISMO Y OBRAS EXTERIORES",
      frentes,
      (frente) => frente.nombre,
    );
    expect(match?.candidate.id).toBe("urb");
    expect(match?.score).toBeCloseTo(1 / 3, 5);
  });

  test("gana el más parecido, no el primero de la lista", () => {
    const match = bestMatchByTokens(
      "RED DE GAS INTERNA",
      frentes,
      (frente) => frente.nombre,
    );
    expect(match?.candidate.id).toBe("red");
  });

  test("por debajo del umbral no devuelve nada", () => {
    const match = bestMatchByTokens(
      "MESONES DE COCINA",
      frentes,
      (frente) => frente.nombre,
    );
    expect(match).toBeNull();
  });
});
