import { parseAxisLabel } from "./axisLabel";
import { normalizeName } from "./normalize";

/**
 * Ubicación detectada en un nombre de tarea.
 *
 * `value` es lo que hoy falta en visor-gantt y lo que aporta el extractor de
 * PDC V2 (`ActivityMatcherService::extractLocationValue`): un número
 * **ordenable**. Sin él, «SÓTANO 3» se ordena como texto y acaba después del
 * «PISO 12», que es justo al revés de como se construye una obra.
 */
export interface LocationMatch {
  /** Etiqueta para agrupar y mostrar: «Piso», «Sótano», «Torre»… */
  label: string;
  /** El texto tal cual salió del nombre. */
  raw: string;
  /** Número ordenable. Los sótanos son negativos. */
  value: number;
  /** Presente solo cuando la ubicación es un tramo. */
  span?: LocationSpan;
}

/**
 * Una ubicación con principio y fin.
 *
 * Un eje no es un punto: `Ejes A-D` dice «voy del A al D». Y una tarea de
 * transición entre pisos —`Piso 1 a 2`— es lo mismo. Reducir cualquiera de
 * los dos a su primer valor es descartar la mitad del dato sin avisar.
 *
 * `from` coincide siempre con `value`, para que todo lo que hoy ordena por
 * `value` siga funcionando sin enterarse de que existen los tramos.
 */
export interface LocationSpan {
  rawFrom: string;
  rawTo: string;
  from: number;
  to: number;
  /**
   * Cierto cuando el principio y el fin pertenecen a rejillas distintas.
   *
   * `Ejes J-DB08` va de la letra J a la serie DB: `from` y `to` son números de
   * rejillas distintas y **no se pueden restar ni comparar**. Los textos crudos
   * siguen siendo la verdad; estos números solo sirven dentro de una rejilla.
   */
  crossesGrids?: boolean;
}

export interface LocationPattern {
  label: string;
  regex: RegExp;
  valueOf: (match: RegExpMatchArray) => number;
  /** Solo los patrones de tramo lo aportan. */
  spanOf?: (match: RegExpMatchArray) => LocationSpan | null;
}

/**
 * La cubierta va por encima de cualquier piso realista. Es un centinela
 * elegido aquí, no un dato del proyecto: el extractor solo mira un nombre y
 * no sabe cuántos pisos tiene la torre. No se usa `Infinity` porque tiene
 * que poder guardarse como JSON.
 */
export const ROOF_LOCATION_VALUE = 900;

/** El mezanine está entre el sótano 1 y el piso 1. Igual que en PDC V2. */
export const MEZZANINE_LOCATION_VALUE = 0.5;

const numeric = (match: RegExpMatchArray): number => Number(match[1]);
const letterToNumber = (match: RegExpMatchArray): number =>
  match[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0) + 1;
/**
 * Número de un texto que puede llevar letra pegada: «302A» es el
 * apartamento 302 de la nomenclatura, no otro número.
 */
const leadingNumber = (match: RegExpMatchArray): number => Number.parseInt(match[1], 10);

/**
 * Patrones en orden de prioridad: gana el primero que acierta.
 *
 * El orden no es decorativo. Las palabras completas van antes que los
 * códigos de una letra, para que «MAMPOSTERÍA PISO 4 PLANO S2» dé el piso 4
 * y no el sótano 2. Y los códigos llevan `\b` a los dos lados para no cazar
 * la «p» de «pintura» ni la «s» de «escalas».
 *
 * Dos detalles que parecen redundantes y no lo son, porque estos patrones se
 * reutilizan fuera de `extractLocation`:
 *
 * · **la bandera `i`** — `lob.ts` los aplica sobre texto ya en minúsculas
 *   para limpiar el nombre de la actividad; sin `i` no casaría ninguno;
 * · **las tildes como alternativa** (`S[OÓ]TANO`, `[AÁ]REA`) —
 *   `typicalUnit.ts` los aplica sobre el nombre **sin normalizar**, porque
 *   necesita conservar las tildes del sistema («mampostería»). Sin la
 *   alternativa, «Pintura Sótano 1» y «Pintura Piso 1» acabarían en dos
 *   sistemas distintos.
 */
export const LOCATION_PATTERNS: LocationPattern[] = [
  {
    label: "Piso",
    // Una tarea que cruza dos niveles —«Piso 1 a 2»— es un tramo, igual que
    // un rango de ejes. Va delante del patrón de piso normal porque si no,
    // aquel cazaría el primer número y se comería el resto sin avisar.
    //
    // El número final se limita a dos dígitos y no puede ir seguido de «%»,
    // con o sin espacio delante: sin eso, «Piso 2 - 100% avance», «Piso 3 -
    // 2026 entrega» y «Piso 2 - 50 % avance» —basura de avances y fechas
    // pegada con guion— se leerían como un tramo real.
    regex: /\b(?:PISO|NIVEL|PLANTA)\s*[-#:]?\s*(\d+)\s*(?:-|\bA\b)\s*(\d{1,2})(?!\s*%)\b/i,
    valueOf: (match) => Number(match[1]),
    spanOf: (match) => {
      const from = Number(match[1]);
      const to = Number(match[2]);
      // Una transición sube de piso. Si no sube, no es una transición, y el
      // nombre debe caer al patrón de piso normal (sin tramo).
      if (!(to > from)) return null;
      return { rawFrom: match[1], rawTo: match[2], from, to };
    },
  },
  {
    label: "Piso",
    regex: /\b(?:PISO|NIVEL|PLANTA)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Etapa",
    regex: /\b(?:ETAPA|FASE)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Etapa",
    regex: /\b(?:ETAPA|FASE)\s*[-#:]?\s*([A-Z])\b/i,
    valueOf: letterToNumber,
  },
  {
    label: "Sótano",
    regex: /\bS[OÓ]TANO\s*[-#:]?\s*(\d+)\b/i,
    valueOf: (match) => -Number(match[1]),
  },
  {
    label: "Torre",
    regex: /\b(?:TORRE|BLOQUE)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Torre",
    // El `\b` del final no es adorno: sin él, «torregrúa» —diez tareas
    // reales del cronograma de la Estación 16— se leería como «Torre G».
    regex: /\b(?:TORRE|BLOQUE)\s*[-#:]?\s*([A-Z])\b/i,
    valueOf: letterToNumber,
  },
  { label: "Zona", regex: /\bZONA\s*[-#:]?\s*(\d+)\b/i, valueOf: numeric },
  { label: "Zona", regex: /\bZONA\s*[-#:]?\s*([A-Z])\b/i, valueOf: letterToNumber },
  { label: "Sector", regex: /\bSECTOR\s*[-#:]?\s*(\d+)\b/i, valueOf: numeric },
  { label: "Sector", regex: /\bSECTOR\s*[-#:]?\s*([A-Z])\b/i, valueOf: letterToNumber },
  {
    label: "Tramo",
    regex: /\b(?:TRAMO|FRENTE)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Tramo",
    regex: /\b(?:TRAMO|FRENTE)\s*[-#:]?\s*([A-Z])\b/i,
    valueOf: letterToNumber,
  },
  {
    label: "Lote",
    regex: /\b(?:LOTE|MANZANA)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Lote",
    regex: /\b(?:LOTE|MANZANA)\s*[-#:]?\s*([A-Z])\b/i,
    valueOf: letterToNumber,
  },
  {
    label: "Apartamento",
    // El sufijo de letra es nomenclatura de obra: el «302A» y el «302B» son
    // dos apartamentos del piso 3. Se guarda entero en `raw` y se ordena por
    // la parte numérica.
    regex: /\b(?:APARTAMENTO|APTO|UNIDAD)\s*[-#:]?\s*(\d+[A-Z]?)\b/i,
    valueOf: leadingNumber,
  },
  // ── Obra lineal ──────────────────────────────────────────────────────
  // Va DESPUÉS del vocabulario vertical a propósito. La spec decide que el
  // módulo gana al eje (D3), pero nunca decidió que el edificio ganara al
  // apartamento ni el módulo a la torre: «Edificio 2 - Apto 302» es un
  // apartamento, y colocarlo antes colapsaba decenas de filas de la Línea de
  // Balance en tres.
  {
    label: "Módulo",
    // Decimal a propósito: 1.1 y 1.2 son submódulos del módulo 1, y como
    // enteros se fundirían en uno.
    // La tilde va como alternativa, igual que en `S[OÓ]TANO`: estos patrones
    // se recorren también sobre el nombre sin normalizar, y el archivo real
    // escribe «Módulo».
    regex: /\bM[OÓ]DULO\s*[-#:]?\s*(\d+(?:\.\d+)?)\b/i,
    valueOf: (match) => Number(match[1]),
  },
  {
    label: "Edificio",
    regex: /\bEDIFICIO\s*[-#:]?\s*(\d+)\b/i,
    valueOf: (match) => Number(match[1]),
  },
  {
    label: "Eje",
    // Dos etiquetas alrededor del separador: un guion decorativo no basta.
    regex: /\bEJES?\b\s*[-#:]?\s*([A-Z]{0,3}\d{0,3}|[A-Z])\s*(?:-|\bA\b)\s*([A-Z]{0,3}\d{0,3}|[A-Z])\b/i,
    valueOf: (match) => parseAxisLabel(match[1])?.index ?? Number.NaN,
    spanOf: (match) => {
      const from = parseAxisLabel(match[1]);
      const to = parseAxisLabel(match[2]);
      if (!from || !to) return null;
      const span: LocationSpan = { rawFrom: from.raw, rawTo: to.raw, from: from.index, to: to.index };
      if (from.family !== to.family) span.crossesGrids = true;
      return span;
    },
  },
  {
    label: "Eje",
    regex: /\bEJES?\b\s*[-#:]?\s*([A-Z]{1,3}\d{1,3}|[A-Z]|\d{1,3})\b/i,
    valueOf: (match) => parseAxisLabel(match[1])?.index ?? Number.NaN,
  },
  { label: "Zona", regex: /\b[AÁ]REA\s*[A-Z]-(\d+)\b/i, valueOf: numeric },
  { label: "Zona", regex: /\b[AÁ]REA\s*[-#:]?\s*(\d+)\b/i, valueOf: numeric },
  {
    label: "Piso",
    regex: /\b(MEZ+ANINE)\b/i,
    valueOf: () => MEZZANINE_LOCATION_VALUE,
  },
  {
    label: "Piso",
    regex: /\b(CUBIERTA|AZOTEA|TERRAZA)\b/i,
    valueOf: () => ROOF_LOCATION_VALUE,
  },
  { label: "Piso", regex: /\bP(\d{2,})\b/i, valueOf: numeric },
  { label: "Sótano", regex: /\bS(\d{1,2})\b/i, valueOf: (m) => -Number(m[1]) },
  { label: "Piso", regex: /\bN-?(\d+)\b/i, valueOf: numeric },
];

/**
 * Cómo se nombra una ubicación en pantalla.
 *
 * Existe por dos motivos, y el segundo es de corrección, no de estética:
 *
 * · `value` es un número de dominio, y `900` (cubierta) no se puede enseñar
 *   tal cual: `TypicalUnitView.tsx:110` pinta el nivel literalmente;
 * · `raw` tampoco vale como identidad: «SÓTANO 3» y «PISO 3» dan los dos
 *   `"3"`, y Unidad Típica cuenta niveles distintos con un `Set` de esa
 *   etiqueta. Sin el prefijo, los dos colapsarían en uno y la vista perdería
 *   un nivel sin decirlo.
 */
export function formatLocationLabel(location: LocationMatch): string {
  if (location.value === ROOF_LOCATION_VALUE) return "Cubierta";
  if (location.value === MEZZANINE_LOCATION_VALUE) return "Mezanine";
  return `${location.label} ${location.raw}`;
}

export function extractLocation(text: string): LocationMatch | null {
  const normalized = normalizeName(text);
  for (const pattern of LOCATION_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const value = pattern.valueOf(match);
    if (!Number.isFinite(value)) continue;

    const span = pattern.spanOf?.(match) ?? undefined;
    const result: LocationMatch = {
      label: pattern.label,
      raw: match[1] ?? match[0],
      value,
    };
    if (span) result.span = span;
    return result;
  }
  return null;
}
