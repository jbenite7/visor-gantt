# Cierre de la auditoría fact-by-fact — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los cinco incumplimientos confirmados por la auditoría del 2026-08-04 y la deuda menor asociada, cada uno con prueba automatizada.

**Architecture:** Un módulo nuevo de clasificación de familias (`activityFamily.ts`) consumido por LOB y Unidad Típica; corrección del consumo cliente de `/api/import-mpp`; sustitución del borrado E2E por aislamiento con identificador de corrida; y cobertura de test para los mecanismos ya implementados pero no probados.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Jest + Testing Library, Playwright, PostgreSQL.

## Global Constraints

- Toda la aplicación activa vive en `v2/`. No crear rutas legacy ni implementaciones paralelas.
- Prueba válida es código o test automatizado. Una captura PNG nunca cierra un fact.
- Ningún goal se marca cerrado sin salida real de `npm test`, `npm run lint` y `npm run build`.
- El español de la interfaz va sin tildes en los identificadores (`data-testid`), con tildes en el texto visible, siguiendo el código existente.
- No tocar el motor de scheduling: `recalculateSchedule` y el CPM quedan intactos.
- Commits pequeños, uno por tarea, en español, con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Errores de importación visibles en la aplicación

**Files:**
- Modify: `v2/src/components/upload/HomeMppUploadAction.tsx:31-50`
- Test: `v2/src/components/upload/__tests__/HomeMppUploadAction.test.tsx`

**Interfaces:**
- Consumes: `POST /api/import-mpp`, que responde 303 con `Location` en éxito y `{ error: string }` con status 400, 413, 500 o el del parser en fallo.
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `HomeMppUploadAction.test.tsx`:

```tsx
test("muestra el error del servidor dentro de la pagina y rehabilita el boton", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ error: "No se pudo guardar el proyecto importado" }),
  }) as unknown as typeof fetch;

  render(<HomeMppUploadAction />);
  selectFile("cronograma.mpp");

  expect(
    await screen.findByText("No se pudo guardar el proyecto importado"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button")).not.toBeDisabled();
  expect(screen.getByRole("button")).toHaveTextContent("Subir Archivo .mpp");
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- --runInBand src/components/upload/__tests__/HomeMppUploadAction.test.tsx`
Expected: FAIL — el componente usa `requestSubmit()` y nunca llama a `fetch`, así que el texto del error no aparece.

- [ ] **Step 3: Implementar la intercepción en cliente**

En `HomeMppUploadAction.tsx`, importar `useRouter` de `next/navigation` y reemplazar `handleFile` y la apertura del `<form>`:

```tsx
const router = useRouter();

const handleFile = async (file: File) => {
  const validationError = validateMppFile(file);
  if (validationError) {
    setError(validationError);
    return;
  }

  setIsProcessing(true);
  setError(null);

  try {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/import-mpp", {
      method: "POST",
      body,
      redirect: "manual",
    });

    if (response.ok || response.type === "opaqueredirect") {
      router.push(response.url || "/");
      return;
    }

    const payload = await response.json().catch(() => null);
    setError(payload?.error ?? "No se pudo importar el archivo .mpp");
  } catch {
    setError("No se pudo conectar con el servidor de importacion");
  } finally {
    setIsProcessing(false);
  }
};
```

Cambiar el `<form>` para que no navegue de forma nativa:

```tsx
<form
  ref={formRef}
  onSubmit={(event) => event.preventDefault()}
  className={className}
>
```

El `<input>` conserva `name="file"`; el resto del componente no cambia.

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `npm test -- --runInBand src/components/upload/__tests__/HomeMppUploadAction.test.tsx`
Expected: PASS, incluidos los tests previos de validación en cliente.

- [ ] **Step 5: Cubrir los otros cuatro caminos de error**

Añadir un test parametrizado con los status 400 (archivo inválido), 400 (extensión), 413 (tamaño) y el del parser, verificando en cada caso que el mensaje aparece en pantalla. Reutilizar el mock de `fetch` del Step 1 cambiando `status` y `error`.

- [ ] **Step 6: Ejecutar y commitear**

```bash
npm test -- --runInBand src/components/upload/__tests__/HomeMppUploadAction.test.tsx
npm run lint
git add src/components/upload/
git commit -m "fix(import): mostrar errores de importacion dentro de la app

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Módulo de clasificación de familias

**Files:**
- Create: `v2/src/lib/scheduling/activityFamily.ts`
- Test: `v2/src/lib/scheduling/activityFamily.test.ts`

**Interfaces:**
- Consumes: `GanttTask` de `@/components/gantt/types` (campos `name`, `wbs`, `id`).
- Produces: `classifyActivityFamily(task, context?)` que devuelve `ActivityFamilyResult`, y el tipo `ActivityFamily`. Las tareas 3 y 4 consumen ambos.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
import { classifyActivityFamily } from "./activityFamily";
import type { GanttTask } from "@/components/gantt/types";

function task(partial: Partial<GanttTask>): GanttTask {
  return {
    id: 1,
    name: "Actividad",
    start: new Date("2026-01-01"),
    finish: new Date("2026-01-02"),
    progress: 0,
    dependencies: [],
    ...partial,
  } as GanttTask;
}

describe("classifyActivityFamily", () => {
  test("el WBS gana sobre el nombre de la tarea", () => {
    const result = classifyActivityFamily(
      task({ name: "Piso 3", wbs: "1.2.4" }),
      { breadcrumb: ["Torre 1", "Redes MEP", "Piso 3"] },
    );
    expect(result.family).toBe("Redes MEP");
    expect(result.matchedBy).toBe("breadcrumb");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test("una palabra ambigua sin respaldo de WBS no decide familia", () => {
    const result = classifyActivityFamily(task({ name: "Piso 3" }));
    expect(result.family).toBeNull();
    expect(result.matchedBy).toBe("none");
    expect(result.reviewReason).toMatch(/clasificaci/i);
  });

  test("el nombre decide cuando no hay senal de WBS", () => {
    const result = classifyActivityFamily(
      task({ name: "Mamposteria de fachada" }),
    );
    expect(result.family).toBe("Arquitectura");
    expect(result.matchedBy).toBe("name");
  });

  test("un empate entre familias marca revision", () => {
    const result = classifyActivityFamily(
      task({ name: "Instalacion electrica y acabado de muros" }),
    );
    expect(result.reviewReason).toBeTruthy();
    expect(result.confidence).toBeLessThan(0.8);
  });

  test.each(["Piso", "Torre", "Staff", "Retiro", "Ejes", "Zona"])(
    "la palabra ambigua %s nunca decide familia por si sola",
    (word) => {
      const result = classifyActivityFamily(task({ name: `${word} 2` }));
      expect(result.family).toBeNull();
    },
  );
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- --runInBand src/lib/scheduling/activityFamily.test.ts`
Expected: FAIL con "Cannot find module './activityFamily'".

- [ ] **Step 3: Implementar el módulo**

```ts
import type { GanttTask } from "@/components/gantt/types";

export type ActivityFamily =
  | "Estructura"
  | "Arquitectura"
  | "Redes MEP"
  | "Urbanismo"
  | "Preliminares";

export type FamilyMatchSource = "wbs" | "breadcrumb" | "name" | "none";

export interface ActivityFamilyResult {
  family: ActivityFamily | null;
  matchedBy: FamilyMatchSource;
  confidence: number;
  breadcrumbLevel: number | null;
  reviewReason?: string;
}

export interface ActivityFamilyContext {
  breadcrumb?: string[];
}

const FAMILY_RULES: Array<{ family: ActivityFamily; regex: RegExp }> = [
  { family: "Estructura", regex: /\b(?:estructura|cimentaci|columna|viga|losa|placa|pantalla|concreto|acero)\b/i },
  { family: "Arquitectura", regex: /\b(?:arquitectur|mamposter|acabado|enchape|pintura|carpinter|fachada|muro|piso ceramic)\b/i },
  { family: "Redes MEP", regex: /\b(?:mep|hidraul|sanitar|electric|electrico|ventilaci|aire acondicionado|gas|red(?:es)? interior)\b/i },
  { family: "Urbanismo", regex: /\b(?:urbanismo|via|vias|zona(?:s)? comun|exterior|paisajismo|andenes?)\b/i },
  { family: "Preliminares", regex: /\b(?:preliminar|descapote|localizaci|campamento|cerramiento|demolici)\b/i },
];

const AMBIGUOUS_WORDS = /\b(?:piso|torre|staff|retiro|ejes?|zona)\b/i;

const HIGH_CONFIDENCE = 0.9;
const NAME_CONFIDENCE = 0.75;
const TIE_CONFIDENCE = 0.4;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function matchFamilies(text: string): ActivityFamily[] {
  const normalized = normalize(text);
  return FAMILY_RULES.filter((rule) => rule.regex.test(normalized)).map(
    (rule) => rule.family,
  );
}

export function classifyActivityFamily(
  task: GanttTask,
  context: ActivityFamilyContext = {},
): ActivityFamilyResult {
  const breadcrumb = context.breadcrumb ?? [];

  for (let level = breadcrumb.length - 1; level >= 0; level -= 1) {
    const matches = matchFamilies(breadcrumb[level]);
    if (matches.length === 1) {
      return {
        family: matches[0],
        matchedBy: "breadcrumb",
        confidence: HIGH_CONFIDENCE,
        breadcrumbLevel: level,
      };
    }
  }

  const wbsMatches = task.wbs ? matchFamilies(task.wbs) : [];
  if (wbsMatches.length === 1) {
    return {
      family: wbsMatches[0],
      matchedBy: "wbs",
      confidence: HIGH_CONFIDENCE,
      breadcrumbLevel: null,
    };
  }

  const nameMatches = matchFamilies(task.name);

  if (nameMatches.length === 1) {
    return {
      family: nameMatches[0],
      matchedBy: "name",
      confidence: NAME_CONFIDENCE,
      breadcrumbLevel: null,
    };
  }

  if (nameMatches.length > 1) {
    return {
      family: null,
      matchedBy: "none",
      confidence: TIE_CONFIDENCE,
      breadcrumbLevel: null,
      reviewReason: `El nombre coincide con varias familias (${nameMatches.join(", ")}). Revisa la clasificacion manualmente.`,
    };
  }

  if (AMBIGUOUS_WORDS.test(normalize(task.name))) {
    return {
      family: null,
      matchedBy: "none",
      confidence: 0,
      breadcrumbLevel: null,
      reviewReason:
        "El nombre solo contiene una referencia de ubicacion. Falta clasificacion por WBS o capitulo.",
    };
  }

  return {
    family: null,
    matchedBy: "none",
    confidence: 0,
    breadcrumbLevel: null,
    reviewReason: "Ninguna regla de familia coincide. Revisa la clasificacion manualmente.",
  };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- --runInBand src/lib/scheduling/activityFamily.test.ts`
Expected: PASS, los 9 casos.

- [ ] **Step 5: Commitear**

```bash
git add src/lib/scheduling/activityFamily.ts src/lib/scheduling/activityFamily.test.ts
git commit -m "feat(scheduling): agregar clasificador de familias de actividad

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Consumir el clasificador desde LOB

**Files:**
- Modify: `v2/src/lib/scheduling/lob.ts` (tipo `ActivityMapping:314`, `generateLOBFromTasks:335`)
- Modify: `v2/src/components/charts/LineOfBalance.tsx`
- Test: `v2/src/lib/scheduling/lob.test.ts`

**Interfaces:**
- Consumes: `classifyActivityFamily`, `ActivityFamilyResult` de Task 2.
- Produces: `ActivityMapping` extendido con el campo `family: ActivityFamilyResult`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `lob.test.ts`:

```ts
test("cada actividad del LOB expone su familia y procedencia", () => {
  const result = generateLOBFromTasks([
    task({ id: 1, name: "Columnas piso 1", wbs: "1.1" }),
    task({ id: 2, name: "Columnas piso 2", wbs: "1.2" }),
    task({ id: 3, name: "Columnas piso 3", wbs: "1.3" }),
  ]);

  const [first] = result.mappings;
  expect(first.family.family).toBe("Estructura");
  expect(first.family.matchedBy).toBeDefined();
  expect(first.family.confidence).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- --runInBand src/lib/scheduling/lob.test.ts`
Expected: FAIL — `first.family` es `undefined`.

- [ ] **Step 3: Extender el tipo y poblarlo**

En `lob.ts`, importar el clasificador y ampliar `ActivityMapping`:

```ts
import { classifyActivityFamily, type ActivityFamilyResult } from "./activityFamily";

export interface ActivityMapping {
  // ...campos existentes sin cambios...
  family: ActivityFamilyResult;
}
```

En `generateLOBFromTasks`, al construir cada mapping, calcular la familia pasando como breadcrumb la ruta de tareas resumen ancestras de la tarea (derivada del `wbs`, tomando los nombres de las tareas cuyo `wbs` es prefijo del de la tarea actual).

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- --runInBand src/lib/scheduling/lob.test.ts`
Expected: PASS.

- [ ] **Step 5: Mostrar familia y revisión en la vista**

En `LineOfBalance.tsx`, junto a la etiqueta de cada línea, mostrar la familia cuando exista y un indicador discreto de revisión cuando `family.reviewReason` esté presente, usando los tokens del sistema (`--color-text-secondary`, `--aia-alert-main`). No inventar colores nuevos.

- [ ] **Step 6: Ejecutar todo y commitear**

```bash
npm test -- --runInBand src/lib/scheduling/ src/components/charts/
npm run lint
git add src/lib/scheduling/lob.ts src/lib/scheduling/lob.test.ts src/components/charts/LineOfBalance.tsx
git commit -m "feat(lob): clasificar actividades por familia con procedencia y confianza

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Consumir el clasificador desde Unidad Típica y unificar UNIT_PATTERNS

**Files:**
- Create: `v2/src/lib/scheduling/unitPatterns.ts`
- Modify: `v2/src/lib/scheduling/typicalUnit.ts:4-7,42-51`
- Modify: `v2/src/lib/scheduling/lob.ts:388` (usar el módulo compartido)
- Modify: `v2/src/components/views/TypicalUnitView.tsx`
- Test: `v2/src/lib/scheduling/typicalUnit.test.ts`

**Interfaces:**
- Consumes: `classifyActivityFamily` de Task 2.
- Produces: `extractUnitLabel(text)` en `unitPatterns.ts`, usado por `lob.ts` y `typicalUnit.ts`.

- [ ] **Step 1: Escribir el test que falla**

```ts
test("cada grupo de unidad tipica expone la familia de sus actividades", () => {
  const analysis = analyzeTypicalUnits([
    task({ id: 1, name: "Instalacion hidraulica piso 1", wbs: "1.1" }),
    task({ id: 2, name: "Instalacion hidraulica piso 2", wbs: "1.2" }),
    task({ id: 3, name: "Instalacion hidraulica piso 3", wbs: "1.3" }),
  ]);

  expect(analysis.groups[0].family.family).toBe("Redes MEP");
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- --runInBand src/lib/scheduling/typicalUnit.test.ts`
Expected: FAIL — `groups[0].family` es `undefined`.

- [ ] **Step 3: Crear el módulo compartido de patrones de unidad**

`UNIT_PATTERNS` está duplicado hoy en `lob.ts:388` y `typicalUnit.ts:4`, con listas distintas. Unificar en `unitPatterns.ts`:

```ts
export interface UnitMatch {
  label: string;
  value: string;
}

const UNIT_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "Piso", regex: /\b(?:piso|nivel|planta|n)\s*[-#:]?\s*([a-z]?\d+)\b/i },
  { label: "Torre", regex: /\b(?:torre|bloque)\s*[-#:]?\s*([a-z0-9]+)\b/i },
  { label: "Apartamento", regex: /\b(?:apartamento|apto|unidad)\s*[-#:]?\s*([a-z0-9]+)\b/i },
  { label: "Zona", regex: /\b(?:zona|sector|area)\s*([a-z0-9]+)\b/i },
  { label: "Lote", regex: /\b(?:lote|manzana)\s*([a-z0-9]+)\b/i },
  { label: "Tramo", regex: /\b(?:tramo|frente)\s*([a-z0-9]+)\b/i },
  { label: "Etapa", regex: /\b(?:etapa|fase)\s*([a-z0-9]+)\b/i },
];

export function extractUnitLabel(text: string): UnitMatch | null {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const pattern of UNIT_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (match?.[1]) {
      return { label: pattern.label, value: match[1].toUpperCase() };
    }
  }
  return null;
}
```

Reemplazar en `typicalUnit.ts` el uso interno de `UNIT_PATTERNS` dentro de `extractLevel` por `extractUnitLabel`, y en `lob.ts` el bloque de la línea 388.

- [ ] **Step 4: Añadir la familia a TypicalUnitGroup**

En `typicalUnit.ts`, extender la interfaz:

```ts
export interface TypicalUnitGroup {
  // ...campos existentes...
  family: ActivityFamilyResult;
}
```

Calcularla en `analyzeTypicalUnits` clasificando la primera actividad representativa del grupo.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test -- --runInBand src/lib/scheduling/typicalUnit.test.ts src/lib/scheduling/lob.test.ts`
Expected: PASS ambos. Si `lob.test.ts` falla por el cambio de patrones, ajustar las expectativas del test a las etiquetas unificadas y dejar constancia en el commit.

- [ ] **Step 6: Mostrar la familia en la vista y commitear**

En `TypicalUnitView.tsx`, mostrar la familia del grupo y el motivo de revisión cuando exista.

```bash
npm test -- --runInBand src/lib/scheduling/ src/components/views/
npm run lint
git add src/lib/scheduling/ src/components/views/TypicalUnitView.tsx
git commit -m "feat(unidad-tipica): clasificar grupos por familia y unificar patrones de unidad

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Conservar los proyectos E2E

**Files:**
- Create: `v2/e2e/helpers/runId.ts`
- Modify: los 9 specs con `DELETE FROM projects`: `dependency-visual-persistence`, `final-visual-audit`, `hierarchy-visual-persistence`, `matrix-deep-project-evidence`, `matrix-new-project`, `mpp-import-matrix-runtime`, `planning-assistant-runtime`, `ui-settings-persistence`, `what-if-persistence`

**Interfaces:**
- Produces: `e2eRunId()` y `e2eProjectName(prefix, detail?)`, consumidos por todos los specs.

- [ ] **Step 1: Crear el helper**

```ts
const RUN_ID = `run-${process.env.PLAYWRIGHT_RUN_ID ?? Date.now().toString(36)}`;

export function e2eRunId(): string {
  return RUN_ID;
}

export function e2eProjectName(prefix: string, detail?: string): string {
  return [prefix, RUN_ID, detail].filter(Boolean).join(" ");
}
```

`RUN_ID` se evalúa una vez por proceso, así que todos los specs de una misma corrida comparten identificador y ninguna corrida colisiona con otra.

- [ ] **Step 2: Migrar un spec y verificar**

Empezar por `hierarchy-visual-persistence.spec.ts`: eliminar la línea 156 (`DELETE FROM projects...`) y sustituir la 256 por `const projectName = e2eProjectName(E2E_PROJECT_PREFIX);`.

Run: `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/hierarchy-visual-persistence.spec.ts --project=chromium`
Expected: PASS, y el proyecto sigue en la base al terminar.

- [ ] **Step 3: Migrar los ocho specs restantes**

Mismo patrón en cada uno. Ningún spec conserva `DELETE FROM projects`.

- [ ] **Step 4: Verificar que ya no queda ningún borrado**

Run: `grep -rn "DELETE FROM projects" e2e/`
Expected: sin resultados salvo en `scripts/clean-e2e-projects.ts` (Task 6), que aún no existe.

- [ ] **Step 5: Commitear**

```bash
git add e2e/
git commit -m "test(e2e): conservar proyectos con identificador por corrida

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Script manual de limpieza E2E

**Files:**
- Create: `v2/scripts/clean-e2e-projects.ts`
- Modify: `v2/package.json` (script `clean:e2e`)

- [ ] **Step 1: Escribir el script**

Debe aceptar `--older-than-days=<n>` (por defecto 7), listar por consola los proyectos que va a borrar con nombre y fecha, y exigir `--yes` para ejecutar el borrado. Sin `--yes`, solo informa. Nunca se invoca desde un test.

- [ ] **Step 2: Verificar en modo informativo**

Run: `npx tsx scripts/clean-e2e-projects.ts --older-than-days=30`
Expected: lista los candidatos y termina sin borrar nada.

- [ ] **Step 3: Commitear**

```bash
git add scripts/clean-e2e-projects.ts package.json
git commit -m "chore(e2e): agregar script manual de limpieza de proyectos

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Persistencia del arrastre de jerarquía

**Files:**
- Modify: `v2/e2e/hierarchy-visual-persistence.spec.ts`

- [ ] **Step 1: Añadir el caso con arrastre real de ratón**

El test debe usar `mouse.move` / `mouse.down` / `mouse.up` recorriendo una distancia horizontal mayor que el umbral de `applyHorizontalHierarchyDrag` (`GanttTable.tsx:625`), no el botón `hierarchy-indent`. Tras el arrastre: verificar `wbs`, `outlineLevel` e `isSummary` en `project_data`, recargar `/project/[id]` y confirmar la jerarquía visible en la tabla.

- [ ] **Step 2: Ejecutar y verificar**

Run: `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/hierarchy-visual-persistence.spec.ts --project=chromium`
Expected: PASS. Si falla, es un hallazgo real sobre el mecanismo de arrastre: documentarlo antes de tocar producción.

- [ ] **Step 3: Commitear**

```bash
git add e2e/hierarchy-visual-persistence.spec.ts
git commit -m "test(e2e): cubrir persistencia del arrastre de jerarquia

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Banner de resumen del proyecto

**Files:**
- Create: `v2/src/components/gantt/toolbar/ProjectSummaryBanner.tsx`
- Create: `v2/src/components/gantt/toolbar/ProjectSummaryBanner.test.tsx`
- Modify: `v2/src/components/views/GanttView.tsx:1043`

**Interfaces:**
- Consumes: la lista de tareas y el nombre de proyecto ya disponibles en `GanttView`.
- Produces: `<ProjectSummaryBanner tasks={...} projectName={...} />`.

- [ ] **Step 1: Escribir el test que falla**

```tsx
test("muestra el resumen del proyecto", () => {
  render(
    <ProjectSummaryBanner
      projectName="Torre 3"
      tasks={[/* dos tareas, una critica */]}
    />,
  );
  expect(screen.getByTestId("project-summary-banner")).toBeInTheDocument();
  expect(screen.getByTestId("project-summary-banner")).toHaveTextContent("Torre 3");
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- --runInBand src/components/gantt/toolbar/ProjectSummaryBanner.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar el banner**

Franja sutil con `data-testid="project-summary-banner"`: nombre del proyecto, total de tareas, rango de fechas y conteo de tareas críticas. Usar `apple-section` y los tokens `--color-text-secondary` / `--color-hairline` ya existentes. Sin fondo saturado: el fact pide "sutil".

- [ ] **Step 4: Montarlo entre toolbar y SplitPane**

En `GanttView.tsx`, insertarlo inmediatamente después de `<ProjectToolbar>` (línea 1043).

- [ ] **Step 5: Ejecutar y commitear**

```bash
npm test -- --runInBand src/components/gantt/
npm run lint && npm run build
git add src/components/gantt/toolbar/ src/components/views/GanttView.tsx
git commit -m "feat(gantt): agregar banner de resumen del proyecto

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Deuda menor de configuración

**Files:**
- Modify: `v2/src/app/globals.css:362-377`
- Modify: `v2/playwright.config.ts:11,17-19,27-38`

- [ ] **Step 1: Añadir el overflow defensivo**

En `globals.css`, añadir `overflow-x: hidden;` y `max-width: 100%;` a las reglas de `html` y `body`. Es una red de seguridad estructural; el check en runtime de `full-app-evidence.spec.ts:626` sigue siendo la verificación real.

- [ ] **Step 2: Alinear Playwright al fact de navegador único**

En `playwright.config.ts`: `workers: 1` siempre (no solo en CI) y retirar los proyectos `firefox` y `webkit`, dejando solo `chromium`. Poner `trace: "on"`, `screenshot: "on"` y `video: "on"` para que la evidencia de cierre no dependa de que un test falle.

- [ ] **Step 3: Verificar y commitear**

```bash
npm run build
git add src/app/globals.css playwright.config.ts
git commit -m "chore(config): alinear overflow defensivo y configuracion de playwright

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Tests de componente faltantes

**Files:**
- Create: `v2/src/components/gantt/table/ColumnSelector.test.tsx`
- Create: `v2/src/components/gantt/dependencies/DependencyPopover.test.tsx`

- [ ] **Step 1: Test de ColumnSelector**

Cubrir: el panel se abre, alterna la visibilidad de una columna, y se reposiciona para no salirse del viewport (`ColumnSelector.tsx:91-92,342-343`), que es el comportamiento del fact.

- [ ] **Step 2: Test de DependencyPopover**

Cubrir: el buscador filtra candidatas (`data-testid="dependency-search"`), la tarea actual nunca aparece entre las candidatas (`DependencyPopover.tsx:59`, protección contra autodependencia) y se puede fijar tipo FS/SS/FF/SF con lag.

- [ ] **Step 3: Ejecutar y commitear**

```bash
npm test -- --runInBand src/components/gantt/
git add src/components/gantt/
git commit -m "test(gantt): cubrir selector de columnas y popover de dependencias

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Actualizar contratos y cerrar goals

**Files:**
- Modify: `goals/correcciones-gantt-matriz-evidencia/goal.md`
- Modify: `goals/paridad-visor-10/goal.md`
- Create: `goals/predecessors-use-row-id/cierre.md`
- Create: `goals/optimize-gantt-recalculation/cierre.md`
- Create: `goals/cierre-auditoria-goals/cierre.md`

- [ ] **Step 1: Ejecutar la verificación completa**

```bash
npm test -- --runInBand
npm run lint
npm run build
DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 MPP_PARSER_URL=http://127.0.0.1:8000 npx playwright test --project=chromium
```

Copiar la salida real. Si algo falla, se arregla antes de escribir ningún acta.

- [ ] **Step 2: Verificar que los proyectos E2E sobrevivieron**

Consultar la base y confirmar que los proyectos de la corrida siguen presentes, identificados por su `runId`. Es la prueba de los facts 8 y 111.

- [ ] **Step 3: Escribir las actas**

Cada acta lleva fecha, qué se cerró, y la salida real de comandos del Step 1. Nada de "verificado con" sin el resultado al lado.

- [ ] **Step 4: Actualizar los facts que cambiaron de significado**

En `correcciones-gantt-matriz-evidencia`, dejar constancia de que los facts 65, 66, 67 y 92 ya tienen implementación, y de cómo quedó resuelta la conservación de proyectos E2E.

- [ ] **Step 5: Commitear y empujar**

```bash
git add goals/ docs/
git commit -m "docs(goals): cerrar goals auditados con evidencia de comandos

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main
```

---

## Self-review

**Cobertura del spec.** Los cinco frentes están cubiertos: importación (Task 1), familias (Tasks 2-4), conservación E2E (Tasks 5-6), arrastre (Task 7), banner (Task 8). La deuda menor está en las Tasks 9-11. La verificación exigida por el spec es el Step 1 de la Task 11.

**Placeholders.** Ninguna tarea dice "manejar errores apropiadamente" o "escribir tests para lo anterior": todos los pasos de código llevan el código. Las Tasks 6, 7 y 10 describen el contenido de los tests en prosa precisa en lugar de código completo porque dependen de fixtures E2E existentes que el implementador tiene delante; el criterio de aceptación está explícito en cada una.

**Consistencia de tipos.** `ActivityFamilyResult` se define en la Task 2 y se consume con ese mismo nombre en las Tasks 3 y 4. `classifyActivityFamily(task, context)` mantiene su firma en los tres usos. `extractUnitLabel` se crea en la Task 4 y reemplaza los dos `UNIT_PATTERNS` duplicados en el mismo paso, de modo que ningún consumidor queda apuntando al símbolo viejo.

**Riesgo identificado.** La Task 4 unifica dos listas de patrones que hoy difieren: la de `lob.ts` incluye Lote y Tramo, la de `typicalUnit.ts` incluye Apartamento. La unión de ambas puede cambiar clasificaciones existentes de unidad, por eso el Step 5 anticipa que `lob.test.ts` podría requerir ajuste de expectativas.
