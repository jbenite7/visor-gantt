# P3b · La obra lineal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el motor entienda los cronogramas de obra lineal, donde la ubicación es un tramo entre dos ejes y no un piso, y que de paso deje de resolver a medias las tareas que cruzan dos niveles.

**Architecture:** Aditivo sobre el motor de detección que dejó P3. Se añade un concepto —la ubicación puede tener principio y fin— y tres entradas de vocabulario a la lista de patrones que ya existe. Nada de lo anterior cambia de firma ni de resultado: el fixture de obra vertical de P3 es la prueba de no regresión y no se toca.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · Jest + Testing Library · Playwright (E2E) · Docker Compose.

Spec: [2026-08-08-obra-lineal-design.md](../specs/2026-08-08-obra-lineal-design.md) · Goal: [`goals/obra-lineal/goal.md`](../../../goals/obra-lineal/goal.md)

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Sin excepciones.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Comandos de verificación: `npx jest --runInBand`, `npx eslint <archivos>`, `npx tsc --noEmit`, `npx next build`.
- `npx tsc --noEmit` arrastra **38 errores preexistentes** en archivos `*.test.*` y `e2e/`. Filtrar siempre: `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`. Ese filtro debe salir **vacío**.
- **`src/lib/scheduling/detection/fixtures/daPorto.ts` y su test NO se tocan.** Son la prueba de que la gramática de obra lineal no pisa a la de obra vertical. Si alguno de sus casos se pone en rojo, el cambio está mal: **parar y reportar**, nunca ajustar el fixture.
- Copy en **español con tildes**, en lenguaje de obra. Los mensajes de commit van **sin** tildes, por convención del repositorio (298 de sus últimos 300).
- **Prohibido tocar** `src/components/views/GanttView.tsx` y `src/lib/state/ProjectContext.tsx`: son del carril A.
- Rama: `carril-b/obra-lineal`, creada desde `main` con P3 y P4 ya fusionados.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/lib/scheduling/detection/axisLabel.ts` | `parseAxisLabel`, `compareAxisLabels` | 1 |
| `src/lib/scheduling/detection/location.ts` | `LocationSpan`, `span` en `LocationMatch`, patrones de eje, módulo, edificio y transición | 2, 3, 4, 5 |
| `src/lib/scheduling/detection/fixtures/estacion16.ts` | Vocabulario real de la Estación 16 con sus esperados | 6 |
| `src/lib/scheduling/detection/index.ts` | Reexporta lo nuevo | 7 |
| `src/lib/scheduling/detection/fixtures/daPorto.ts` | **Intacto**: prueba de no regresión | — |

---

## Task 1: Etiquetas de eje comparables

**Files:**
- Create: `src/lib/scheduling/detection/axisLabel.ts`
- Test: `src/lib/scheduling/detection/axisLabel.test.ts`

**Interfaces:**
- Consumes: `normalizeName` de `./normalize`.
- Produces:
  - `export interface AxisLabel { family: string; index: number; raw: string }`
  - `export function parseAxisLabel(raw: string): AxisLabel | null`
  - `export function compareAxisLabels(a: AxisLabel, b: AxisLabel): number`

- [ ] **Step 1: Write the failing test**

```ts
import { compareAxisLabels, parseAxisLabel } from "./axisLabel";

describe("parseAxisLabel", () => {
  test("una letra suelta es la familia sin nombre, con A=1", () => {
    expect(parseAxisLabel("A")).toEqual({ family: "", index: 1, raw: "A" });
    expect(parseAxisLabel("D")?.index).toBe(4);
    expect(parseAxisLabel("K")?.index).toBe(11);
  });

  test("acepta minúsculas, porque los nombres de obra las mezclan", () => {
    expect(parseAxisLabel("b")?.index).toBe(2);
  });

  test("un número es la familia de los números", () => {
    expect(parseAxisLabel("03")).toEqual({ family: "#", index: 3, raw: "03" });
    expect(parseAxisLabel("7")?.index).toBe(7);
  });

  test("una serie con prefijo conserva el prefijo como familia", () => {
    expect(parseAxisLabel("DB4")).toEqual({ family: "DB", index: 4, raw: "DB4" });
    expect(parseAxisLabel("DB08")).toEqual({ family: "DB", index: 8, raw: "DB08" });
  });

  test("lo que no es una etiqueta de eje devuelve null", () => {
    expect(parseAxisLabel("")).toBeNull();
    expect(parseAxisLabel("SUPERIOR")).toBeNull();
    expect(parseAxisLabel("-")).toBeNull();
  });
});

describe("compareAxisLabels", () => {
  test("dentro de una familia, ordena por índice", () => {
    const a = parseAxisLabel("A")!;
    const d = parseAxisLabel("D")!;
    expect(compareAxisLabels(a, d)).toBeLessThan(0);
    expect(compareAxisLabels(d, a)).toBeGreaterThan(0);
    expect(compareAxisLabels(a, a)).toBe(0);
  });

  test("entre familias distintas, ordena por familia", () => {
    // Comparar «A» con «03» no significa nada en la obra: se agrupan por
    // familia y se ordena dentro de cada una.
    const letra = parseAxisLabel("A")!;
    const numero = parseAxisLabel("03")!;
    const serie = parseAxisLabel("DB4")!;

    expect(compareAxisLabels(letra, serie)).toBeLessThan(0);
    expect(compareAxisLabels(serie, numero)).toBeLessThan(0);
  });

  test("el orden es estable: ordenar una lista da siempre lo mismo", () => {
    const etiquetas = ["DB4", "A", "03", "D", "DB08"].map((raw) => parseAxisLabel(raw)!);
    const ordenada = [...etiquetas].sort(compareAxisLabels).map((item) => item.raw);

    expect(ordenada).toEqual(["A", "D", "DB4", "DB08", "03"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/axisLabel.test.ts`
Expected: FAIL — `Cannot find module './axisLabel' from 'src/lib/scheduling/detection/axisLabel.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { normalizeName } from "./normalize";

/**
 * Una etiqueta de eje de la obra.
 *
 * En un mismo cronograma conviven tres formas de nombrar un eje: letras
 * (`A`…`K`), números (`03`, `07`) y series con prefijo (`DB4`, `DB08`). No
 * son el mismo eje escrito distinto: son **rejillas distintas** de partes
 * distintas de la obra. Por eso se guardan con su familia, y solo se
 * comparan índices dentro de la misma.
 */
export interface AxisLabel {
  /** «» para las letras sueltas, «#» para los números, el prefijo para las series. */
  family: string;
  index: number;
  raw: string;
}

const SINGLE_LETTER = /^([A-Z])$/;
const PLAIN_NUMBER = /^(\d{1,3})$/;
const PREFIXED = /^([A-Z]{1,3})(\d{1,3})$/;

export function parseAxisLabel(raw: string): AxisLabel | null {
  const text = normalizeName(raw);
  if (!text) return null;

  const letter = text.match(SINGLE_LETTER);
  if (letter) {
    return {
      family: "",
      index: letter[1].charCodeAt(0) - "A".charCodeAt(0) + 1,
      raw,
    };
  }

  const number = text.match(PLAIN_NUMBER);
  if (number) {
    return { family: "#", index: Number(number[1]), raw };
  }

  const prefixed = text.match(PREFIXED);
  if (prefixed) {
    return { family: prefixed[1], index: Number(prefixed[2]), raw };
  }

  return null;
}

/**
 * El orden entre familias, declarado a mano.
 *
 * No se ordena por el nombre de la familia porque «#» no es un nombre: es un
 * centinela inventado aquí para los ejes numerados. Ordenarlo como texto
 * dejaría el resultado a merced de un carácter elegido al azar.
 */
function familyRank(family: string): number {
  if (family === "") return 0; // las letras sueltas: la rejilla principal
  if (family === "#") return 2; // los ejes numerados, al final
  return 1; // las series con prefijo («DB»), en medio
}

/**
 * Ordena por familia y luego por índice.
 *
 * Comparar «A» con «03» no significa nada, y esto no finge que sí: agrupa por
 * familia y ordena dentro de cada una. Es lo único defendible sin conocer la
 * geometría real de la obra.
 */
export function compareAxisLabels(a: AxisLabel, b: AxisLabel): number {
  if (a.family !== b.family) {
    const rank = familyRank(a.family) - familyRank(b.family);
    if (rank !== 0) return rank;
    // Dos series con prefijo distinto: por nombre, que aquí sí es un nombre.
    return a.family < b.family ? -1 : 1;
  }
  return a.index - b.index;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection/axisLabel.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/axisLabel.ts src/lib/scheduling/detection/axisLabel.test.ts
git commit -m "feat(obra-lineal): etiquetas de eje con familia e indice comparables"
```

---

## Task 2: La ubicación puede tener principio y fin

**Files:**
- Modify: `src/lib/scheduling/detection/location.ts` (interfaz `LocationMatch` y `extractLocation`)
- Modify: `src/lib/scheduling/detection/location.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `export interface LocationSpan { rawFrom: string; rawTo: string; from: number; to: number }`
  - `LocationMatch` gana `span?: LocationSpan`.
  - `LocationPattern` gana `spanOf?: (match: RegExpMatchArray) => LocationSpan | null`.
  - `extractLocation` rellena `span` cuando el patrón lo aporta. Su firma no cambia.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/scheduling/detection/location.test.ts`:

```ts
import { extractLocation as extraer } from "./location";

describe("extractLocation · la ubicación puede ser un tramo", () => {
  test("lo que ya resolvía sigue sin tramo: nada cambia para obra vertical", () => {
    expect(extraer("LOSA AÉREA PISO 5")?.span).toBeUndefined();
    expect(extraer("COLUMNAS SÓTANO 2")?.span).toBeUndefined();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: FAIL — TypeScript rechaza `.span` sobre `LocationMatch` con `Property 'span' does not exist on type 'LocationMatch'`.

- [ ] **Step 3: Write minimal implementation**

En `src/lib/scheduling/detection/location.ts`, junto a `LocationMatch`:

```ts
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
}
```

`LocationMatch` gana el campo:

```ts
export interface LocationMatch {
  label: string;
  raw: string;
  value: number;
  /** Presente solo cuando la ubicación es un tramo. */
  span?: LocationSpan;
}
```

`LocationPattern` gana el suyo:

```ts
export interface LocationPattern {
  label: string;
  regex: RegExp;
  valueOf: (match: RegExpMatchArray) => number;
  /** Solo los patrones de tramo lo aportan. */
  spanOf?: (match: RegExpMatchArray) => LocationSpan | null;
}
```

Y `extractLocation` lo rellena:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection`
Expected: PASS — toda la carpeta, incluidos los del fixture de DA PORTO, que no debían cambiar.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/location.ts src/lib/scheduling/detection/location.test.ts
git commit -m "feat(obra-lineal): la ubicacion admite principio y fin"
```

---

## Task 3: Ejes, con rango y sueltos

**Files:**
- Modify: `src/lib/scheduling/detection/location.ts` (array `LOCATION_PATTERNS`)
- Modify: `src/lib/scheduling/detection/location.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `parseAxisLabel`, `compareAxisLabels` de `./axisLabel`.
- Produces: `LOCATION_PATTERNS` gana dos entradas con etiqueta `"Eje"`. `extractLocation` no cambia de firma.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/scheduling/detection/location.test.ts`:

```ts
describe("extractLocation · ejes (nombres reales de la Estación 16)", () => {
  test("un rango de ejes da un tramo con principio y fin", () => {
    const eje = extraer("Módulo 1.1 (Ejes A-D)");
    expect(eje?.span).toEqual({ rawFrom: "A", rawTo: "D", from: 1, to: 4 });
  });

  test("el rango también con la palabra en singular", () => {
    expect(extraer("Construcción Losa Aérea (Eje D-H)")?.span).toEqual({
      rawFrom: "D",
      rawTo: "H",
      from: 4,
      to: 8,
    });
  });

  test("un rango entre familias distintas se admite y conserva los dos textos", () => {
    // «Ejes J-DB08» cruza dos rejillas. El dato lo dice; ordenarlas entre sí
    // es problema de quien las dibuje, no del extractor.
    const eje = extraer("Módulo 2.2 (Ejes J-DB08)");
    expect(eje?.span?.rawFrom).toBe("J");
    expect(eje?.span?.rawTo).toBe("DB08");
  });

  test("el rango numérico también: «Eje 3-H» es un caso real del archivo", () => {
    expect(extraer("Solución apuntalamiento (Eje 3-H)")?.span?.rawFrom).toBe("3");
  });

  test("un eje suelto resuelve sin tramo", () => {
    const eje = extraer("Refuerzo (eje A)");
    expect(eje?.label).toBe("Eje");
    expect(eje?.value).toBe(1);
    expect(eje?.span).toBeUndefined();
  });

  test("«eje» sin etiqueta detrás no resuelve", () => {
    expect(extraer("Replanteo de ejes")).toBeNull();
    expect(extraer("Nivelación hasta nivel superior")).toBeNull();
  });

  test("un guion decorativo no convierte un eje suelto en rango", () => {
    // Exige dos etiquetas alrededor del separador, no una sola.
    expect(extraer("Losa aérea - Eje D")?.span).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: FAIL — todos los casos de eje devuelven `null`, porque `LOCATION_PATTERNS` aún no tiene ninguna entrada de eje.

- [ ] **Step 3: Write minimal implementation**

En `location.ts`, añadir el import y las dos entradas. **Van después de las de piso, sótano y etapa, y antes de los códigos cortos**, por la misma razón que en P3: las palabras completas mandan sobre los códigos de una letra.

```ts
import { compareAxisLabels, parseAxisLabel } from "./axisLabel";
```

```ts
  {
    label: "Eje",
    // Dos etiquetas alrededor del separador: un guion decorativo no basta.
    regex: /\bEJES?\s*[-#:]?\s*([A-Z]{0,3}\d{0,3}|[A-Z])\s*(?:-|\bA\b)\s*([A-Z]{0,3}\d{0,3}|[A-Z])\b/i,
    valueOf: (match) => parseAxisLabel(match[1])?.index ?? Number.NaN,
    spanOf: (match) => {
      const from = parseAxisLabel(match[1]);
      const to = parseAxisLabel(match[2]);
      if (!from || !to) return null;
      return { rawFrom: from.raw, rawTo: to.raw, from: from.index, to: to.index };
    },
  },
  {
    label: "Eje",
    regex: /\bEJES?\s*[-#:]?\s*([A-Z]{1,3}\d{1,3}|[A-Z]|\d{1,3})\b/i,
    valueOf: (match) => parseAxisLabel(match[1])?.index ?? Number.NaN,
  },
```

`compareAxisLabels` se importa aquí aunque no se use todavía: la Tarea 7 lo reexporta desde el índice. Si el linter se queja de import sin usar en este paso, impórtalo en la Tarea 7 en vez de aquí.

Nota para quien implemente: `valueOf` devuelve `NaN` cuando la etiqueta no se puede leer, y `extractLocation` ya descarta los valores no finitos y sigue probando patrones. Es deliberado: un «eje» que no se sabe leer no debe inventarse un número.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection`
Expected: PASS — los 7 nuevos, y **el fixture de DA PORTO sin un solo cambio**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/location.ts src/lib/scheduling/detection/location.test.ts
git commit -m "feat(obra-lineal): reconocer ejes sueltos y rangos de ejes"
```

---

## Task 4: Módulo con decimal, y edificio

**Files:**
- Modify: `src/lib/scheduling/detection/location.ts` (array `LOCATION_PATTERNS`)
- Modify: `src/lib/scheduling/detection/location.test.ts` (añadir un `describe`)

**Interfaces:**
- Produces: `LOCATION_PATTERNS` gana las etiquetas `"Módulo"` y `"Edificio"`.

- [ ] **Step 1: Write the failing test**

```ts
describe("extractLocation · módulo y edificio", () => {
  test("el módulo admite decimal, porque 1.1 y 1.2 son submódulos del 1", () => {
    expect(extraer("Módulo 1.1 (Ejes A-D)")).toMatchObject({
      label: "Módulo",
      raw: "1.1",
      value: 1.1,
    });
    expect(extraer("Modulo 2.2")?.value).toBe(2.2);
  });

  test("el módulo gana al eje: es la unidad de producción de esa obra", () => {
    // «Módulo 1.1 (Ejes A-D)» tiene los dos. El módulo es donde se trabaja;
    // el eje dice dónde está ese módulo.
    expect(extraer("Módulo 1.1 (Ejes A-D)")?.label).toBe("Módulo");
  });

  test("un módulo entero también", () => {
    expect(extraer("Excavación Módulo 3")?.value).toBe(3);
  });

  test("el edificio resuelve por su número", () => {
    expect(extraer("Inicio de obra Edificio 1 (Sur)")).toMatchObject({
      label: "Edificio",
      value: 1,
    });
    expect(extraer("Edificio 2 (Norte)")?.value).toBe(2);
  });

  test("«EDIFICIO DESCENDENTE» no es una ubicación: no lleva número", () => {
    expect(extraer("EDIFICIO DESCENDENTE")).toBeNull();
  });

  test("los ejes de obra vertical siguen intactos", () => {
    expect(extraer("LOSA AÉREA PISO 5")?.label).toBe("Piso");
    expect(extraer("COLUMNAS SÓTANO 3")?.value).toBe(-3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: FAIL — «Módulo 1.1 (Ejes A-D)» resuelve hoy como `Eje` (por la Tarea 3), no como `Módulo`, y los casos de edificio devuelven `null`.

- [ ] **Step 3: Write minimal implementation**

Añadir a `LOCATION_PATTERNS`, **antes** de las dos entradas de eje:

```ts
  {
    label: "Módulo",
    // Decimal a propósito: 1.1 y 1.2 son submódulos del módulo 1, y como
    // enteros se fundirían en uno.
    regex: /\bMODULO\s*[-#:]?\s*(\d+(?:\.\d+)?)\b/i,
    valueOf: (match) => Number(match[1]),
  },
  {
    label: "Edificio",
    regex: /\bEDIFICIO\s*[-#:]?\s*(\d+)\b/i,
    valueOf: (match) => Number(match[1]),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection`
Expected: PASS — los 6 nuevos, y el fixture de DA PORTO intacto.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/location.ts src/lib/scheduling/detection/location.test.ts
git commit -m "feat(obra-lineal): reconocer modulo con decimal y edificio"
```

---

## Task 5: Las transiciones entre pisos

**Files:**
- Modify: `src/lib/scheduling/detection/location.ts` (array `LOCATION_PATTERNS`)
- Modify: `src/lib/scheduling/detection/location.test.ts` (añadir un `describe`)

**Interfaces:**
- Produces: `LOCATION_PATTERNS` gana una entrada de piso con rango, **delante** de la de piso que ya existe.

- [ ] **Step 1: Write the failing test**

```ts
describe("extractLocation · tareas que cruzan dos pisos", () => {
  test("«Piso 1 a 2» es un tramo, no el piso 1 a secas", () => {
    // Es un caso real del archivo de la Estación 16, y hasta ahora el
    // extractor devolvía el primer número y descartaba el resto en silencio.
    expect(extraer("Piso 1 a 2 (eje A)")).toMatchObject({
      label: "Piso",
      value: 1,
      span: { rawFrom: "1", rawTo: "2", from: 1, to: 2 },
    });
  });

  test("también con guion", () => {
    expect(extraer("Escalera piso 2-3")?.span).toEqual({
      rawFrom: "2",
      rawTo: "3",
      from: 2,
      to: 3,
    });
  });

  test("un piso normal sigue sin tramo", () => {
    expect(extraer("Piso 2 (eje B a D)")?.span).toBeUndefined();
    expect(extraer("LOSA AÉREA PISO 5")?.span).toBeUndefined();
  });

  test("el orden por value no cambia: un tramo ordena por donde empieza", () => {
    expect(extraer("Piso 1 a 2 (eje A)")!.value).toBeLessThan(
      extraer("LOSA AÉREA PISO 5")!.value,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/location.test.ts`
Expected: FAIL — el primer test da `span: undefined`, porque hoy el patrón de piso caza el `1` y para.

- [ ] **Step 3: Write minimal implementation**

Añadir a `LOCATION_PATTERNS` **como primera entrada**, delante de la de piso que ya existe:

```ts
  {
    label: "Piso",
    // Una tarea que cruza dos niveles —«Piso 1 a 2»— es un tramo, igual que
    // un rango de ejes. Va delante del patrón de piso normal porque si no,
    // aquel cazaría el primer número y se comería el resto sin avisar.
    regex: /\b(?:PISO|NIVEL|PLANTA)\s*[-#:]?\s*(\d+)\s*(?:-|\bA\b)\s*(\d+)\b/i,
    valueOf: (match) => Number(match[1]),
    spanOf: (match) => ({
      rawFrom: match[1],
      rawTo: match[2],
      from: Number(match[1]),
      to: Number(match[2]),
    }),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection`
Expected: PASS — los 4 nuevos. **Comprobar con especial cuidado el fixture de DA PORTO**: este patrón va el primero de la lista y es el que más riesgo tiene de robar casos que no le tocan. Si alguno de sus 75 casos falla, **parar y reportar**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/location.ts src/lib/scheduling/detection/location.test.ts
git commit -m "feat(obra-lineal): las tareas que cruzan dos pisos dejan de resolverse a medias"
```

---

## Task 6: El archivo de la Estación 16 como fixture

**Files:**
- Create: `src/lib/scheduling/detection/fixtures/estacion16.ts`
- Test: `src/lib/scheduling/detection/fixtures/estacion16.test.ts`

**Interfaces:**
- Consumes: `extractLocation` de `../location`.
- Produces:
  - `export interface Estacion16Case { name: string; label: string | null; value: number | null; span?: { from: number; to: number } }`
  - `export const ESTACION_16_NAMES: Estacion16Case[]`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/fixtures/estacion16.test.ts`
Expected: FAIL — `Cannot find module './estacion16' from 'src/lib/scheduling/detection/fixtures/estacion16.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Nombres de tarea del archivo de obra real
 * `test_data/20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp` (300 tareas),
 * una estación de metro.
 *
 * Está aquí por lo mismo que el fixture de DA PORTO: para que nadie pueda
 * «mejorar la cobertura» aflojando un patrón. La lista incluye tanto los que
 * deben resolverse como las trampas del archivo — «torregrúa», que parece una
 * torre; «nivel superior», que parece un nivel; y «EDIFICIO DESCENDENTE», que
 * lleva la palabra sin número.
 */
export interface Estacion16Case {
  name: string;
  label: string | null;
  value: number | null;
  span?: { from: number; to: number };
}

export const ESTACION_16_NAMES: Estacion16Case[] = [
  // ── Módulos: la unidad de producción de esta obra ──
  { name: "Módulo 1.1 (Ejes A-D)", label: "Módulo", value: 1.1 },
  { name: "Módulo 1.2 (Ejes D-H)", label: "Módulo", value: 1.2 },
  { name: "Módulo 2.1 (Ejes H-J)", label: "Módulo", value: 2.1 },
  { name: "Módulo 2.2 (Ejes J-DB8)", label: "Módulo", value: 2.2 },
  { name: "Módulo 2.2 (Ejes J-DB08)", label: "Módulo", value: 2.2 },
  { name: "Modulo 1.1", label: "Módulo", value: 1.1 },
  { name: "Modulo 1.2", label: "Módulo", value: 1.2 },
  { name: "Modulo 2.1", label: "Módulo", value: 2.1 },
  { name: "Modulo 2.2", label: "Módulo", value: 2.2 },

  // ── Edificios ──
  { name: "Inicio de obra Edificio 1 (Sur)", label: "Edificio", value: 1 },
  { name: "Inicio de obra Edificio 2 (Norte)", label: "Edificio", value: 2 },
  { name: "EDIFICIO 1 (SUR)", label: "Edificio", value: 1 },
  { name: "EDIFICIO 2 (NORTE)", label: "Edificio", value: 2 },

  // ── Ejes como tramo ──
  {
    name: "Construccion Losa Aerea (Eje A-D)",
    label: "Eje",
    value: 1,
    span: { from: 1, to: 4 },
  },
  {
    name: "Construccion Losa Aerea (Eje D-H)",
    label: "Eje",
    value: 4,
    span: { from: 4, to: 8 },
  },
  {
    name: "Construccion Losa Aerea (Eje H-J)",
    label: "Eje",
    value: 8,
    span: { from: 8, to: 10 },
  },
  {
    name: "Lucarnas (Ejes A-D)",
    label: "Eje",
    value: 1,
    span: { from: 1, to: 4 },
  },
  {
    name: "Lucarnas (Ejes DB4-DB8)",
    label: "Eje",
    value: 4,
    span: { from: 4, to: 8 },
  },
  {
    name: "Lucarnas (Ejes H-DB4)",
    label: "Eje",
    value: 8,
    span: { from: 8, to: 4 },
  },
  {
    name: "Solucion apuntalamiento y liberacion zona aledaña predio BIC (Eje 3-H)",
    label: "Eje",
    value: 3,
    span: { from: 3, to: 8 },
  },

  // ── Pisos: los 15 que el motor de P3 ya resolvía ──
  { name: "Piso 1 (eje B a 2)", label: "Piso", value: 1 },
  { name: "Piso 2 (eje B a D)", label: "Piso", value: 2 },
  { name: "Piso 1 (eje E a F)", label: "Piso", value: 1 },
  { name: "Piso 2 (eje F a G)", label: "Piso", value: 2 },
  { name: "Piso 2 (eje I a K)", label: "Piso", value: 2 },
  { name: "Piso 1 (eje 03 a 05)", label: "Piso", value: 1 },
  { name: "Piso 2 (eje 05 a 06)", label: "Piso", value: 2 },

  // ── Pisos de transición: lo que antes se resolvía a medias ──
  {
    name: "Piso 1 a 2 (eje A)",
    label: "Piso",
    value: 1,
    span: { from: 1, to: 2 },
  },
  {
    name: "Piso 2 a 3 (eje A)",
    label: "Piso",
    value: 2,
    span: { from: 2, to: 3 },
  },
  {
    name: "Piso 1 a 2 (eje 07)",
    label: "Piso",
    value: 1,
    span: { from: 1, to: 2 },
  },
  {
    name: "Piso 2 a 3 (eje 07)",
    label: "Piso",
    value: 2,
    span: { from: 2, to: 3 },
  },

  // ── Las trampas: deben seguir sin resolver ──
  { name: "Montaje torregrúa", label: null, value: null },
  { name: "Dado para torregrua", label: null, value: null },
  { name: "Pilotaje para torregrua por ML1", label: null, value: null },
  { name: "Prealistamiento de torregrúas", label: null, value: null },
  { name: "Aprobacion de diseño cimentacion torregrua", label: null, value: null },
  {
    name: "Rellenos laterales y nivelacion hasta nivel superior Viga de Cimentacion",
    label: null,
    value: null,
  },
  { name: "EDIFICIO DESCENDENTE", label: null, value: null },
];
```

Aviso para quien implemente: si algún caso falla, **el error está en el patrón, no en el fixture**. Estos nombres salen del archivo real parseado; cambiarlos para que el test pase es falsificar la medición. Fíjate en particular en `Lucarnas (Ejes H-DB4)`, cuyo tramo va de un índice mayor a uno menor porque cruza dos familias de eje: **es correcto que sea así**, y el dato lo dice tal cual sin inventarse un orden.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection`
Expected: PASS — los ~40 casos de `test.each` más los 2 tests, y **el fixture de DA PORTO en verde sin tocarse**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/detection/fixtures/estacion16.ts src/lib/scheduling/detection/fixtures/estacion16.test.ts
git commit -m "test(obra-lineal): fijar el vocabulario real de la Estacion 16 como fixture"
```

---

## Task 7: Superficie pública y verificación del conjunto

**Files:**
- Modify: `src/lib/scheduling/detection/index.ts`
- Modify: `src/lib/scheduling/detection/index.test.ts`

**Interfaces:**
- Produces: el índice reexporta `parseAxisLabel`, `compareAxisLabels`, `AxisLabel` y `LocationSpan`.

- [ ] **Step 1: Write the failing test**

Añadir a `src/lib/scheduling/detection/index.test.ts`:

```ts
  test("expone también el vocabulario de obra lineal", () => {
    expect(typeof detection.parseAxisLabel).toBe("function");
    expect(typeof detection.compareAxisLabels).toBe("function");
  });

  test("tampoco expone el fixture de la Estación 16", () => {
    expect("ESTACION_16_NAMES" in detection).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/detection/index.test.ts`
Expected: FAIL — `detection.parseAxisLabel` sale `undefined`.

- [ ] **Step 3: Write minimal implementation**

Añadir a `src/lib/scheduling/detection/index.ts`:

```ts
export {
  compareAxisLabels,
  parseAxisLabel,
  type AxisLabel,
} from "./axisLabel";
```

y añadir `type LocationSpan` a la lista que ya se reexporta de `./location`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/detection`
Expected: PASS — toda la carpeta.

- [ ] **Step 5: Verificación del conjunto**

```bash
npx jest --runInBand
```
Expected: toda la suite en verde. **El fixture de DA PORTO no puede haber cambiado ni un caso**: es la prueba de que la gramática de obra lineal no pisa a la de obra vertical.

```bash
npx eslint src/lib/scheduling
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
npx next build
```
Expected: sin errores; el filtro de tipos, **vacío**.

- [ ] **Step 6: Medición sobre los dos archivos reales**

Esta es la comprobación que cierra la condición de hecho, y hay que hacerla con el parser, no a ojo. El servicio corre en `http://localhost:8000` (`docker compose up -d mpp-parser` desde la raíz si no está levantado).

Escribe un test temporal —**bórralo después, no lo commitees**— que lea los dos archivos parseados y use `summarizeDetection` de `@/lib/scheduling/detection`:

1. Sobre `test_data/20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp`, comprobar que la cobertura sube claramente respecto a los 15 pisos que resolvía antes, y **listar los nombres que siguen sin ubicación** para confirmar que son los que deben serlo.
2. Sobre `aia-ms-project/20260312 DA PORTO TORRE 3.mpp`, comprobar que la cobertura es **exactamente la misma** que dejó P3: 197 de 212 tareas con ubicación, 15 de obra general. **Si cambia, la gramática nueva pisó a la anterior y hay que parar.**

Anota los dos números en el mensaje del commit final. **Esos números, no una estimación, son lo que cierra el goal.**

- [ ] **Step 7: Commit**

```bash
git add src/lib/scheduling/detection/index.ts src/lib/scheduling/detection/index.test.ts
git commit -m "feat(obra-lineal): superficie publica y verificacion sobre los dos archivos reales"
```

---

## Cierre del proyecto

- [ ] Suite completa, lint, tipos filtrados vacíos y build en verde.
- [ ] Cobertura medida sobre los **dos** archivos reales, con la de DA PORTO **sin cambios**.
- [ ] Revisión con `superpowers:requesting-code-review` antes de fusionar.
- [ ] Fusión de `carril-b/obra-lineal` a `main` con `superpowers:finishing-a-development-branch`.
- [ ] Actualizar `goals/obra-lineal/goal.md` a `estado: cerrado` con los números medidos, y retirar de la spec de P3 el «límite conocido», que deja de serlo.
