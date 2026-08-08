import { DA_PORTO_NAMES } from "./daPorto";
import { extractLocation } from "../location";

describe("vocabulario real de DA PORTO TORRE 3", () => {
  test.each(DA_PORTO_NAMES)("«$name» → $expected", ({ name, expected }) => {
    expect(extractLocation(name)?.value ?? null).toBe(expected);
  });

  test("la estructura y los acabados quedan todos ubicados", () => {
    const conUbicacion = DA_PORTO_NAMES.filter((item) => item.expected !== null);
    expect(conUbicacion.length).toBeGreaterThanOrEqual(30);
    for (const item of conUbicacion) {
      expect(extractLocation(item.name)).not.toBeNull();
    }
  });

  test("los sótanos ordenan por debajo de los pisos y la cubierta por encima", () => {
    const valor = (name: string) => extractLocation(name)!.value;
    const orden = [
      "LOSA DE CIMENTACIÓN SÓTANO 3",
      "COLUMNAS SÓTANO 1",
      "LOSA AÉREA PISO 1",
      "LOSA AÉREA PISO 12",
      "LOSA AÉREA CUBIERTA",
    ].map(valor);

    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  test("el urbanismo sigue sin ubicación: nadie debe inventarle un piso", () => {
    for (const name of [
      "VÍAS INTERNAS",
      "SKATE PARK",
      "REDES EXTERNAS",
      "ENGRAMADO Y ADECUACIÓN ZO VERDE",
      "EXCAVACIÓN A COTA 2110",
      "DESCABECE DE PILOTES",
    ]) {
      expect(extractLocation(name)).toBeNull();
    }
  });
});
