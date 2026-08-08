# P3 · Motor de detección — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el visor reconozca el piso y el sistema de cada tarea con los nombres que la obra escribe de verdad —sótanos incluidos, y ordenados por debajo del piso 1—, y que aprenda de las correcciones del usuario.

**Architecture:** Un módulo nuevo y aislado en `v2/src/lib/scheduling/detection/`, construido de abajo arriba: normalización → extracción de ubicación → similitud → diccionario → cascada → resolución por tarea → frontera de proveedor. Los tres consumidores existentes (`unitPatterns.ts`, `typicalUnit.ts`, `lob.ts`) se **cablean** al final, conservando sus firmas públicas para no romper a nadie. `activityFamily.ts` no se toca: pasa a ser el escalón automático de la cascada.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · Jest + Testing Library · Playwright (E2E) · Docker Compose.

Spec: [2026-08-07-motor-deteccion-design.md](../specs/2026-08-07-motor-deteccion-design.md) · Goal: [`goals/motor-deteccion/goal.md`](../../../goals/motor-deteccion/goal.md)

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Sin excepciones.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Comandos de verificación: `npx jest --runInBand`, `npx eslint <archivos>`, `npx tsc --noEmit`, `npx next build`.
- `npx tsc --noEmit` arrastra **38 errores preexistentes** en archivos `*.test.*` y `e2e/`. Filtrar siempre: `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`. Ese filtro debe salir **vacío**.
- Copy en **español con tildes**, en lenguaje de obra, sin jerga de infraestructura (ver `docs/POSITIONING.md`).
- **Prohibido tocar `src/components/views/GanttView.tsx` y `src/lib/state/ProjectContext.tsx`**: son del carril A. Si una tarea parece necesitarlos, está mal planteada — el motor recibe y devuelve datos, nunca los persiste.
- **Prohibido editar `src/lib/scheduling/activityFamily.ts` y sus tests.** Si alguno de sus tests se pone en rojo, se ha cambiado lo que no tocaba.
- Rama: `carril-b/motor-deteccion`, creada desde `main` antes de la Tarea 1.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/lib/scheduling/detection/normalize.ts` | `normalizeName`, `significantTokens`, `STOPWORDS` | 1 |
| `src/lib/scheduling/detection/location.ts` | `extractLocation` y su tabla de patrones ordenada | 2, 3 |
| `src/lib/scheduling/detection/similarity.ts` | `jaccardSimilarity`, `bestMatchByTokens`, umbral 0,33 | 4 |
| `src/lib/scheduling/detection/dictionary.ts` | Diccionario de correcciones del usuario | 5 |
| `src/lib/scheduling/detection/cascade.ts` | `resolveSystem`: diccionario → exacta → similitud → automática | 6 |
| `src/lib/scheduling/detection/taskLocation.ts` | `resolveTaskLocation`: nombre → padres → WBS → obra general | 7 |
| `src/lib/scheduling/detection/provider.ts` | `DetectionProvider` + implementación local (frontera para API futura) | 8 |
| `src/lib/scheduling/detection/coverage.ts` | `summarizeDetection`: el «195 de 239» como dato auditable | 9 |
| `src/lib/scheduling/detection/fixtures/daPorto.ts` | Vocabulario real del archivo de obra con su ubicación esperada | 10 |
| `src/lib/scheduling/detection/index.ts` | Superficie pública del módulo | 11 |
| `src/lib/scheduling/unitPatterns.ts` | `extractUnitLabel` delega en `extractLocation` (misma firma) | 12 |
| `src/lib/scheduling/typicalUnit.ts` | Ordena por número de nivel; deja de perder sótanos | 13 |
| `src/lib/scheduling/lob.ts` | `detectUnit` delega; `index` pasa a ser el número real | 14 |

---

# ENTREGA 1 — El motor (tareas 1-11)

Nada de esta entrega cambia lo que el usuario ve. Es código nuevo, aislado y probado, que la Entrega 2 enchufa.

## Task 1: Normalización de nombres de obra

**Files:**
- Create: `src/lib/scheduling/detection/normalize.ts`
- Test: `src/lib/scheduling/detection/normalize.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export const STOPWORDS: ReadonlySet<string>`
  - `export function normalizeName(raw: string): string`
  - `export function significantTokens(raw: string): string[]`

- [ ] **Step 1: Write the failing test**

```ts
import { normalizeName, significantTokens } from "./normalize";

describe("normalizeName", () => {
  test("quita tildes, sube a mayúsculas y colapsa espacios", () => {
    expect(normalizeName("  Mampostería   Sótano 3 ")).toBe("MAMPOSTERIA SOTANO 3");
  });

  test("la eñe se convierte en ene, como en el motor de PDC", () => {
    expect(normalizeName("Ventanería")).toBe("VENTANERIA");
  });

  test("el mismo nombre escrito con y sin tilde normaliza igual", () => {
    expect(normalizeName("SÓTANO 2")).toBe(normalizeName("SOTANO 2"));
  });
});

describe("significantTokens", () => {
  test("descarta las palabras de dos letras o menos", () => {
    expect(significantTokens("URBANISMO Y OBRAS EXTERIORES")).toEqual([
      "URBANISMO",
      "OBRAS",
      "EXTERIORES",
    ]);
  });

  test("descarta las palabras vacías de la lista", () => {
    expect(significantTokens("PISOS Y ENCHAPES DE LAS ZONAS")).toEqual([
      "PISOS",
      "ENCHAPES",
      "ZONAS",
    ]);
  });

  test("quita la puntuación y no repite palabras", () => {
    expect(significantTokens("REVOQUES, ESTUCO Y PINTURA. PINTURA")).toEqual([
      "REVOQUES",
      "ESTUCO",
      "PINTURA",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/normalize.test.ts`
Expected: FAIL — `Cannot find module './normalize' from 'src/lib/scheduling/detection/normalize.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Normalización compartida por todo el motor de detección.
 *
 * Es el puerto de `MaestroInsumosService::normalizar` de PDC V2 (`lps-aia`):
 * mayúsculas, sin tildes, sin espacios de más. Presupuesto y cronograma
 * escriben el mismo oficio de cinco maneras distintas; sin este paso, la
 * comparación mide ortografía en vez de significado.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Palabras que no distinguen un oficio de otro. Las de una o dos letras
 * («Y», «DE», «EN») se filtran por longitud; estas son las que sobreviven
 * a ese filtro. Copiadas de `AmarreCronogramaService::VACIAS`.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "DEL",
  "LOS",
  "LAS",
  "CON",
  "PARA",
  "POR",
  "SIN",
  "SUS",
  "QUE",
]);

export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palabras significativas de un nombre: sin puntuación, sin partículas y
 * sin repetidos. Es la unidad de medida de la similitud de Jaccard.
 */
export function significantTokens(raw: string): string[] {
  const words = normalizeName(raw)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return [...new Set(words)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/normalize.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/normalize.ts src/lib/scheduling/detection/normalize.test.ts
git commit -m "feat(deteccion): normalizacion de nombres de obra portada de PDC V2"
```

---

## Task 2: Ubicación — pisos, niveles, etapas y **sótanos como negativos**

Es el corazón del proyecto: el patrón que hoy falta y que explica la mayoría de las 44 tareas sin resolver.

**Files:**
- Create: `src/lib/scheduling/detection/location.ts`
- Test: `src/lib/scheduling/detection/location.test.ts`

**Interfaces:**
- Consumes: `normalizeName` de la Tarea 1.
- Produces:
  - `export interface LocationMatch { label: string; raw: string; value: number }`
  - `export interface LocationPattern { label: string; regex: RegExp; valueOf: (match: RegExpMatchArray) => number }`
  - `export const LOCATION_PATTERNS: LocationPattern[]`
  - `export function extractLocation(text: string): LocationMatch | null`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: FAIL — `Cannot find module './location' from 'src/lib/scheduling/detection/location.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
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
}

export interface LocationPattern {
  label: string;
  regex: RegExp;
  valueOf: (match: RegExpMatchArray) => number;
}

const numeric = (match: RegExpMatchArray): number => Number(match[1]);

/**
 * Patrones en orden de prioridad: gana el primero que acierta.
 *
 * Todos llevan la bandera `i` aunque `extractLocation` ya normalice a
 * mayúsculas: `lob.ts` los reutiliza tal cual sobre texto ya en minúsculas
 * para limpiar el nombre de la actividad. Sin `i`, ahí no casaría ninguno.
 */
export const LOCATION_PATTERNS: LocationPattern[] = [
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
    label: "Sótano",
    regex: /\bSOTANO\s*[-#:]?\s*(\d+)\b/i,
    valueOf: (match) => -Number(match[1]),
  },
];

export function extractLocation(text: string): LocationMatch | null {
  const normalized = normalizeName(text);
  for (const pattern of LOCATION_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const value = pattern.valueOf(match);
    if (!Number.isFinite(value)) continue;
    return { label: pattern.label, raw: match[1] ?? match[0], value };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/location.ts src/lib/scheduling/detection/location.test.ts
git commit -m "feat(deteccion): extraer piso, nivel, etapa y sotano como numero ordenable"
```

---

## Task 3: Ubicación — torres, zonas, códigos `P01`/`S1`, mezanine y cubierta

**Files:**
- Modify: `src/lib/scheduling/detection/location.ts` (array `LOCATION_PATTERNS`)
- Modify: `src/lib/scheduling/detection/location.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `LOCATION_PATTERNS`, `extractLocation` de la Tarea 2.
- Produces: `export const ROOF_LOCATION_VALUE = 900` y `export const MEZZANINE_LOCATION_VALUE = 0.5`. `LOCATION_PATTERNS` pasa de 3 a 13 entradas; `extractLocation` no cambia de firma.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/scheduling/detection/location.test.ts`:

```ts
import {
  extractLocation as extract,
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

  test("el piso escrito con palabra gana a un código que aparezca después", () => {
    expect(extract("MAMPOSTERÍA PISO 4 PLANO S2")?.value).toBe(4);
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
```

Recordatorio: este bloque necesita `LOCATION_PATTERNS` en el `import` de arriba, junto a
`MEZZANINE_LOCATION_VALUE` y `ROOF_LOCATION_VALUE`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: FAIL — `location.ts` no exporta `ROOF_LOCATION_VALUE` ni `MEZZANINE_LOCATION_VALUE`, y los casos de torre/zona/cubierta devuelven `null`.

- [ ] **Step 3: Write minimal implementation**

Reemplazar el bloque `LOCATION_PATTERNS` de `location.ts` por:

```ts
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
    regex: /\b(?:PISO|NIVEL|PLANTA)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Etapa",
    regex: /\b(?:ETAPA|FASE)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
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
    regex: /\b(?:TORRE|BLOQUE)\s*[-#:]?\s*([A-Z])\b/i,
    valueOf: letterToNumber,
  },
  { label: "Zona", regex: /\bZONA\s*[-#:]?\s*(\d+)\b/i, valueOf: numeric },
  { label: "Sector", regex: /\bSECTOR\s*[-#:]?\s*(\d+)\b/i, valueOf: numeric },
  {
    label: "Tramo",
    regex: /\b(?:TRAMO|FRENTE)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Lote",
    regex: /\b(?:LOTE|MANZANA)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Apartamento",
    regex: /\b(?:APARTAMENTO|APTO|UNIDAD)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  { label: "Zona", regex: /\b[AÁ]REA\s*[A-Z]-(\d+)\b/i, valueOf: numeric },
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
```

Nota para quien implemente: `MEZANINE` y `CUBIERTA` capturan la **palabra** en el grupo 1, de modo que `raw` sale `"MEZANINE"` / `"CUBIERTA"` sin tocar `extractLocation`. `MEZ+ANINE` cubre las dos grafías que se ven en obra (`MEZANINE`, `MEZZANINE`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: PASS (17 tests — los 6 de la Tarea 2 más los 11 nuevos)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/location.ts src/lib/scheduling/detection/location.test.ts
git commit -m "feat(deteccion): torres, zonas, codigos P01/S1, mezanine y cubierta"
```

---

## Task 4: Similitud de palabras (Jaccard, umbral 0,33)

**Files:**
- Create: `src/lib/scheduling/detection/similarity.ts`
- Test: `src/lib/scheduling/detection/similarity.test.ts`

**Interfaces:**
- Consumes: `significantTokens` de la Tarea 1.
- Produces:
  - `export const SIMILARITY_THRESHOLD = 0.33`
  - `export function jaccardSimilarity(a: string, b: string): number`
  - `export function bestMatchByTokens<T>(name: string, candidates: T[], getName: (candidate: T) => string, threshold?: number): { candidate: T; score: number } | null`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/similarity.test.ts`
Expected: FAIL — `Cannot find module './similarity' from 'src/lib/scheduling/detection/similarity.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { significantTokens } from "./normalize";

/**
 * Similitud mínima de nombre (Jaccard sobre palabras) para dar un
 * emparejamiento por bueno.
 *
 * Es el mismo 0,33 de `AmarreCronogramaService::SIMILITUD_MINIMA` de PDC V2,
 * y a propósito: con este valor «URBANISMO Y OBRAS EXTERIORES» (3 palabras)
 * alcanza «URBANISMO» (1 palabra) con 1/3 = 0,3333, que es el caso límite
 * que el umbral tiene que dejar pasar.
 */
export const SIMILARITY_THRESHOLD = 0.33;

export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const common = tokensA.filter((token) => setB.has(token)).length;
  if (common === 0) return 0;

  const union = new Set([...tokensA, ...tokensB]).size;
  return common / union;
}

/**
 * Candidato más parecido por palabras. Empate: gana el primero de la lista,
 * porque el orden que llega ya es el orden del cronograma.
 */
export function bestMatchByTokens<T>(
  name: string,
  candidates: T[],
  getName: (candidate: T) => string,
  threshold: number = SIMILARITY_THRESHOLD,
): { candidate: T; score: number } | null {
  let best: { candidate: T; score: number } | null = null;

  for (const candidate of candidates) {
    const score = jaccardSimilarity(name, getName(candidate));
    if (score > (best?.score ?? 0)) {
      best = { candidate, score };
    }
  }

  return best && best.score >= threshold ? best : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/similarity.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/similarity.ts src/lib/scheduling/detection/similarity.test.ts
git commit -m "feat(deteccion): similitud de palabras con el umbral 0,33 de PDC V2"
```

---

## Task 5: Diccionario que se llena con las correcciones del usuario

**Files:**
- Create: `src/lib/scheduling/detection/dictionary.ts`
- Test: `src/lib/scheduling/detection/dictionary.test.ts`

**Interfaces:**
- Consumes: `normalizeName` de la Tarea 1.
- Produces:
  - `export type DetectionKind = "ubicacion" | "sistema"`
  - `export interface DetectionCorrection { kind: DetectionKind; key: string; value: string; note: string; recordedAt: string }`
  - `export interface DetectionDictionary { corrections: DetectionCorrection[] }`
  - `export const EMPTY_DETECTION_DICTIONARY: DetectionDictionary`
  - `export function lookupCorrection(dictionary: DetectionDictionary | undefined, kind: DetectionKind, name: string): DetectionCorrection | undefined`
  - `export function rememberCorrection(dictionary: DetectionDictionary | undefined, input: { kind: DetectionKind; name: string; value: string; note: string; recordedAt: string }): DetectionDictionary`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/dictionary.test.ts`
Expected: FAIL — `Cannot find module './dictionary' from 'src/lib/scheduling/detection/dictionary.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { normalizeName } from "./normalize";

/**
 * Lo que el usuario corrige a mano, guardado para que el motor no vuelva a
 * equivocarse igual.
 *
 * Va **antes** que lo automático, no como último recurso. La razón está
 * medida en PDC V2: sobre 820 filas reales el emparejamiento por nombre
 * acierta una, y el texto engaña con seguridad — «carpintería metálica» se
 * parece a «carpintería en madera» y no son lo mismo. Una corrección humana
 * no se equivoca por parecido.
 *
 * El motor no sabe dónde se guarda esto: lo recibe y devuelve uno nuevo. Así
 * la persistencia vive fuera y este módulo se puede probar entero sin estado.
 */
export type DetectionKind = "ubicacion" | "sistema";

export interface DetectionCorrection {
  kind: DetectionKind;
  /** Nombre normalizado sobre el que se busca. */
  key: string;
  value: string;
  /** Por qué se corrigió. Sin esto, en seis meses nadie sabe si sigue haciendo falta. */
  note: string;
  recordedAt: string;
}

export interface DetectionDictionary {
  corrections: DetectionCorrection[];
}

export const EMPTY_DETECTION_DICTIONARY: DetectionDictionary = { corrections: [] };

export function lookupCorrection(
  dictionary: DetectionDictionary | undefined,
  kind: DetectionKind,
  name: string,
): DetectionCorrection | undefined {
  if (!dictionary) return undefined;
  const key = normalizeName(name);
  return dictionary.corrections.find(
    (correction) => correction.kind === kind && correction.key === key,
  );
}

export function rememberCorrection(
  dictionary: DetectionDictionary | undefined,
  input: {
    kind: DetectionKind;
    name: string;
    value: string;
    note: string;
    recordedAt: string;
  },
): DetectionDictionary {
  const correction: DetectionCorrection = {
    kind: input.kind,
    key: normalizeName(input.name),
    value: input.value,
    note: input.note,
    recordedAt: input.recordedAt,
  };

  const rest = (dictionary?.corrections ?? []).filter(
    (item) => !(item.kind === correction.kind && item.key === correction.key),
  );

  return { corrections: [...rest, correction] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/dictionary.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/dictionary.ts src/lib/scheduling/detection/dictionary.test.ts
git commit -m "feat(deteccion): diccionario de correcciones del usuario, probado antes que lo automatico"
```

---

## Task 6: La cascada — diccionario → exacta → similitud → automática

**Files:**
- Create: `src/lib/scheduling/detection/cascade.ts`
- Test: `src/lib/scheduling/detection/cascade.test.ts`

**Interfaces:**
- Consumes: `normalizeName` (T1), `bestMatchByTokens` (T4), `lookupCorrection` y `DetectionDictionary` (T5).
- Produces:
  - `export type DetectionOrigin = "diccionario" | "exacta" | "similitud" | "automatica" | "sin_resolver"`
  - `export interface SystemResolution { system: string | null; origin: DetectionOrigin; score?: number; evidence: string }`
  - `export function resolveSystem(input: { name: string; candidates: string[]; dictionary?: DetectionDictionary; automatic?: () => string | null }): SystemResolution`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/cascade.test.ts`
Expected: FAIL — `Cannot find module './cascade' from 'src/lib/scheduling/detection/cascade.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { normalizeName } from "./normalize";
import { bestMatchByTokens } from "./similarity";
import { lookupCorrection, type DetectionDictionary } from "./dictionary";

/**
 * De dónde salió una resolución. Se guarda con el resultado porque un motor
 * que no explica por qué acertó tampoco se puede auditar cuando falla.
 */
export type DetectionOrigin =
  | "diccionario"
  | "exacta"
  | "similitud"
  | "automatica"
  | "sin_resolver";

export interface SystemResolution {
  system: string | null;
  origin: DetectionOrigin;
  /** Puntuación de similitud, solo cuando el origen es «similitud». */
  score?: number;
  /** Frase en lenguaje de obra que explica la decisión. */
  evidence: string;
}

/**
 * Cascada portada de `AmarreCronogramaService::resolverCodigo` de PDC V2:
 * gana el primero que acierta, de lo más específico a lo más general.
 */
export function resolveSystem({
  name,
  candidates,
  dictionary,
  automatic,
}: {
  name: string;
  candidates: string[];
  dictionary?: DetectionDictionary;
  automatic?: () => string | null;
}): SystemResolution {
  const correction = lookupCorrection(dictionary, "sistema", name);
  if (correction) {
    return {
      system: correction.value,
      origin: "diccionario",
      evidence: `«${name}» se asigna a «${correction.value}» por una corrección guardada: ${correction.note}`,
    };
  }

  const normalized = normalizeName(name);
  const exact = candidates.find(
    (candidate) => normalizeName(candidate) === normalized,
  );
  if (exact) {
    return {
      system: exact,
      origin: "exacta",
      evidence: `«${name}» se llama igual que «${exact}».`,
    };
  }

  const similar = bestMatchByTokens(name, candidates, (candidate) => candidate);
  if (similar) {
    return {
      system: similar.candidate,
      origin: "similitud",
      score: similar.score,
      evidence: `«${name}» se parece a «${similar.candidate}» (${Math.round(similar.score * 100)} % de palabras en común).`,
    };
  }

  const automaticSystem = automatic?.() ?? null;
  if (automaticSystem) {
    return {
      system: automaticSystem,
      origin: "automatica",
      evidence: `«${name}» se clasificó como «${automaticSystem}» por las reglas de oficio.`,
    };
  }

  return {
    system: null,
    origin: "sin_resolver",
    evidence: `No se pudo asignar sistema a «${name}»: se probó el diccionario de correcciones, el nombre exacto, la similitud de palabras y las reglas de oficio.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/cascade.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/cascade.ts src/lib/scheduling/detection/cascade.test.ts
git commit -m "feat(deteccion): cascada diccionario, exacta, similitud y automatica con evidencia"
```

---

## Task 7: Ubicación de una tarea — nombre, padres, WBS, obra general

**Files:**
- Create: `src/lib/scheduling/detection/taskLocation.ts`
- Test: `src/lib/scheduling/detection/taskLocation.test.ts`

**Interfaces:**
- Consumes: `extractLocation` y `LocationMatch` (T2/T3), `lookupCorrection` y `DetectionDictionary` (T5), `buildWbsBreadcrumb` de `@/lib/scheduling/unitPatterns`, `GanttTask` de `@/components/gantt/types`.
- Produces:
  - `export type TaskLocationScope = "propia" | "heredada" | "wbs" | "diccionario" | "obraGeneral"`
  - `export interface TaskLocationResult { location: LocationMatch | null; scope: TaskLocationScope; evidence: string }`
  - `export function resolveTaskLocation(task: GanttTask, tasks: GanttTask[], dictionary?: DetectionDictionary): TaskLocationResult`

- [ ] **Step 1: Write the failing test**

```ts
import { resolveTaskLocation } from "./taskLocation";
import { EMPTY_DETECTION_DICTIONARY, rememberCorrection } from "./dictionary";
import type { GanttTask } from "@/components/gantt/types";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: "Actividad",
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-09T17:00:00"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("resolveTaskLocation", () => {
  test("el nombre propio manda", () => {
    const hoja = task({ id: 1, name: "COLUMNAS SÓTANO 3", wbs: "2.1" });
    const result = resolveTaskLocation(hoja, [hoja]);

    expect(result.location?.value).toBe(-3);
    expect(result.scope).toBe("propia");
  });

  test("si la tarea no lo dice, lo hereda de la tarea padre", () => {
    // Estructura real de DA PORTO: ACABADOS › MAMPOSTERÍA › SÓTANO 2 › la hoja
    const acabados = task({ id: 1, name: "ACABADOS", wbs: "3", isSummary: true });
    const mamposteria = task({ id: 2, name: "MAMPOSTERÍA", wbs: "3.1", isSummary: true });
    const sotano = task({ id: 3, name: "SOTANO 2", wbs: "3.1.3", isSummary: true });
    const hoja = task({ id: 4, name: "MURO EN LADRILLO", wbs: "3.1.3.1" });

    const result = resolveTaskLocation(hoja, [acabados, mamposteria, sotano, hoja]);

    expect(result.location?.value).toBe(-2);
    expect(result.location?.label).toBe("Sótano");
    expect(result.scope).toBe("heredada");
    expect(result.evidence).toContain("SOTANO 2");
  });

  test("hereda del padre más cercano, no del abuelo", () => {
    const torre = task({ id: 1, name: "TORRE 3", wbs: "1", isSummary: true });
    const piso = task({ id: 2, name: "PISO 7", wbs: "1.2", isSummary: true });
    const hoja = task({ id: 3, name: "REVOQUE TRADICIONAL", wbs: "1.2.1" });

    const result = resolveTaskLocation(hoja, [torre, piso, hoja]);

    expect(result.location).toEqual({ label: "Piso", raw: "7", value: 7 });
  });

  test("lo que no tiene ubicación por piso se marca como obra general, no se descarta", () => {
    const hoja = task({ id: 1, name: "VÍAS INTERNAS", wbs: "5.1" });
    const result = resolveTaskLocation(hoja, [hoja]);

    expect(result.location).toBeNull();
    expect(result.scope).toBe("obraGeneral");
    expect(result.evidence).toContain("obra general");
  });

  test("una corrección guardada gana a todo lo demás", () => {
    const dictionary = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "ubicacion",
      name: "CUARTO DE MÁQUINAS",
      value: "-1",
      note: "El cuarto de máquinas está en el sótano 1.",
      recordedAt: "2026-08-07T10:00:00.000Z",
    });
    const hoja = task({ id: 1, name: "CUARTO DE MÁQUINAS", wbs: "2.9" });

    const result = resolveTaskLocation(hoja, [hoja], dictionary);

    expect(result.location?.value).toBe(-1);
    expect(result.scope).toBe("diccionario");
    expect(result.evidence).toContain("sótano 1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/taskLocation.test.ts`
Expected: FAIL — `Cannot find module './taskLocation' from 'src/lib/scheduling/detection/taskLocation.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GanttTask } from "@/components/gantt/types";
import { buildWbsBreadcrumb } from "@/lib/scheduling/unitPatterns";
import { extractLocation, type LocationMatch } from "./location";
import { lookupCorrection, type DetectionDictionary } from "./dictionary";

/**
 * De dónde salió la ubicación de una tarea.
 *
 * `obraGeneral` no es un fallo: hay trabajo que no pertenece a ningún piso
 * —vías internas, redes externas, engramado— y decirlo es más útil que
 * descartarlo en silencio, que es lo que se hacía antes.
 */
export type TaskLocationScope =
  | "propia"
  | "heredada"
  | "wbs"
  | "diccionario"
  | "obraGeneral";

export interface TaskLocationResult {
  location: LocationMatch | null;
  scope: TaskLocationScope;
  evidence: string;
}

export function resolveTaskLocation(
  task: GanttTask,
  tasks: GanttTask[],
  dictionary?: DetectionDictionary,
): TaskLocationResult {
  const correction = lookupCorrection(dictionary, "ubicacion", task.name);
  if (correction) {
    const value = Number(correction.value);
    if (Number.isFinite(value)) {
      return {
        location: {
          label: value < 0 ? "Sótano" : "Piso",
          raw: correction.value,
          value,
        },
        scope: "diccionario",
        evidence: `«${task.name}» se ubica por una corrección guardada: ${correction.note}`,
      };
    }
  }

  const own = extractLocation(task.name);
  if (own) {
    return {
      location: own,
      scope: "propia",
      evidence: `«${task.name}» dice su ubicación: ${own.label} ${own.raw}.`,
    };
  }

  const breadcrumb = buildWbsBreadcrumb(task.wbs, tasks);
  for (let level = breadcrumb.length - 1; level >= 0; level -= 1) {
    const inherited = extractLocation(breadcrumb[level]);
    if (inherited) {
      return {
        location: inherited,
        scope: "heredada",
        evidence: `«${task.name}» hereda la ubicación de «${breadcrumb[level]}»: ${inherited.label} ${inherited.raw}.`,
      };
    }
  }

  const fromWbs = task.wbs ? extractLocation(task.wbs) : null;
  if (fromWbs) {
    return {
      location: fromWbs,
      scope: "wbs",
      evidence: `«${task.name}» toma la ubicación de su código ${task.wbs}: ${fromWbs.label} ${fromWbs.raw}.`,
    };
  }

  return {
    location: null,
    scope: "obraGeneral",
    evidence: `«${task.name}» no menciona piso, sótano ni zona: se trata como obra general.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/taskLocation.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/taskLocation.ts src/lib/scheduling/detection/taskLocation.test.ts
git commit -m "feat(deteccion): ubicacion por nombre, tarea padre, WBS u obra general"
```

---

## Task 8: Frontera de proveedor (preparada para una API futura)

**Files:**
- Create: `src/lib/scheduling/detection/provider.ts`
- Test: `src/lib/scheduling/detection/provider.test.ts`

**Interfaces:**
- Consumes: `resolveTaskLocation` y `TaskLocationResult` (T7), `resolveSystem` y `SystemResolution` (T6), `DetectionDictionary` (T5), `GanttTask`.
- Produces:
  - `export interface DetectionProvider { readonly id: string; locationOf(...): TaskLocationResult; systemOf(...): SystemResolution }`
  - `export const localDetectionProvider: DetectionProvider`
  - `export function getDetectionProvider(): DetectionProvider`
  - `export function setDetectionProvider(provider: DetectionProvider): void`

- [ ] **Step 1: Write the failing test**

```ts
import {
  getDetectionProvider,
  localDetectionProvider,
  setDetectionProvider,
  type DetectionProvider,
} from "./provider";
import type { GanttTask } from "@/components/gantt/types";

const tarea: GanttTask = {
  id: 1,
  name: "COLUMNAS SÓTANO 2",
  start: new Date("2026-01-05T08:00:00"),
  finish: new Date("2026-01-09T17:00:00"),
  duration: 5,
  progress: 0,
  isCritical: false,
  isMilestone: false,
  isSummary: false,
  outlineLevel: 1,
  dependencies: [],
};

describe("DetectionProvider", () => {
  afterEach(() => setDetectionProvider(localDetectionProvider));

  test("por defecto el motor es el local", () => {
    expect(getDetectionProvider().id).toBe("local");
  });

  test("el proveedor local resuelve ubicación y sistema", () => {
    const provider = getDetectionProvider();

    expect(provider.locationOf(tarea, [tarea]).location?.value).toBe(-2);
    expect(
      provider.systemOf({ name: "Urbanismo", candidates: ["URBANISMO"] }).origin,
    ).toBe("exacta");
  });

  test("se puede sustituir por otro sin que el consumidor cambie", () => {
    const remoto: DetectionProvider = {
      id: "prueba",
      locationOf: () => ({
        location: { label: "Piso", raw: "99", value: 99 },
        scope: "propia",
        evidence: "Respuesta del servicio de prueba.",
      }),
      systemOf: () => ({
        system: "Estructura",
        origin: "automatica",
        evidence: "Respuesta del servicio de prueba.",
      }),
    };

    setDetectionProvider(remoto);

    expect(getDetectionProvider().id).toBe("prueba");
    expect(getDetectionProvider().locationOf(tarea, [tarea]).location?.value).toBe(99);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/provider.test.ts`
Expected: FAIL — `Cannot find module './provider' from 'src/lib/scheduling/detection/provider.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GanttTask } from "@/components/gantt/types";
import type { DetectionDictionary } from "./dictionary";
import { resolveSystem, type SystemResolution } from "./cascade";
import { resolveTaskLocation, type TaskLocationResult } from "./taskLocation";

/**
 * Frontera del motor de detección.
 *
 * El grilleo decidió portar el motor a TypeScript «dejando preparada la
 * opción de llamarlo por API más adelante». Esto es esa preparación: todo el
 * producto consume la interfaz, nunca las funciones sueltas, así que el día
 * que exista un servicio solo hay que escribir otra implementación.
 *
 * No se escribe aquí ningún cliente HTTP: sin servicio desplegado sería
 * código que nadie puede probar.
 */
export interface DetectionProvider {
  readonly id: string;
  locationOf(
    task: GanttTask,
    tasks: GanttTask[],
    dictionary?: DetectionDictionary,
  ): TaskLocationResult;
  systemOf(input: {
    name: string;
    candidates: string[];
    dictionary?: DetectionDictionary;
    automatic?: () => string | null;
  }): SystemResolution;
}

export const localDetectionProvider: DetectionProvider = {
  id: "local",
  locationOf: (task, tasks, dictionary) =>
    resolveTaskLocation(task, tasks, dictionary),
  systemOf: (input) => resolveSystem(input),
};

let activeProvider: DetectionProvider = localDetectionProvider;

export function getDetectionProvider(): DetectionProvider {
  return activeProvider;
}

export function setDetectionProvider(provider: DetectionProvider): void {
  activeProvider = provider;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/provider.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/provider.ts src/lib/scheduling/detection/provider.test.ts
git commit -m "feat(deteccion): frontera de proveedor lista para una API futura"
```

---

## Task 9: Cobertura — el «195 de 239» como dato auditable

**Files:**
- Create: `src/lib/scheduling/detection/coverage.ts`
- Test: `src/lib/scheduling/detection/coverage.test.ts`

**Interfaces:**
- Consumes: `getDetectionProvider` (T8), `TaskLocationScope` (T7), `DetectionDictionary` (T5), `GanttTask`.
- Produces:
  - `export interface DetectionCoverage { total: number; withLocation: number; generalWork: number; byScope: Record<TaskLocationScope, number> }`
  - `export function summarizeDetection(tasks: GanttTask[], dictionary?: DetectionDictionary): DetectionCoverage`
  - `export function describeCoverage(coverage: DetectionCoverage): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describeCoverage, summarizeDetection } from "./coverage";
import type { GanttTask } from "@/components/gantt/types";

function task(id: number, name: string, wbs?: string, isSummary = false): GanttTask {
  return {
    id,
    name,
    wbs,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-09T17:00:00"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary,
    outlineLevel: 1,
    dependencies: [],
  };
}

describe("summarizeDetection", () => {
  const tareas = [
    task(1, "LOSA AÉREA PISO 1", "1.1"),
    task(2, "COLUMNAS SÓTANO 2", "1.2"),
    task(3, "SOTANO 1", "2.1", true),
    task(4, "MURO EN LADRILLO", "2.1.1"),
    task(5, "VÍAS INTERNAS", "3.1"),
    task(6, "SKATE PARK", "3.2"),
  ];

  test("cuenta cuántas tareas tienen ubicación y cuántas son obra general", () => {
    const coverage = summarizeDetection(tareas);

    expect(coverage.total).toBe(6);
    expect(coverage.withLocation).toBe(4);
    expect(coverage.generalWork).toBe(2);
  });

  test("desglosa de dónde salió cada ubicación", () => {
    const coverage = summarizeDetection(tareas);

    expect(coverage.byScope.propia).toBe(3);
    expect(coverage.byScope.heredada).toBe(1);
    expect(coverage.byScope.obraGeneral).toBe(2);
    expect(coverage.byScope.diccionario).toBe(0);
  });

  test("lo describe en lenguaje de obra", () => {
    expect(describeCoverage(summarizeDetection(tareas))).toBe(
      "4 de 6 tareas tienen ubicación detectada. 2 son obra general, sin piso asignado.",
    );
  });

  test("sin tareas no inventa una cobertura del 100 %", () => {
    const coverage = summarizeDetection([]);

    expect(coverage.total).toBe(0);
    expect(coverage.withLocation).toBe(0);
    expect(describeCoverage(coverage)).toBe("Aún no hay tareas que analizar.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/coverage.test.ts`
Expected: FAIL — `Cannot find module './coverage' from 'src/lib/scheduling/detection/coverage.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GanttTask } from "@/components/gantt/types";
import type { DetectionDictionary } from "./dictionary";
import { getDetectionProvider } from "./provider";
import type { TaskLocationScope } from "./taskLocation";

/**
 * Lo que la Línea de Balance enseña como «195 de 239 tareas tienen ubicación
 * detectada», convertido en dato para que cualquier vista lo muestre igual y
 * para poder auditar cuánto está sosteniendo el diccionario.
 */
export interface DetectionCoverage {
  total: number;
  withLocation: number;
  generalWork: number;
  byScope: Record<TaskLocationScope, number>;
}

const EMPTY_BY_SCOPE: Record<TaskLocationScope, number> = {
  propia: 0,
  heredada: 0,
  wbs: 0,
  diccionario: 0,
  obraGeneral: 0,
};

export function summarizeDetection(
  tasks: GanttTask[],
  dictionary?: DetectionDictionary,
): DetectionCoverage {
  const provider = getDetectionProvider();
  const byScope: Record<TaskLocationScope, number> = { ...EMPTY_BY_SCOPE };
  let withLocation = 0;

  for (const task of tasks) {
    const result = provider.locationOf(task, tasks, dictionary);
    byScope[result.scope] += 1;
    if (result.location) withLocation += 1;
  }

  return {
    total: tasks.length,
    withLocation,
    generalWork: byScope.obraGeneral,
    byScope,
  };
}

export function describeCoverage(coverage: DetectionCoverage): string {
  if (coverage.total === 0) return "Aún no hay tareas que analizar.";
  return (
    `${coverage.withLocation} de ${coverage.total} tareas tienen ubicación detectada. ` +
    `${coverage.generalWork} son obra general, sin piso asignado.`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/coverage.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/coverage.ts src/lib/scheduling/detection/coverage.test.ts
git commit -m "feat(deteccion): resumen de cobertura de deteccion en lenguaje de obra"
```

---

## Task 10: El archivo de obra real como fixture

Es la tarea que impide que este proyecto se autoengañe. Los nombres salen del `.mpp` real
(`aia-ms-project/20260312 DA PORTO TORRE 3.mpp`), no de la imaginación de quien escribe el test.

**Files:**
- Create: `src/lib/scheduling/detection/fixtures/daPorto.ts`
- Test: `src/lib/scheduling/detection/fixtures/daPorto.test.ts`

**Interfaces:**
- Consumes: `extractLocation` (T2/T3), `ROOF_LOCATION_VALUE` (T3).
- Produces:
  - `export interface DaPortoCase { name: string; expected: number | null }`
  - `export const DA_PORTO_NAMES: DaPortoCase[]`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/fixtures/daPorto.test.ts`
Expected: FAIL — `Cannot find module './daPorto' from 'src/lib/scheduling/detection/fixtures/daPorto.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

Aviso para quien implemente: si algún caso falla, **el error está en el patrón, no en el fixture**. Estos nombres son los del archivo real; cambiarlos para que el test pase es falsificar la medición.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/fixtures/daPorto.test.ts`
Expected: PASS (los ~77 casos de `test.each` más 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/fixtures/daPorto.ts src/lib/scheduling/detection/fixtures/daPorto.test.ts
git commit -m "test(deteccion): fijar el vocabulario real de DA PORTO como fixture de cobertura"
```

---

## Task 11: Superficie pública del módulo

**Files:**
- Create: `src/lib/scheduling/detection/index.ts`
- Test: `src/lib/scheduling/detection/index.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: reexporta `normalizeName`, `significantTokens`, `extractLocation`, `LOCATION_PATTERNS`, `ROOF_LOCATION_VALUE`, `MEZZANINE_LOCATION_VALUE`, `jaccardSimilarity`, `bestMatchByTokens`, `SIMILARITY_THRESHOLD`, `lookupCorrection`, `rememberCorrection`, `EMPTY_DETECTION_DICTIONARY`, `resolveSystem`, `resolveTaskLocation`, `getDetectionProvider`, `setDetectionProvider`, `localDetectionProvider`, `summarizeDetection`, `describeCoverage` y sus tipos.

- [ ] **Step 1: Write the failing test**

```ts
import * as detection from "./index";

describe("superficie pública del motor de detección", () => {
  test("expone las piezas que los consumidores necesitan", () => {
    expect(typeof detection.extractLocation).toBe("function");
    expect(typeof detection.resolveTaskLocation).toBe("function");
    expect(typeof detection.resolveSystem).toBe("function");
    expect(typeof detection.summarizeDetection).toBe("function");
    expect(typeof detection.rememberCorrection).toBe("function");
    expect(detection.getDetectionProvider().id).toBe("local");
  });

  test("no expone el fixture de pruebas al producto", () => {
    expect("DA_PORTO_NAMES" in detection).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/index.test.ts`
Expected: FAIL — `Cannot find module './index' from 'src/lib/scheduling/detection/index.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
export { normalizeName, significantTokens, STOPWORDS } from "./normalize";
export {
  extractLocation,
  LOCATION_PATTERNS,
  MEZZANINE_LOCATION_VALUE,
  ROOF_LOCATION_VALUE,
  type LocationMatch,
  type LocationPattern,
} from "./location";
export {
  SIMILARITY_THRESHOLD,
  bestMatchByTokens,
  jaccardSimilarity,
} from "./similarity";
export {
  EMPTY_DETECTION_DICTIONARY,
  lookupCorrection,
  rememberCorrection,
  type DetectionCorrection,
  type DetectionDictionary,
  type DetectionKind,
} from "./dictionary";
export {
  resolveSystem,
  type DetectionOrigin,
  type SystemResolution,
} from "./cascade";
export {
  resolveTaskLocation,
  type TaskLocationResult,
  type TaskLocationScope,
} from "./taskLocation";
export {
  getDetectionProvider,
  localDetectionProvider,
  setDetectionProvider,
  type DetectionProvider,
} from "./provider";
export {
  describeCoverage,
  summarizeDetection,
  type DetectionCoverage,
} from "./coverage";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection`
Expected: PASS — toda la carpeta en verde

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/index.ts src/lib/scheduling/detection/index.test.ts
git commit -m "feat(deteccion): superficie publica del motor de deteccion"
```

---

# ENTREGA 2 — El cableado (tareas 12-14)

Aquí es donde el usuario nota el cambio. Cada tarea de esta entrega **debe dejar en verde los tests que ya existían** de su archivo: si alguno se rompe, es una regresión, no un test viejo.

## Task 12: `extractUnitLabel` delega en el motor nuevo

**Files:**
- Modify: `src/lib/scheduling/unitPatterns.ts:18-46` (constante `UNIT_PATTERNS` y función `extractUnitLabel`)
- Test: `src/lib/scheduling/unitPatterns.test.ts` (crear)

**Interfaces:**
- Consumes: `extractLocation`, `LOCATION_PATTERNS` de `./detection/location`.
- Produces: `extractUnitLabel(text: string): UnitMatch | null` conserva su firma; `UnitMatch` gana un campo: `{ label: string; value: string; numericValue: number }`. `UNIT_PATTERNS` se deriva de `LOCATION_PATTERNS` para que siga existiendo una sola lista. `buildWbsBreadcrumb` no cambia.

**Cuidado:** `unitPatterns.ts` no puede importar de `./detection/index.ts`, porque `taskLocation.ts` importa `buildWbsBreadcrumb` de `unitPatterns.ts` y se crearía un ciclo. Importar **directamente de `./detection/location`**, que no depende de nada de `scheduling/`.

- [ ] **Step 1: Write the failing test**

```ts
import { UNIT_PATTERNS, extractUnitLabel } from "./unitPatterns";

describe("extractUnitLabel (ahora sobre el motor de detección)", () => {
  test("sigue devolviendo etiqueta y valor como antes", () => {
    expect(extractUnitLabel("Mampostería Piso 3")).toEqual({
      label: "Piso",
      value: "3",
      numericValue: 3,
    });
  });

  test("ahora reconoce los sótanos, que es lo que fallaba", () => {
    expect(extractUnitLabel("COLUMNAS SÓTANO 2")).toEqual({
      label: "Sótano",
      value: "2",
      numericValue: -2,
    });
  });

  test("la torre sigue reconociéndose", () => {
    expect(extractUnitLabel("Estructura Torre B")?.label).toBe("Torre");
  });

  test("lo que no tiene ubicación sigue devolviendo null", () => {
    expect(extractUnitLabel("Descabece de pilotes")).toBeNull();
  });

  test("UNIT_PATTERNS sigue existiendo como lista única para quien la recorra", () => {
    expect(UNIT_PATTERNS.length).toBeGreaterThan(0);
    expect(UNIT_PATTERNS.every((pattern) => pattern.regex instanceof RegExp)).toBe(true);
  });

  test("los patrones sirven sobre texto en minúsculas, que es como los usa lob.ts", () => {
    // `lob.ts` limpia el nombre de la actividad sobre texto ya normalizado a
    // minúsculas y sin tildes. Si los patrones no aceptaran minúsculas, la
    // Línea de Balance dejaría de agrupar actividades.
    const limpio = UNIT_PATTERNS.reduce(
      (text, pattern) => text.replace(pattern.regex, " "),
      "mamposteria piso 3",
    );
    expect(limpio.trim()).toBe("mamposteria");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/unitPatterns.test.ts`
Expected: FAIL — el primer test falla con `Expected: {"label": "Piso", "numericValue": 3, "value": "3"}` / `Received: {"label": "Piso", "value": "3"}`, y el del sótano con `Received: null`. El de minúsculas ya pasa antes del cambio (los patrones viejos llevaban `i`); está para que esa propiedad no se pierda al derivarlos del motor.

- [ ] **Step 3: Write minimal implementation**

Reemplazar en `src/lib/scheduling/unitPatterns.ts` el bloque que va desde `export const UNIT_PATTERNS` hasta el final de `extractUnitLabel` por:

```ts
import { LOCATION_PATTERNS, extractLocation } from "./detection/location";

/**
 * Lista única de patrones de unidad de producción.
 *
 * Ya no se define aquí: vive en el motor de detección
 * (`detection/location.ts`), portado de PDC V2, que además de la etiqueta
 * devuelve un número ordenable y reconoce los sótanos —los 44 casos que
 * fallaban en el archivo real de obra—. Se conserva la exportación porque
 * `lob.ts` y `typicalUnit.ts` recorren la lista para limpiar nombres.
 */
export const UNIT_PATTERNS: Array<{ label: string; regex: RegExp }> =
  LOCATION_PATTERNS.map(({ label, regex }) => ({ label, regex }));

export interface UnitMatch {
  label: string;
  /** El texto tal cual salió del nombre. */
  value: string;
  /** Número ordenable. Los sótanos son negativos; la cubierta, 900. */
  numericValue: number;
}

export function extractUnitLabel(text: string): UnitMatch | null {
  const location = extractLocation(text);
  if (!location) return null;
  return {
    label: location.label,
    value: location.raw,
    numericValue: location.value,
  };
}
```

`buildWbsBreadcrumb` se queda tal cual, al final del archivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/unitPatterns.test.ts src/lib/scheduling/typicalUnit.test.ts src/lib/scheduling/lob.test.ts`
Expected: PASS los 6 de `unitPatterns.test.ts`. Si `typicalUnit.test.ts` o `lob.test.ts` fallan aquí, **no se arreglan tocando sus tests**: se anota el fallo y se resuelve en la Tarea 13 o 14, que es donde se cablean esos archivos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/unitPatterns.ts src/lib/scheduling/unitPatterns.test.ts
git commit -m "refactor(deteccion): unitPatterns delega en el motor y expone el numero ordenable"
```

---

## Task 13: Unidad Típica ordena por número y deja de perder sótanos

**Files:**
- Modify: `src/lib/scheduling/typicalUnit.ts:7-16` (interfaz `TypicalUnitActivity`), `:41-48` (`extractLevel`), `:69-86` (construcción de actividades), `:125` (el `sort`)
- Modify: `src/lib/scheduling/typicalUnit.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `resolveTaskLocation` de `./detection/taskLocation`.
- Produces: `TypicalUnitActivity` gana `levelValue: number`. `TypicalUnitGroup` y `TypicalUnitAnalysis` no cambian.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/scheduling/typicalUnit.test.ts`:

```ts
describe("analyzeTypicalUnits · sótanos y orden físico", () => {
  test("los sótanos ya no se pierden: son niveles como cualquier otro", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Mampostería Sótano 3", wbs: "1.1.1" }),
      task({ id: 2, name: "Mampostería Sótano 2", wbs: "1.1.2" }),
      task({ id: 3, name: "Mampostería Sótano 1", wbs: "1.1.3" }),
    ]);

    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].levelCount).toBe(3);
  });

  test("el orden es el físico: sótano 3 primero, cubierta al final", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Pintura Piso 12", wbs: "1.1" }),
      task({ id: 2, name: "Pintura Sótano 1", wbs: "1.2" }),
      task({ id: 3, name: "Pintura Piso 1", wbs: "1.3" }),
      task({ id: 4, name: "Pintura Cubierta", wbs: "1.4" }),
    ]);

    expect(analysis.groups[0].activities.map((item) => item.levelValue)).toEqual([
      -1, 1, 12, 900,
    ]);
  });

  test("la ubicación heredada de la tarea padre también cuenta", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "SOTANO 1", wbs: "1.1", outlineLevel: 1 }),
      task({ id: 2, name: "SOTANO 2", wbs: "1.2", outlineLevel: 1 }),
      task({ id: 3, name: "SOTANO 3", wbs: "1.3", outlineLevel: 1 }),
      task({ id: 4, name: "Muro en ladrillo", wbs: "1.1.1", outlineLevel: 2 }),
      task({ id: 5, name: "Muro en ladrillo", wbs: "1.2.1", outlineLevel: 2 }),
      task({ id: 6, name: "Muro en ladrillo", wbs: "1.3.1", outlineLevel: 2 }),
    ]);

    const grupo = analysis.groups.find((item) => item.system === "muro en ladrillo");
    expect(grupo?.levelCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/typicalUnit.test.ts`
Expected: FAIL — el primero con `Expected length: 1, Received length: 0` (los sótanos no se detectan y las tareas se descartan), y el segundo con `Property 'levelValue' does not exist` en tiempo de tipos y `undefined` en ejecución.

- [ ] **Step 3: Write minimal implementation**

Tres cambios en `src/lib/scheduling/typicalUnit.ts`:

**a)** Sustituir el import de la línea 3 y añadir el del motor:

```ts
import { buildWbsBreadcrumb, UNIT_PATTERNS } from "./unitPatterns";
import { resolveTaskLocation } from "./detection/taskLocation";
```

**b)** Añadir el campo a la interfaz y sustituir `extractLevel`:

```ts
export interface TypicalUnitActivity {
  taskId: string | number;
  name: string;
  /** Texto del nivel, para mostrar: «3», «CUBIERTA». */
  level: string;
  /** Número ordenable del nivel. Los sótanos son negativos. */
  levelValue: number;
  system: string;
  durationDays: number;
  productivity: number;
  start: Date;
  finish: Date;
}

/**
 * Nivel de una tarea, usando el motor de detección: mira el nombre, luego
 * las tareas padre y luego el WBS. Antes solo miraba el nombre y perdía toda
 * la mampostería y el aseo, que cuelgan de un padre llamado «SÓTANO 2».
 */
function extractLevel(
  task: GanttTask,
  tasks: GanttTask[],
): { level: string; levelValue: number } | null {
  const resolved = resolveTaskLocation(task, tasks);
  if (resolved.location) {
    return { level: resolved.location.raw, levelValue: resolved.location.value };
  }
  const parts = task.wbs?.split(".");
  if (parts && parts.length >= 3) {
    const fallback = parts[parts.length - 2];
    return { level: fallback, levelValue: Number(fallback) };
  }
  return null;
}
```

**c)** Ajustar la construcción de actividades y el orden:

```ts
    .map((task): TypicalUnitActivity | null => {
      const level = extractLevel(task, tasks);
      if (!level) return null;
      const days = durationDays(task);
      return {
        taskId: task.id,
        name: task.name,
        level: level.level,
        levelValue: level.levelValue,
        system: systemName(task),
        durationDays: days,
        productivity: 1 / days,
        start: task.start,
        finish: task.finish,
      };
    })
```

y en la línea del `sort` dentro del `map` de grupos:

```ts
        activities: items.sort((a, b) => {
          if (Number.isFinite(a.levelValue) && Number.isFinite(b.levelValue)) {
            return a.levelValue - b.levelValue;
          }
          return a.level.localeCompare(b.level, "es", { numeric: true });
        }),
```

Nota: `levels` sigue construyéndose con `new Set(items.map((item) => item.level))`. Como `level` es el texto, «SOTANO 1» y «SÓTANO 1» ya llegan normalizados desde `extractLocation` (`raw` sale del nombre normalizado), así que no hay duplicados por tilde.

**`systemName` no se toca, y hay un motivo.** Recorre `UNIT_PATTERNS` para quitar la ubicación del nombre
y quedarse con el sistema, y lo hace sobre `task.name` **tal cual**, porque el test que ya existe espera
`system: "mampostería"` **con tilde**. Por eso el patrón del sótano se escribió en la Tarea 3 como
`\bS[OÓ]TANO\b`: si solo aceptara `SOTANO`, «Pintura Sótano 1» conservaría su ubicación en el nombre y
acabaría en un sistema distinto al de «Pintura Piso 1», rompiendo el segundo test de esta tarea. Si ese
test falla con `["pintura sótano 1"]` o similar en el grupo, el fallo está en el patrón de la Tarea 3, no
aquí.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/typicalUnit.test.ts`
Expected: PASS — los tests que ya existían más los 3 nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/typicalUnit.ts src/lib/scheduling/typicalUnit.test.ts
git commit -m "fix(unidad-tipica): detectar sotanos y ordenar los niveles como se construye la obra"
```

---

## Task 14: Línea de Balance sobre el motor nuevo, y verificación del conjunto

**Files:**
- Modify: `src/lib/scheduling/lob.ts:441-459` (función `detectUnit`)
- Modify: `src/lib/scheduling/lob.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `extractLocation` de `./detection/location`.
- Produces: `detectUnit` conserva su firma `{ label: string; key: string; index: number } | null`; `index` pasa a ser el número ordenable del motor en vez de un `Number(...)` sobre el texto.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/scheduling/lob.test.ts`:

```ts
import { generateLOBFromTasks } from "./lob";
import { extractLocation } from "./detection/location";

describe("Línea de Balance · ubicación con el motor nuevo", () => {
  test("un sótano da un índice negativo, para que la línea baje", () => {
    expect(extractLocation("COLUMNAS SÓTANO 2")?.value).toBe(-2);
  });

  test("las actividades de sótano ya no quedan fuera del análisis", () => {
    const { mappings } = generateLOBFromTasks(
      [
        {
          id: 1,
          name: "MAMPOSTERÍA SÓTANO 1",
          start: new Date("2026-01-05T08:00:00"),
          finish: new Date("2026-01-09T17:00:00"),
          duration: 5,
          progress: 0,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
          wbs: "1.1",
        },
      ],
      [{ activityName: "Mampostería", taskIds: [1], unitLabel: "Sótano" }],
    );

    expect(mappings).toHaveLength(1);
    expect(mappings[0].unitLabel).toBe("Sótano");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/lob.test.ts`
Expected: el primer test FALLA con `Received: undefined` si la Tarea 12 no se completó, y PASA si sí. El segundo test es de no-regresión sobre `generateLOBFromTasks`. Si ambos pasan ya, **igualmente hay que hacer el cambio del paso 3**: el objetivo de esta tarea es que `detectUnit` deje de calcular su propio índice a partir del texto (`Number(raw.replace(/^[A-Z]/, ""))`), que con «SOTANO 1» daría `1` en vez de `-1`. Añade este test extra antes de continuar, que sí falla:

```ts
  test("el índice de la unidad respeta el orden físico, no el texto", () => {
    const nombres = ["MAMPOSTERÍA SÓTANO 2", "MAMPOSTERÍA PISO 1", "MAMPOSTERÍA CUBIERTA"];
    const indices = nombres.map((name) => extractLocation(name)!.value);
    expect(indices).toEqual([-2, 1, 900]);
  });
```

- [ ] **Step 3: Write minimal implementation**

Reemplazar `detectUnit` en `src/lib/scheduling/lob.ts` (líneas 441-459) por:

```ts
/**
 * Ubicación de una actividad, con el motor de detección.
 *
 * `index` es el número ordenable: los sótanos van en negativo, así que la
 * Línea de Balance los dibuja por debajo del piso 1 en vez de después del
 * piso 12, que es lo que hacía cuando el índice salía del texto.
 */
function detectUnit(name: string): { label: string; key: string; index: number } | null {
  const location = extractLocation(name);
  if (!location) return null;
  return { label: location.label, key: location.raw, index: location.value };
}
```

y añadir el import al principio del archivo, junto a los que ya hay:

```ts
import { extractLocation } from "./detection/location";
```

`normalizeText` y `normalizeActivityName` siguen igual: limpian el nombre para agrupar actividades, que es otro trabajo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/lob.test.ts`
Expected: PASS — los tests que ya existían más los 3 nuevos.

- [ ] **Step 5: Verificación del conjunto**

```bash
npx jest --runInBand
```
Expected: toda la suite en verde. Ningún test de `activityFamily.test.ts` puede haber cambiado.

```bash
npx eslint src/lib/scheduling
```
Expected: sin errores.

```bash
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
```
Expected: **salida vacía**.

```bash
npx next build
```
Expected: build correcto.

- [ ] **Step 6: Comprobación en el navegador con el archivo real**

Desde la raíz del repositorio:

```bash
docker compose up -d --build frontend
```

Abrir `http://localhost:3000`, importar `aia-ms-project/20260312 DA PORTO TORRE 3.mpp` y comprobar, en este orden:

1. **Línea de Balance** — el contador de cobertura sube por encima de las 195 tareas anteriores, y los sótanos aparecen dibujados **por debajo** del piso 1.
2. **Unidad Típica** — la mampostería, el revoque y el aseo de los tres sótanos aparecen como niveles del mismo sistema.
3. Que las tareas de urbanismo (`VÍAS INTERNAS`, `SKATE PARK`) **siguen sin ubicación** y no se han colado en ningún piso inventado.

Anotar el número real de cobertura en el mensaje del commit. **Ese número, no una estimación, es lo que cierra la condición de hecho del goal.**

- [ ] **Step 7: Commit**

```bash
git add src/lib/scheduling/lob.ts src/lib/scheduling/lob.test.ts
git commit -m "fix(linea-de-balance): ubicar por el motor de deteccion y ordenar los sotanos en negativo"
```

---

## Cierre del proyecto

- [ ] Suite completa, lint, tipos filtrados vacíos y build en verde (Tarea 14, paso 5).
- [ ] Cobertura sobre el archivo real anotada tras la comprobación en navegador (Tarea 14, paso 6).
- [ ] Revisión con `superpowers:requesting-code-review` antes de fusionar.
- [ ] Fusión de `carril-b/motor-deteccion` a `main` con `superpowers:finishing-a-development-branch`.
- [ ] Actualizar `goals/motor-deteccion/goal.md` a `estado: cerrado` con el número de cobertura medido.
