import {
  EMPTY_DETECTION_DICTIONARY,
  lookupCorrection,
  rememberCorrection,
} from "./dictionary";

const AYER = "2026-08-06T10:00:00.000Z";
const HOY = "2026-08-07T10:00:00.000Z";

describe("diccionario de correcciones", () => {
  test("el diccionario vacío no encuentra nada", () => {
    expect(
      lookupCorrection(EMPTY_DETECTION_DICTIONARY, "sistema", "VENTANERÍA"),
    ).toBeUndefined();
  });

  test("guarda una corrección y la encuentra", () => {
    const dictionary = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "sistema",
      name: "Carpintería en madera",
      value: "Ventanería",
      note: "El texto la confunde con la carpintería metálica; en obra van juntas con ventanería.",
      recordedAt: HOY,
    });

    expect(lookupCorrection(dictionary, "sistema", "CARPINTERIA EN MADERA")).toEqual({
      kind: "sistema",
      key: "CARPINTERIA EN MADERA",
      value: "Ventanería",
      note: "El texto la confunde con la carpintería metálica; en obra van juntas con ventanería.",
      recordedAt: HOY,
    });
  });

  test("busca sin importar tildes ni mayúsculas", () => {
    const dictionary = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "ubicacion",
      name: "Sótano de máquinas",
      value: "-1",
      note: "El cuarto de máquinas está en el sótano 1.",
      recordedAt: HOY,
    });

    expect(lookupCorrection(dictionary, "ubicacion", "sotano de maquinas")?.value).toBe("-1");
  });

  test("corregir dos veces el mismo nombre lo reemplaza, no lo duplica", () => {
    const primera = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "sistema",
      name: "Aseo de apartamentos",
      value: "Acabados",
      note: "Primera corrección.",
      recordedAt: AYER,
    });
    const segunda = rememberCorrection(primera, {
      kind: "sistema",
      name: "ASEO DE APARTAMENTOS",
      value: "Entrega",
      note: "El aseo final pertenece a entrega, no a acabados.",
      recordedAt: HOY,
    });

    expect(segunda.corrections).toHaveLength(1);
    expect(segunda.corrections[0].value).toBe("Entrega");
    expect(segunda.corrections[0].recordedAt).toBe(HOY);
  });

  test("el mismo nombre para ubicación y para sistema son dos correcciones distintas", () => {
    const dictionary = rememberCorrection(
      rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
        kind: "sistema",
        name: "Cubierta",
        value: "Estructura",
        note: "La cubierta se vacía con estructura.",
        recordedAt: HOY,
      }),
      {
        kind: "ubicacion",
        name: "Cubierta",
        value: "900",
        note: "Va por encima del último piso.",
        recordedAt: HOY,
      },
    );

    expect(dictionary.corrections).toHaveLength(2);
    expect(lookupCorrection(dictionary, "sistema", "cubierta")?.value).toBe("Estructura");
    expect(lookupCorrection(dictionary, "ubicacion", "cubierta")?.value).toBe("900");
  });

  test("recordar no muta el diccionario recibido", () => {
    const original = EMPTY_DETECTION_DICTIONARY;
    rememberCorrection(original, {
      kind: "sistema",
      name: "Mesones de cocina",
      value: "Acabados",
      note: "Va con acabados.",
      recordedAt: HOY,
    });

    expect(original.corrections).toHaveLength(0);
  });
});
