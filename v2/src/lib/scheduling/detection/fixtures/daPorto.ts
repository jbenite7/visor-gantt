import { ROOF_LOCATION_VALUE } from "../location";

/**
 * Nombres de tarea extraídos del archivo de obra real
 * `aia-ms-project/20260312 DA PORTO TORRE 3.mpp` (239 tareas, el mismo en el
 * que el motor anterior resolvió 195 y falló en 44).
 *
 * Está aquí para que nadie pueda «mejorar la cobertura» aflojando un patrón:
 * la lista incluye tanto los que deben resolverse como los que deben seguir
 * sin ubicación. Si se relaja una regla para cazar uno, otro se rompe.
 *
 * `expected` es el valor ordenable, o `null` cuando la tarea es obra general.
 */
export interface DaPortoCase {
  name: string;
  expected: number | null;
}

export const DA_PORTO_NAMES: DaPortoCase[] = [
  // ── Preliminares y movimiento de tierra: obra general ──
  { name: "PRELIMINARES", expected: null },
  { name: "LOCALIZACIÓN Y REPLANTEO", expected: null },
  { name: "CONSTRUCCIÓN DE CAMPAMENTOS", expected: null },
  { name: "MOVIMIENTO DE TIERRA", expected: null },
  { name: "EXCAVACIÓN A COTA 2110", expected: null },
  { name: "DESCABECE DE PILOTES", expected: null },
  { name: "MICROPILOTES INSERTOS", expected: null },

  // ── Estructura: sótanos (los que hoy fallan) ──
  { name: "LOSA DE CIMENTACIÓN SÓTANO 3", expected: -3 },
  { name: "COLUMNAS SÓTANO 3", expected: -3 },
  { name: "LOSA AÉREA SÓTANO 2", expected: -2 },
  { name: "COLUMNAS SÓTANO 2", expected: -2 },
  { name: "LOSA AÉREA SÓTANO 1", expected: -1 },
  { name: "COLUMNAS SÓTANO 1", expected: -1 },

  // ── Estructura: pisos ──
  { name: "LOSA AÉREA PISO 1", expected: 1 },
  { name: "COLUMNAS PISO 1", expected: 1 },
  { name: "LOSA AÉREA PISO 2", expected: 2 },
  { name: "COLUMNAS PISO 2", expected: 2 },
  { name: "LOSA AÉREA PISO 3", expected: 3 },
  { name: "COLUMNAS PISO 3", expected: 3 },
  { name: "LOSA AÉREA PISO 4", expected: 4 },
  { name: "COLUMNAS PISO 4", expected: 4 },
  { name: "LOSA AÉREA PISO 5", expected: 5 },
  { name: "COLUMNAS PISO 5", expected: 5 },
  { name: "LOSA AÉREA PISO 6", expected: 6 },
  { name: "COLUMNAS PISO 6", expected: 6 },
  { name: "LOSA AÉREA PISO 7", expected: 7 },
  { name: "COLUMNAS PISO 7", expected: 7 },
  { name: "LOSA AÉREA PISO 8", expected: 8 },
  { name: "COLUMNAS PISO 8", expected: 8 },
  { name: "LOSA AÉREA PISO 9", expected: 9 },
  { name: "COLUMNAS PISO 9", expected: 9 },
  { name: "LOSA AÉREA PISO 10", expected: 10 },
  { name: "COLUMNAS PISO 10", expected: 10 },
  { name: "LOSA AÉREA PISO 11", expected: 11 },
  { name: "COLUMNAS PISO 11", expected: 11 },
  { name: "LOSA AÉREA PISO 12", expected: 12 },
  { name: "COLUMNAS PISO 12", expected: 12 },

  // ── Cubierta (hoy falla: «piso» sin número) ──
  { name: "LOSA AÉREA CUBIERTA", expected: ROOF_LOCATION_VALUE },
  { name: "PISO CUBIERTA", expected: ROOF_LOCATION_VALUE },
  { name: "LOSAS TACOS DE ESCALAS", expected: null },

  // ── Acabados: las tareas padre que dan ubicación a sus hijas ──
  { name: "SÓTANO 3", expected: -3 },
  { name: "SÓTANO 2", expected: -2 },
  { name: "SÓTANO 1", expected: -1 },
  { name: "SOTANO 3", expected: -3 },
  { name: "SOTANO 2", expected: -2 },
  { name: "SOTANO 1", expected: -1 },
  { name: "PISO 10", expected: 10 },
  { name: "PISO 11", expected: 11 },
  { name: "PISO 12", expected: 12 },

  // ── Acabados: nombres de oficio, sin ubicación propia ──
  { name: "MAMPOSTERÍA", expected: null },
  { name: "INTERNA", expected: null },
  { name: "FACHADA", expected: null },
  { name: "RED HIDROSANITARIA Y DE GAS", expected: null },
  { name: "RED ELÉCTRICA", expected: null },
  { name: "REVOQUES, ESTUCO Y PINTURA", expected: null },
  { name: "REVOQUE TRADICIONAL", expected: null },
  { name: "PINTURA", expected: null },
  { name: "PISOS Y ENCHAPES", expected: null },
  { name: "MORTEROS DE PISOS", expected: null },
  { name: "VENTANERÍA", expected: null },
  { name: "CARPINTERIA EN MADERA", expected: null },
  { name: "MESONES DE COCINA", expected: null },
  { name: "ASEO DE APARTAMENTOS", expected: null },

  // ── Urbanismo: obra general de verdad ──
  { name: "URBANISMO", expected: null },
  { name: "VIAS INTERNAS", expected: null },
  { name: "NIVELACIÓN Y PERFILACIÓN", expected: null },
  { name: "PERFILACIÓN Y NIVELACIÓN", expected: null },
  { name: "INSTALACIÓN DE CORDONES", expected: null },
  { name: "VACIADO DE ANDENES", expected: null },
  { name: "INSTALACIÓN DE PAVIMENTO", expected: null },
  { name: "SKATE PARK", expected: null },
  { name: "REDES EXTERNAS", expected: null },
  { name: "RED ELECTRICA", expected: null },
  { name: "RED DE GAS", expected: null },
  { name: "RED HIDROSANITARIA", expected: null },
  { name: "VACIADO EN CONCRETO", expected: null },
  { name: "ENGRAMADO Y ADECUACIÓN ZO VERDE", expected: null },
  { name: "INSTALACIÓN DE TRITURADO CABEZOTES", expected: null },
];
