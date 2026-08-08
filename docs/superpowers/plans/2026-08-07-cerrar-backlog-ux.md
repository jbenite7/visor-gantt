# P2 · Cerrar el backlog de UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 27 experimentos vivos del backlog de UX y conectar lo que está construido pero
inalcanzable, sin que ninguna capacidad desaparezca y sin que ningún control siga prometiendo lo que no hace.

**Architecture:** Cuatro entregas desplegables por separado —Entrada, Tabla y Gantt, Pulido, Lo inalcanzable—
en ese orden, que es el que decidió el grilleo. La lógica que se puede probar sin DOM se extrae a módulos
puros en `src/lib/**` (códigos de error del login, traducción de errores del analizador, coincidencia difusa,
resaltado de impacto), y los componentes se limitan a consumirlos: es lo que hace que los tests prueben
comportamiento y no pintura. `GanttView.tsx` y `ProjectContext.tsx` son territorio de este carril.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · Jest + Testing Library · Playwright (E2E) · Docker Compose.

Spec: [2026-08-07-cerrar-backlog-ux-design.md](../specs/2026-08-07-cerrar-backlog-ux-design.md)
Goal: [goals/cerrar-backlog-ux/goal.md](../../../goals/cerrar-backlog-ux/goal.md)
Depende de: [P1 · No perder trabajo](2026-08-07-no-perder-trabajo.md), fusionado a `main` antes de empezar.

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Sin excepciones.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Comandos de verificación: `npx jest --runInBand`, `npx eslint <archivos>`, `npx tsc --noEmit`, `npx next build`.
- `npx tsc --noEmit` arrastra **38 errores preexistentes** en `*.test.*` y `e2e/`. Filtrar siempre:
  `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`. Ese filtro debe salir **vacío**.
- Copy en **español con tildes**, en lenguaje de obra, sin jerga de infraestructura (ver `docs/POSITIONING.md`).
- No añadir color nuevo: usar los tokens de `src/app/globals.css`. El proyecto **no define** variables
  `--space-*` ni `--font-size-*`; los componentes usan valores literales. No inventar un sistema de espaciado.
- **Ninguna capacidad puede desaparecer**: lo que sale de un sitio queda accesible por otro.
- **Los tests prueban comportamiento real**: un test que pasaría igual con el código roto es un defecto.
- Rama: `p2-cerrar-backlog-ux`, fusionada a `main` al pasar su revisión.
- **Carril A.** No tocar `src/lib/matrix/*`, `src/lib/scheduling/unitPatterns.ts` ni `activityFamily.ts`.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/lib/auth/loginErrors.ts` | **Nuevo.** Códigos de error del login → texto | 1 |
| `src/app/actions/auth.ts`, `src/app/login/page.tsx` | Correo conservado, error bajo el campo | 1 |
| `src/lib/auth/nextPath.ts`, `src/app/upload/layout.tsx` | Retorno al destino y motivo de la salida | 2 |
| `src/lib/import/parserErrors.ts` | **Nuevo.** Errores del analizador en lenguaje de obra | 3 |
| `src/components/upload/HomeMppUploadAction.tsx` | Límite anunciado; errores traducidos | 3 |
| `src/components/upload/WarningList.tsx` | Se conecta al resumen de importación | 4 |
| `src/components/gantt/table/GanttRow.tsx` | Solo lectura de lo calculado; sin descartes mudos | 5, 6 |
| `src/components/gantt/table/EditableCell.tsx` | Señal de editable; Enter/F2 | 7 |
| `src/components/gantt/bars/TaskBar.tsx` | Tiradores visibles; fecha destino | 8 |
| `src/components/gantt/GanttChart.tsx` | Tipo de vínculo real durante el arrastre | 9 |
| `src/lib/state/ProjectContext.tsx` | `lastChangedTaskIds` y avisos de calado | 10, 11 |
| `src/lib/gantt/interactionMode.ts` | **Nuevo.** Qué esconde el modo Simple | 12 |
| `src/lib/gantt/finishEditing.ts` | **Nuevo.** Editar el fin cambia la duración | 13 |
| `src/components/gantt/toolbar/ViewSidebar.tsx` | Menú agrupado; la Matriz entra | 14 |
| `src/lib/gantt/fuzzyMatch.ts` | **Nuevo.** Paleta tolerante a erratas | 15 |
| `src/components/gantt/toolbar/ProjectToolbar.tsx` | Cinta agrupada; destructivas separadas | 16 |
| `src/components/gantt/table/GanttTable.tsx` | Chip con ocultas; WBS sin desfase | 17, 18 |
| `src/components/gantt/ScheduleSkeleton.tsx` | **Nuevo.** Esqueleto de tabla y Gantt | 19 |
| `src/lib/gantt/scheduleExchange.ts` | CSV real con `;` y observaciones | 21 |
| `src/components/views/LastPlannerView.tsx` | **Nuevo.** Consume la API construida | 22 |
| `src/components/views/ObservationsView.tsx` | **Nuevo.** Todas las observaciones del proyecto | 23 |
| `src/lib/scheduling/scurve.ts`, `src/lib/gantt/executiveDashboard.ts` | «Sin datos», fecha de corte, enlaces | 25 |
| `src/lib/scheduling/assignments.ts`, `src/components/views/AssignmentSheetView.tsx` | Alta/baja y sobrecarga | 26 |

---

# ENTREGA A — La entrada (tareas 1 a 4)

## Task 1: El login conserva el correo y el error deja de viajar como texto

**Files:**
- Create: `src/lib/auth/loginErrors.ts`
- Test: `src/lib/auth/loginErrors.test.ts`
- Modify: `src/app/actions/auth.ts:7-24`, `src/app/login/page.tsx:8-59`
- Test: `src/app/login/page.test.tsx` (crear: hoy no existe)

**Interfaces:**
- Produces:
  ```ts
  export type LoginErrorCode = "credenciales" | "faltan-datos" | "sin-cuenta";
  export function loginErrorMessage(code: unknown): string | null;
  ```
- Consumes: `safeNextPath` (`src/lib/auth/nextPath.ts:8-12`), `loginWithPassword`
  (`src/lib/auth/session.ts:66-112`), que ya devuelve los tres casos.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/auth/loginErrors.test.ts`:

```ts
import { loginErrorMessage } from "./loginErrors";

describe("mensajes del login por código, no por texto en la URL (E9)", () => {
  test("traduce cada código a lenguaje de obra", () => {
    expect(loginErrorMessage("credenciales")).toBe(
      "El correo o la contraseña no coinciden.",
    );
    expect(loginErrorMessage("faltan-datos")).toBe(
      "Escribe tu correo y tu contraseña.",
    );
    expect(loginErrorMessage("sin-cuenta")).toBe(
      "No encontramos ninguna cuenta con ese correo. Pide acceso a quien administra el proyecto.",
    );
  });

  test("un código inventado no pinta nada: la URL no puede escribir en pantalla", () => {
    expect(loginErrorMessage("Tu cuenta fue suspendida, llama al 300...")).toBeNull();
    expect(loginErrorMessage("<script>alert(1)</script>")).toBeNull();
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage(42)).toBeNull();
  });
});
```

Crear `src/app/login/page.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

describe("la entrada no castiga al que se equivoca (E9)", () => {
  test("conserva el correo escrito tras un intento fallido", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          error: "credenciales",
          correo: "residente@obra.co",
        }),
      }),
    );

    expect(screen.getByLabelText(/correo/i)).toHaveValue("residente@obra.co");
  });

  test("el error se muestra junto al campo, no como cartel suelto", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "credenciales" }),
      }),
    );

    const error = screen.getByTestId("login-error");
    expect(error).toHaveTextContent("El correo o la contraseña no coinciden.");
    expect(error).toHaveAttribute("role", "alert");
  });

  test("un texto arbitrario en la URL no llega a pantalla", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "Llama al 300 123 4567" }),
      }),
    );

    expect(screen.queryByTestId("login-error")).not.toBeInTheDocument();
    expect(screen.queryByText(/300 123 4567/)).not.toBeInTheDocument();
  });

  test("hay salida para quien no recuerda la contraseña", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText(/quien administra el proyecto/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/auth/loginErrors.test.ts src/app/login/page.test.tsx`
Expected: FAIL — `Cannot find module './loginErrors'`; y en la página, `Unable to find an element by:
[data-testid="login-error"]`, además de que el campo de correo llega vacío porque `page.tsx:53-59` no tiene
`defaultValue`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/auth/loginErrors.ts`:

```ts
/**
 * El mensaje de error del login viajaba como texto dentro de la URL, así que
 * cualquiera podía enviar un enlace que pintara lo que quisiera bajo la marca
 * del producto. Ahora viaja un código y el texto lo pone la app.
 */
export type LoginErrorCode = "credenciales" | "faltan-datos" | "sin-cuenta";

const MENSAJES: Record<LoginErrorCode, string> = {
  credenciales: "El correo o la contraseña no coinciden.",
  "faltan-datos": "Escribe tu correo y tu contraseña.",
  "sin-cuenta":
    "No encontramos ninguna cuenta con ese correo. Pide acceso a quien administra el proyecto.",
};

export function loginErrorMessage(code: unknown): string | null {
  if (typeof code !== "string") return null;
  return MENSAJES[code as LoginErrorCode] ?? null;
}
```

En `src/app/actions/auth.ts`, `loginErrorUrl` pasa a recibir un código y a propagar el correo:

```ts
function loginErrorUrl(code: LoginErrorCode, next: string, correo: string): string {
  const params = new URLSearchParams({ error: code });
  if (next) params.set("next", next);
  if (correo) params.set("correo", correo);
  return `/login?${params.toString()}`;
}
```

`loginWithPassword` (`src/lib/auth/session.ts:66-112`) pasa a devolver también un `code` junto al `error`, con
los tres valores del tipo. `loginAction` lo reenvía a `loginErrorUrl` junto con el correo tecleado.

En `src/app/login/page.tsx`: leer `correo` de `searchParams`, pasar `defaultValue={correo ?? ""}` al input, y
sustituir el `<p>` de las líneas 40-44 por el bloque **bajo el campo de contraseña**:

```tsx
{loginErrorMessage(error) && (
  <p
    data-testid="login-error"
    role="alert"
    className="mt-1 text-sm text-[var(--aia-alert-main)]"
  >
    {loginErrorMessage(error)}
  </p>
)}
```

Y añadir bajo el formulario:

```tsx
<p className="mt-4 text-sm text-[var(--color-text-muted)]">
  ¿Olvidaste tu contraseña? Pídesela a quien administra el proyecto: es quien
  crea y restablece las cuentas de la obra.
</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/auth src/app/login`
Expected: PASS (2 del módulo + 4 de la página + los 3 de `nextPath.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/loginErrors.ts src/lib/auth/loginErrors.test.ts src/lib/auth/session.ts src/app/actions/auth.ts src/app/login/page.tsx src/app/login/page.test.tsx
git commit -m "fix(entrada): conservar el correo y dejar de pintar texto de la URL (E9, E10)"
```

---

## Task 2: Volver a donde ibas y saber por qué te sacó

**Files:**
- Modify: `src/app/upload/layout.tsx:14-17`
- Create: `src/app/project/[id]/layout.tsx` (guard equivalente para el destino más común)
- Test: `src/lib/auth/nextPath.test.ts` (ampliar), `src/app/login/page.test.tsx` (ampliar)

**Interfaces:**
- Produces: `?motivo=sesion-expirada` como segundo código de la pantalla de entrada.
- Consumes: `safeNextPath`, `getCurrentUser` (`src/lib/auth/session.ts:142-175`).

- [ ] **Step 1: Write the failing test**

Ampliar `src/app/login/page.test.tsx`:

```tsx
describe("sesión expirada (E18)", () => {
  test("explica por qué te sacó, no solo pide entrar de nuevo", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          motivo: "sesion-expirada",
          next: "/project/42",
        }),
      }),
    );

    expect(screen.getByTestId("login-motivo")).toHaveTextContent(
      /sesión.*(caducó|expiró)/i,
    );
  });

  test("recuerda el destino para volver a él", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "/project/42" }),
      }),
    );

    const hidden = document.querySelector<HTMLInputElement>(
      'input[name="next"]',
    );
    expect(hidden).toHaveValue("/project/42");
  });

  test("un destino externo no se respeta", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "//evil.example.com" }),
      }),
    );

    const hidden = document.querySelector<HTMLInputElement>(
      'input[name="next"]',
    );
    expect(hidden).toHaveValue("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/login/page.test.tsx -t "sesión expirada"`
Expected: FAIL — el primero con `Unable to find an element by: [data-testid="login-motivo"]`. Los otros dos ya
pasan: `safeNextPath` y el input oculto existen desde E3 (`page.tsx:47`); son la red que impide romperlos.

- [ ] **Step 3: Write minimal implementation**

En `src/app/login/page.tsx`, junto al bloque de error:

```tsx
{motivo === "sesion-expirada" && (
  <p
    data-testid="login-motivo"
    role="status"
    className="mb-4 text-sm text-[var(--color-text-muted)]"
  >
    Tu sesión caducó por seguridad. Entra de nuevo y te devolvemos al
    cronograma que ibas a abrir.
  </p>
)}
```

Crear `src/app/project/[id]/layout.tsx` con el mismo guard que `upload/layout.tsx`, redirigiendo a
`/login?motivo=sesion-expirada&next=/project/${id}`. Y en `src/app/upload/layout.tsx:14-17`, añadir el motivo:
`redirect("/login?motivo=sesion-expirada&next=/upload")`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/login src/lib/auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/login/page.test.tsx src/app/upload/layout.tsx src/app/project/[id]/layout.tsx
git commit -m "feat(entrada): volver al destino y explicar la sesion caducada (E18)"
```

---

## Task 3: El límite se anuncia antes y los errores del analizador se entienden

**Files:**
- Create: `src/lib/import/parserErrors.ts`
- Test: `src/lib/import/parserErrors.test.ts`
- Modify: `src/app/api/import-mpp/route.ts:68-79`, `src/components/upload/HomeMppUploadAction.tsx`
- Test: `src/app/api/import-mpp/route.test.ts` (ampliar), `src/components/upload/__tests__/HomeMppUploadAction.test.tsx` (ampliar)

**Interfaces:**
- Produces: `export function humanParserError(raw: string, status: number): string`
- Consumes: los textos reales del microservicio, transcritos en `services/mpp-parser/utils/validators.py` y
  `utils/mpp_converter.py`.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/import/parserErrors.test.ts`:

```ts
import { humanParserError } from "./parserErrors";

describe("errores del analizador en lenguaje de obra (E5)", () => {
  test("traduce el archivo demasiado grande", () => {
    expect(
      humanParserError("File too large: 84.2MB. Maximum allowed is 50MB.", 422),
    ).toBe(
      "El archivo pesa más de 50 MB. Guárdalo de nuevo desde MS Project sin las líneas base ni los archivos incrustados.",
    );
  });

  test("traduce el archivo que no es un .mpp de verdad", () => {
    expect(
      humanParserError("File is too small to be a valid .mpp file", 422),
    ).toBe(
      "Ese archivo no parece un cronograma de MS Project. Comprueba que sea el .mpp y no un acceso directo.",
    );
  });

  test("traduce el fallo de conversión", () => {
    expect(humanParserError("Could not parse project file", 500)).toBe(
      "No pudimos leer el cronograma. Ábrelo en MS Project y vuelve a guardarlo como .mpp.",
    );
  });

  test("nunca deja escapar el detalle técnico", () => {
    const mensaje = humanParserError(
      "Conversion failed: java.lang.NullPointerException at net.sf.mpxj",
      500,
    );

    expect(mensaje).not.toMatch(/java|Exception|mpxj/i);
    expect(mensaje).toBe(
      "No pudimos leer el cronograma. Ábrelo en MS Project y vuelve a guardarlo como .mpp.",
    );
  });

  test("un error desconocido cae en un mensaje útil, no en el vacío", () => {
    const mensaje = humanParserError("kaboom", 503);

    expect(mensaje).toBe(
      "El servicio que lee los cronogramas no respondió. Inténtalo de nuevo en un minuto.",
    );
  });
});
```

Ampliar `src/components/upload/__tests__/HomeMppUploadAction.test.tsx`:

```tsx
test("anuncia el formato y el límite antes de elegir archivo (E11)", () => {
  render(<HomeMppUploadAction />);

  expect(screen.getByTestId("upload-limits")).toHaveTextContent(
    /\.mpp.*50 MB|50 MB.*\.mpp/i,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/import/parserErrors.test.ts src/components/upload`
Expected: FAIL — `Cannot find module './parserErrors'`, y
`Unable to find an element by: [data-testid="upload-limits"]`: hoy el límite solo aparece **tras** rechazar el
archivo (`HomeMppUploadAction.tsx:17-26`).

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/import/parserErrors.ts`:

```ts
/**
 * El servicio que lee los .mpp responde en inglés y con detalle técnico. Eso
 * no le sirve a quien está en obra: necesita saber qué hacer a continuación.
 * El detalle crudo se queda en el registro del servidor.
 */
export function humanParserError(raw: string, status: number): string {
  const texto = raw.toLowerCase();

  if (texto.includes("too large") || status === 413) {
    return "El archivo pesa más de 50 MB. Guárdalo de nuevo desde MS Project sin las líneas base ni los archivos incrustados.";
  }
  if (texto.includes("too small") || texto.includes("invalid file type")) {
    return "Ese archivo no parece un cronograma de MS Project. Comprueba que sea el .mpp y no un acceso directo.";
  }
  if (texto.includes("could not parse") || texto.includes("conversion failed")) {
    return "No pudimos leer el cronograma. Ábrelo en MS Project y vuelve a guardarlo como .mpp.";
  }
  return "El servicio que lee los cronogramas no respondió. Inténtalo de nuevo en un minuto.";
}
```

En `src/app/api/import-mpp/route.ts:73-79`, sustituir el reenvío del texto crudo por:

```ts
      const errorText = await parserResponse.text();
      console.error("[import-mpp] error del analizador", {
        status: parserResponse.status,
        detail: errorText,
      });
      return NextResponse.json(
        { error: humanParserError(errorText, parserResponse.status) },
        { status: parserResponse.status },
      );
```

En `src/components/upload/HomeMppUploadAction.tsx`, junto al botón de subida:

```tsx
      <p data-testid="upload-limits" className="text-sm text-[var(--color-text-muted)]">
        Archivo de MS Project (.mpp), hasta 50 MB.
      </p>
```

Y corregir de paso las tildes de `validateMppFile` (líneas 17-26): «extensión», «máximo».

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/import src/components/upload src/app/api/import-mpp`
Expected: PASS (5 nuevos + 1 nuevo + los existentes). Comprobar además que no queda texto del microservicio en
pantalla: `grep -rn "errorText" src/app/api/import-mpp/route.ts` solo debe aparecer dentro del `console.error`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/parserErrors.ts src/lib/import/parserErrors.test.ts src/app/api/import-mpp/route.ts src/app/api/import-mpp/route.test.ts src/components/upload/HomeMppUploadAction.tsx src/components/upload/__tests__/HomeMppUploadAction.test.tsx
git commit -m "feat(importacion): limite anunciado y errores del analizador en lenguaje de obra (E11, E5)"
```

---

## Task 4: Lo que se perdió al importar se dice

**Files:**
- Modify: `src/lib/import/importSummary.ts`, `src/app/api/import-mpp/route.ts:94-113`
- Modify: `src/components/import/ImportSummaryBanner.tsx`
- Modify: `src/components/upload/WarningList.tsx` (pasa de huérfano a consumido)
- Test: `src/lib/import/importSummary.test.ts`, `src/components/import/ImportSummaryBanner.test.tsx`

**Interfaces:**
- Produces: `ImportSummary` gana `discardedColumns: string[]`.
- Consumes: `WarningList` (props `{ warnings: string[]; onDismiss?: () => void }`), hoy sin ningún importador.

- [ ] **Step 1: Write the failing test**

En `src/components/import/ImportSummaryBanner.test.tsx`:

```tsx
describe("las pérdidas de la importación se anuncian (E33)", () => {
  test("sin columnas descartadas no se habla de pérdidas", () => {
    render(
      <ImportSummaryBanner
        summary={{ tasks: 12, dependencies: 4, resources: 2, discardedColumns: [] }}
      />,
    );

    expect(screen.queryByTestId("import-warnings")).not.toBeInTheDocument();
  });

  test("con columnas descartadas, se pueden ver cuáles", () => {
    render(
      <ImportSummaryBanner
        summary={{
          tasks: 12,
          dependencies: 4,
          resources: 2,
          discardedColumns: ["Texto27", "Número14"],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("import-warnings-toggle"));

    const warnings = screen.getByTestId("import-warnings");
    expect(warnings).toHaveTextContent("Texto27");
    expect(warnings).toHaveTextContent("Número14");
  });

  test("el aviso dice cuántas se descartaron sin abrirlo", () => {
    render(
      <ImportSummaryBanner
        summary={{
          tasks: 12,
          dependencies: 4,
          resources: 2,
          discardedColumns: ["Texto27", "Número14"],
        }}
      />,
    );

    expect(screen.getByTestId("import-warnings-toggle")).toHaveTextContent("2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/import/ImportSummaryBanner.test.tsx`
Expected: FAIL — TypeScript rechaza `discardedColumns` en `ImportSummary`
(`src/lib/import/importSummary.ts:1-10`), y en ejecución no existe `import-warnings-toggle`.

- [ ] **Step 3: Write minimal implementation**

Ampliar `ImportSummary` con `discardedColumns: string[]` y `parseImportSummary` para leer el parámetro
`descartadas` (lista separada por comas) además de `tareas`/`dependencias`/`recursos`. En la ruta
(`route.ts:94-113`) añadir ese parámetro al redirect, tomando los nombres de columna que
`buildProjectDataFromMpp` no supo mapear.

En `ImportSummaryBanner.tsx`, tras el mensaje del resumen:

```tsx
{summary.discardedColumns.length > 0 && (
  <>
    <button
      type="button"
      data-testid="import-warnings-toggle"
      onClick={() => setShowWarnings((v) => !v)}
      className="underline"
    >
      Ver las {summary.discardedColumns.length} columnas que no se importaron
    </button>
    {showWarnings && (
      <div data-testid="import-warnings">
        <WarningList warnings={summary.discardedColumns} />
      </div>
    )}
  </>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/import src/components/import src/app/api/import-mpp`
Expected: PASS. Comprobar que `WarningList` deja de ser huérfano:
`grep -rn "WarningList" src --include=*.tsx` debe devolver el componente **y** su consumidor.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/importSummary.ts src/lib/import/importSummary.test.ts src/app/api/import-mpp/route.ts src/components/import/ImportSummaryBanner.tsx src/components/import/ImportSummaryBanner.test.tsx
git commit -m "feat(importacion): anunciar las columnas descartadas y conectar WarningList (E33)"
```

---

## Verificación de la Entrega A

- [ ] `npx jest --runInBand` en verde.
- [ ] `npx eslint src/lib/auth src/lib/import src/app/login src/app/actions/auth.ts src/components/upload src/components/import`
- [ ] `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` — vacío.
- [ ] `npx next build`.
- [ ] Navegador: fallar el login a propósito (el correo sigue ahí, el error está bajo el campo); abrir
      `/project/<id>` sin sesión (vuelve a ese proyecto tras entrar); subir un `.txt` renombrado a `.mpp`
      (mensaje en español, sin rastro de Java).

---

# ENTREGA B — Tabla y Gantt (tareas 5 a 13)

## Task 5: Lo que calcula el motor no se edita

**Files:**
- Modify: `src/components/gantt/table/GanttRow.tsx:272-514`
- Test: `src/components/gantt/table/GanttTable.test.tsx`

**Interfaces:**
- Consumes: `EditableCell` prop `readOnly` (`EditableCell.tsx:22,74-78,147`), ya implementada y sin uso real.

- [ ] **Step 1: Write the failing test**

```tsx
describe("lo calculado no se edita (E27)", () => {
  test("la fecha de fin no entra en edición con doble clic", () => {
    render(<GanttTable {...baseProps} tasks={[task({ id: 1 })]} />);

    const fin = screen.getByTestId("cell-finish-1");
    fireEvent.doubleClick(fin);

    expect(fin.querySelector("input")).toBeNull();
    expect(fin).toHaveAttribute("data-read-only", "true");
  });

  test("una fila resumen no deja editar la duración", () => {
    render(
      <GanttTable
        {...baseProps}
        tasks={[task({ id: 1, isSummary: true }), task({ id: 2 })]}
      />,
    );

    const duracion = screen.getByTestId("cell-duration-1");
    fireEvent.doubleClick(duracion);

    expect(duracion.querySelector("input")).toBeNull();
  });

  test("una tarea normal sí deja editar la duración: no se rompe lo que servía", () => {
    render(<GanttTable {...baseProps} tasks={[task({ id: 2 })]} />);

    const duracion = screen.getByTestId("cell-duration-2");
    fireEvent.doubleClick(duracion);

    expect(duracion.querySelector("input")).not.toBeNull();
  });
});
```

**Nota:** `GanttRow` no expone hoy `data-testid` por celda. Antes del Step 2, añadir
`data-testid={`cell-${column.key}-${task.id}`}` al `<td>` que produce `renderCell`. Es un atributo, no cambia
comportamiento. `baseProps` y `task` se toman de los helpers que ya existen en `GanttTable.test.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/table/GanttTable.test.tsx -t "lo calculado no se edita"`
Expected: FAIL — los dos primeros fallan con `expect(received).toBeNull()` recibiendo el `<input>`: hoy
`GanttRow.tsx:376-398` no pasa `readOnly` para `finish`, y ninguna celda condiciona a `task.isSummary`.

- [ ] **Step 3: Write minimal implementation**

En `src/components/gantt/table/GanttRow.tsx`, dentro de `renderCell`, calcular una vez:

```tsx
  // El motor calcula el fin a partir de inicio y duración; y las filas resumen
  // son la suma de sus hijas. Dejarlas editables es prometer un control que el
  // siguiente recálculo va a deshacer.
  const derivado = task.isSummary;
```

y pasar `readOnly` a las celdas: `finish` → `readOnly` (hasta la Tarea 13, que decide si se puede levantar);
`duration`, `start`, `progress` y `predecessors` → `readOnly={derivado}`.

En `EditableCell.tsx`, la celda de solo lectura ya lleva `data-read-only`; añadir en `globals.css` la regla
que la pinta en gris usando `var(--color-text-muted)`, sin color nuevo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt src/components/views/GanttView.test.tsx`
Expected: PASS. **Atención:** si algún test existente edita la duración de una fila resumen, revisarlo: el
cambio es deliberado, y el test debe pasar a afirmar el rechazo, no borrarse.

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/table/GanttRow.tsx src/components/gantt/table/EditableCell.tsx src/components/gantt/table/GanttTable.test.tsx src/app/globals.css
git commit -m "fix(tabla): fin y filas resumen en solo lectura (E27)"
```

---

## Task 6: Nada se descarta en silencio

**Files:**
- Modify: `src/components/gantt/table/GanttRow.tsx:120-146` (predecesoras) y `:207-215` (`parseMppEditValue`)
- Test: `src/components/gantt/table/GanttTable.test.tsx`

**Interfaces:**
- Consumes: `parseNumericFieldInput` (`src/lib/gantt/editValidation.ts`), que ya devuelve
  `{ok:false, reason}`; `onInvalidEdit` → `reportInvalidEdit` (`ProjectContext.tsx:312-314`) → `RejectionToast`.
- Produces: `parseMppEditValue` deja de existir; su lugar lo toma `parseNumericFieldInput`.

- [ ] **Step 1: Write the failing test**

```tsx
describe("ningún dato se descarta sin decirlo (E28)", () => {
  test("texto en un campo numérico se rechaza, no se convierte en cero", () => {
    const onUpdateTask = jest.fn();
    const onInvalidEdit = jest.fn();
    render(
      <GanttTable
        {...baseProps}
        tasks={[task({ id: 1 })]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={onInvalidEdit}
        mppTaskColumns={[
          { key: "costoUnitario", label: "Costo unitario", dataType: "number" },
        ]}
      />,
    );

    const celda = screen.getByTestId("cell-costoUnitario-1");
    fireEvent.doubleClick(celda);
    fireEvent.change(celda.querySelector("input")!, {
      target: { value: "pendiente" },
    });
    fireEvent.keyDown(celda.querySelector("input")!, { key: "Enter" });

    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(onInvalidEdit).toHaveBeenCalledWith(
      expect.stringMatching(/número/i),
    );
  });

  test("una predecesora mal escrita explica el formato en vez de desaparecer", () => {
    const onUpdateTask = jest.fn();
    const onInvalidEdit = jest.fn();
    render(
      <GanttTable
        {...baseProps}
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={onInvalidEdit}
      />,
    );

    const celda = screen.getByTestId("cell-predecessors-2");
    fireEvent.doubleClick(celda);
    fireEvent.change(celda.querySelector("input")!, {
      target: { value: "la primera" },
    });
    fireEvent.blur(celda.querySelector("input")!);

    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(onInvalidEdit).toHaveBeenCalledWith(
      expect.stringMatching(/1FS|formato/i),
    );
  });

  test("una predecesora bien escrita sigue funcionando", () => {
    const onUpdateTask = jest.fn();
    render(
      <GanttTable
        {...baseProps}
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        onUpdateTask={onUpdateTask}
        onInvalidEdit={jest.fn()}
      />,
    );

    const celda = screen.getByTestId("cell-predecessors-2");
    fireEvent.doubleClick(celda);
    fireEvent.change(celda.querySelector("input")!, {
      target: { value: "1FS+2" },
    });
    fireEvent.blur(celda.querySelector("input")!);

    expect(onUpdateTask).toHaveBeenCalledWith(
      2,
      "dependencies",
      expect.arrayContaining([
        expect.objectContaining({ from: 1, to: 2, type: "FS", lag: 2 }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/table/GanttTable.test.tsx -t "ningún dato se descarta"`
Expected: FAIL — el primero, porque `parseMppEditValue` (`GanttRow.tsx:207-215`) devuelve `0` y **sí** llama a
`onUpdateTask`; el segundo, porque el `continue` mudo de la línea 134 hace que se guarde un array vacío sin
avisar. El tercero pasa: es la red de seguridad.

- [ ] **Step 3: Write minimal implementation**

Borrar `parseMppEditValue` y, en el `default` del switch (líneas 486-514), usar:

```tsx
  const parsed = parseNumericFieldInput(raw);
  if (!parsed.ok) {
    onInvalidEdit?.(parsed.reason);
    return;
  }
  onUpdateTask!(task.id, `mppFields:${sourceKey}`, parsed.value);
```

En `parsePredecessors` (líneas 120-146), sustituir el `continue` por acumular los tokens no reconocidos y, si
hay alguno, devolver el motivo en vez de la lista:

```tsx
  if (noReconocidos.length > 0) {
    return {
      ok: false,
      reason: `No entendimos «${noReconocidos.join(", ")}». Escribe el número de la actividad y el tipo de vínculo, por ejemplo 1FS+2.`,
    };
  }
```

y en el `onCommit` de la celda de predecesoras, reportar con `onInvalidEdit` cuando `ok` sea falso.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt src/lib/gantt/editValidation.test.ts`
Expected: PASS (3 nuevos + los existentes).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/table/GanttRow.tsx src/components/gantt/table/GanttTable.test.tsx
git commit -m "fix(tabla): rechazar explicando en vez de convertir texto en cero (E28)"
```

---

## Task 7: La celda editable se reconoce y se abre con el teclado

**Files:**
- Modify: `src/components/gantt/table/EditableCell.tsx:63-78, 140-155`
- Create: `src/components/gantt/table/EditableCell.test.tsx`
- Modify: `src/app/globals.css` (señal de hover)

**Interfaces:**
- Produces: la celda gana `tabIndex={0}` y `onKeyDown` que entra en edición con Enter o F2.
- Consumes: nada nuevo.

- [ ] **Step 1: Write the failing test**

Crear `src/components/gantt/table/EditableCell.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import EditableCell from "./EditableCell";

describe("entrar en edición sin ratón (E37)", () => {
  test("Enter sobre la celda enfocada abre la edición", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    const celda = screen.getByTestId("editable-cell");
    celda.focus();
    fireEvent.keyDown(celda, { key: "Enter" });

    expect(screen.getByDisplayValue("Excavación")).toBeInTheDocument();
  });

  test("F2 hace lo mismo, como en una hoja de cálculo", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    const celda = screen.getByTestId("editable-cell");
    celda.focus();
    fireEvent.keyDown(celda, { key: "F2" });

    expect(screen.getByDisplayValue("Excavación")).toBeInTheDocument();
  });

  test("una celda de solo lectura no se abre con el teclado", () => {
    render(
      <EditableCell type="text" value="Excavación" readOnly onCommit={jest.fn()} />,
    );

    const celda = screen.getByTestId("editable-cell");
    fireEvent.keyDown(celda, { key: "Enter" });

    expect(screen.queryByDisplayValue("Excavación")).not.toBeInTheDocument();
  });

  test("la celda editable es alcanzable con el tabulador; la de solo lectura no", () => {
    const { rerender } = render(
      <EditableCell type="text" value="A" onCommit={jest.fn()} />,
    );
    expect(screen.getByTestId("editable-cell")).toHaveAttribute("tabindex", "0");

    rerender(<EditableCell type="text" value="A" readOnly onCommit={jest.fn()} />);
    expect(screen.getByTestId("editable-cell")).not.toHaveAttribute("tabindex");
  });

  test("el doble clic sigue funcionando: no se pierde nada", () => {
    render(<EditableCell type="text" value="Excavación" onCommit={jest.fn()} />);

    fireEvent.doubleClick(screen.getByTestId("editable-cell"));

    expect(screen.getByDisplayValue("Excavación")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/table/EditableCell.test.tsx`
Expected: FAIL — los cuatro primeros: hoy `EditableCell.tsx:63-69` solo maneja Enter/Escape **dentro** de la
edición, y el div de display (líneas 146-150) no tiene `tabIndex` ni `onKeyDown`. El quinto pasa.

- [ ] **Step 3: Write minimal implementation**

En el `<div>` de display de `EditableCell.tsx`:

```tsx
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={(event) => {
        if (readOnly) return;
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          setEditing(true);
        }
      }}
```

Y en `globals.css`, la señal de que se puede editar, con los tokens existentes:

```css
[data-testid="editable-cell"][data-read-only="false"]:hover,
[data-testid="editable-cell"][data-read-only="false"]:focus-visible {
  outline: 1px dashed var(--color-border);
  outline-offset: -1px;
  cursor: text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/table`
Expected: PASS (5 nuevos + los existentes).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/table/EditableCell.tsx src/components/gantt/table/EditableCell.test.tsx src/app/globals.css
git commit -m "feat(tabla): celda editable reconocible y abrible con Enter o F2 (E37)"
```

---

## Task 8: Tiradores visibles y fecha destino durante el arrastre

**Files:**
- Modify: `src/components/gantt/bars/TaskBar.tsx:186-233`
- Create: `src/components/gantt/bars/TaskBar.test.tsx`
- Create: `src/lib/gantt/dragPreview.ts` + test

**Interfaces:**
- Produces: `export function dragDestinationLabel(start: Date, dayDelta: number): string` — la fecha destino
  ya formateada, probada sin DOM.
- Consumes: `DragState` (`useDragBar.ts`), `ResizeState` (`useResizeBar.ts`), `createProjectDate`.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/gantt/dragPreview.test.ts`:

```ts
import { dragDestinationLabel } from "./dragPreview";
import { createProjectDate } from "@/lib/date/projectDate";

describe("el arrastre dice a dónde va (E30)", () => {
  test("suma los días del gesto a la fecha de inicio", () => {
    expect(
      dragDestinationLabel(createProjectDate("2026-01-05"), 3),
    ).toBe("08/01/2026");
  });

  test("hacia atrás también", () => {
    expect(
      dragDestinationLabel(createProjectDate("2026-01-05"), -2),
    ).toBe("03/01/2026");
  });

  test("sin desplazamiento devuelve la fecha original, no una vacía", () => {
    expect(
      dragDestinationLabel(createProjectDate("2026-01-05"), 0),
    ).toBe("05/01/2026");
  });

  test("cruza el cambio de mes sin inventar días", () => {
    expect(
      dragDestinationLabel(createProjectDate("2026-01-30"), 3),
    ).toBe("02/02/2026");
  });
});
```

Crear `src/components/gantt/bars/TaskBar.test.tsx`:

```tsx
describe("los tiradores se ven (E29)", () => {
  test("al pasar por la barra, los tiradores dejan de ser invisibles", () => {
    const { container } = render(
      <svg>
        <TaskBar {...baseProps} />
      </svg>,
    );

    const barra = screen.getByTestId("task-bar");
    fireEvent.mouseEnter(barra);

    const tirador = screen.getByTestId("task-bar-resize-right");
    expect(tirador).toHaveAttribute("data-visible", "true");
  });

  test("sin ratón encima, los tiradores no distraen", () => {
    render(
      <svg>
        <TaskBar {...baseProps} />
      </svg>,
    );

    expect(screen.getByTestId("task-bar-resize-right")).toHaveAttribute(
      "data-visible",
      "false",
    );
  });

  test("una barra seleccionada muestra los tiradores sin necesidad de ratón", () => {
    render(
      <svg>
        <TaskBar {...baseProps} isSelected />
      </svg>,
    );

    expect(screen.getByTestId("task-bar-resize-right")).toHaveAttribute(
      "data-visible",
      "true",
    );
  });

  test("durante el arrastre se ve la fecha destino, no solo un rectángulo", () => {
    render(
      <svg>
        <TaskBar {...baseProps} dragState={{ isDragging: true, taskId: 1, ghostX: 40, ghostY: 0, dayDelta: 3 }} />
      </svg>,
    );

    expect(screen.getByTestId("drag-destination")).toHaveTextContent("08/01/2026");
  });
});
```

`baseProps` se construye con la tarea de ejemplo del archivo, con `start` en `2026-01-05`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/dragPreview.test.ts src/components/gantt/bars/TaskBar.test.tsx`
Expected: FAIL — `Cannot find module './dragPreview'`; y en `TaskBar`, los tiradores no tienen `data-visible`
(hoy son `fill="transparent"` fijos, líneas 186-216) y no existe `drag-destination` (el fantasma de las
líneas 218-233 es solo un `<rect>` punteado).

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/gantt/dragPreview.ts`:

```ts
import { createProjectDate } from "@/lib/date/projectDate";

/**
 * Durante el arrastre, la sombra ya salta por días —`pixelsToDays` redondea—
 * pero no decía a qué día. Ver la fecha destino es la diferencia entre mover
 * y adivinar.
 */
export function dragDestinationLabel(start: Date, dayDelta: number): string {
  const destino = new Date(start);
  destino.setDate(destino.getDate() + dayDelta);

  const dd = String(destino.getDate()).padStart(2, "0");
  const mm = String(destino.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${destino.getFullYear()}`;
}
```

(`createProjectDate` se importa solo si el test lo exige para el caso de zona horaria; si el cálculo con
`setDate` pasa los cuatro tests, retirar el import — el lint lo señalará.)

En `TaskBar.tsx`: los dos `<rect>` de resize pasan a
`data-visible={isHovered || isSelected}` y a `fill={isHovered || isSelected ? "var(--color-text-muted)" : "transparent"}`,
manteniendo el `cursor: ew-resize` y el ancho de 8 px. Junto al fantasma de arrastre, añadir:

```tsx
              <text
                data-testid="drag-destination"
                x={ghostX + 4}
                y={-4}
                fontSize={10}
                fill="var(--color-text-muted)"
              >
                {dragDestinationLabel(task.start, dragState.dayDelta)}
              </text>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt src/components/gantt/bars src/components/gantt/interaction`
Expected: PASS (4 + 4 nuevos, más `useDragBar.test.ts` y `useResizeBar.test.ts` intactos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/dragPreview.ts src/lib/gantt/dragPreview.test.ts src/components/gantt/bars/TaskBar.tsx src/components/gantt/bars/TaskBar.test.tsx
git commit -m "feat(gantt): tiradores visibles y fecha destino durante el arrastre (E29, E30)"
```

---

## Task 9: El tipo de vínculo que se anuncia es el que se va a crear

**Files:**
- Modify: `src/components/gantt/GanttChart.tsx:397-453`
- Create: `src/components/gantt/interaction/useCreateDependency.test.ts`
- Test: `src/components/gantt/GanttChart.test.tsx`

**Interfaces:**
- Consumes: `inferDepType(fromEdge, toEdge)` (`useCreateDependency.ts:40-48`), hoy solo usada al soltar.
- Produces: la vista previa muestra el tipo real y su nombre en español.

- [ ] **Step 1: Write the failing test**

Crear `src/components/gantt/interaction/useCreateDependency.test.ts`:

```ts
import { inferDepType } from "./useCreateDependency";

describe("tipo de vínculo según los bordes (E35)", () => {
  test("de fin a inicio es FS", () => {
    expect(inferDepType("right", "left")).toBe("FS");
  });
  test("de fin a fin es FF", () => {
    expect(inferDepType("right", "right")).toBe("FF");
  });
  test("de inicio a inicio es SS", () => {
    expect(inferDepType("left", "left")).toBe("SS");
  });
  test("de inicio a fin es SF", () => {
    expect(inferDepType("left", "right")).toBe("SF");
  });
});
```

En `src/components/gantt/GanttChart.test.tsx`:

```tsx
describe("el arrastre de dependencias no miente (E35)", () => {
  test("anuncia FF cuando el gesto va de fin a fin, no FS", () => {
    const { container } = render(<GanttChart tasks={dosTareas} onCreateDependency={jest.fn()} />);

    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[0]);
    fireEvent.mouseDown(screen.getByTestId("dep-point-right"));
    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[1]);
    fireEvent.mouseOver(screen.getAllByTestId("dep-point-right")[1]);

    expect(screen.getByTestId("dep-preview-type")).toHaveTextContent("FF");
  });

  test("el nombre del vínculo se dice en obra, no solo en siglas", () => {
    const { container } = render(<GanttChart tasks={dosTareas} onCreateDependency={jest.fn()} />);

    fireEvent.mouseEnter(screen.getAllByTestId("task-bar")[0]);
    fireEvent.mouseDown(screen.getByTestId("dep-point-right"));

    expect(screen.getByTestId("dep-preview-type")).toHaveTextContent(
      /fin a inicio/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/interaction/useCreateDependency.test.ts src/components/gantt/GanttChart.test.tsx -t "no miente"`
Expected: FAIL — `inferDepType` no está exportada hoy (`useCreateDependency.ts:40`), y `dep-preview-type` no
existe: `GanttChart.tsx:415` decide con `depState.fromEdge === "right" ? "FS" : "SS"`, que nunca puede dar
`FF` ni `SF`.

- [ ] **Step 3: Write minimal implementation**

Exportar `inferDepType` desde `useCreateDependency.ts`. En `GanttChart.tsx:415`, sustituir la línea por
`const type = inferDepType(depState.fromEdge, depState.hoverEdge ?? "left");` —`useCreateDependency` debe
publicar el borde sobre el que está el puntero; si no lo tiene, añadirlo al estado— y pintar junto a la
flecha de vista previa:

```tsx
                <text
                  data-testid="dep-preview-type"
                  x={previewX}
                  y={previewY - 6}
                  fontSize={10}
                  fill="var(--color-text-muted)"
                >
                  {type} · {DEP_TYPE_LABELS[type]}
                </text>
```

con, en el mismo archivo:

```tsx
const DEP_TYPE_LABELS: Record<"FS" | "SS" | "FF" | "SF", string> = {
  FS: "fin a inicio",
  SS: "inicio a inicio",
  FF: "fin a fin",
  SF: "inicio a fin",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt`
Expected: PASS (4 + 2 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/interaction/useCreateDependency.ts src/components/gantt/interaction/useCreateDependency.test.ts src/components/gantt/GanttChart.tsx src/components/gantt/GanttChart.test.tsx
git commit -m "fix(gantt): anunciar el tipo de vinculo real durante el arrastre (E35)"
```

---

## Task 10: Se ve qué se movió y cuánto

**Files:**
- Modify: `src/lib/state/ProjectContext.tsx:133-149, 344, 373, 431` (exponer `lastChangedTaskIds`)
- Test: `src/lib/state/ProjectContext.test.tsx`
- Modify: `src/components/gantt/table/GanttRow.tsx`, `src/components/gantt/bars/TaskBar.tsx`
- Modify: `src/components/views/GanttView.tsx` (recuento)

**Interfaces:**
- Produces: `ProjectContextValue` gana
  `lastChange: { taskIds: (string | number)[]; token: number } | null`.
- Consumes: `changedTaskIds` (`ProjectContext.tsx:133-149`), hoy solo consumida por el registro de auditoría.

- [ ] **Step 1: Write the failing test**

En `src/lib/state/ProjectContext.test.tsx`:

```tsx
describe("el impacto de una edición se puede ver (E31)", () => {
  test("editar una tarea publica qué tareas se movieron, no solo cuál se tocó", () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: wrapperConTareas([
        tarea({ id: 1, duration: 2 }),
        tarea({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
        tarea({ id: 3 }),
      ]),
    });

    act(() => {
      result.current.commitTaskChange(1, "duration", 8);
    });

    expect(result.current.lastChange).not.toBeNull();
    // La 1 cambia y arrastra a la 2; la 3 no depende de nadie.
    expect(result.current.lastChange!.taskIds).toEqual(
      expect.arrayContaining([1, 2]),
    );
    expect(result.current.lastChange!.taskIds).not.toContain(3);
  });

  test("dos ediciones seguidas se distinguen por el token", () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: wrapperConTareas([tarea({ id: 1, duration: 2 })]),
    });

    act(() => result.current.commitTaskChange(1, "duration", 4));
    const primero = result.current.lastChange!.token;
    act(() => result.current.commitTaskChange(1, "duration", 6));

    expect(result.current.lastChange!.token).not.toBe(primero);
  });

  test("una edición rechazada no publica cambios", () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: wrapperConTareas([tarea({ id: 1, duration: 2 })]),
    });

    act(() => result.current.reportInvalidEdit("La duración mínima es 1 día."));

    expect(result.current.lastChange).toBeNull();
  });
});
```

Y en `src/components/views/GanttView.test.tsx`:

```tsx
test("tras editar, la app dice cuántas actividades se movieron (E31)", async () => {
  render(
    <GanttView
      projectId="1"
      tasks={[
        makeTask({ id: 1, name: "Excavación", duration: 2 }),
        makeTask({
          id: 2,
          name: "Cimentación",
          dependencies: [{ from: 1, to: 2, type: "FS" }],
        }),
      ]}
    />,
  );

  const celda = screen.getByTestId("cell-duration-1");
  fireEvent.doubleClick(celda);
  fireEvent.change(celda.querySelector("input")!, { target: { value: "8" } });
  fireEvent.keyDown(celda.querySelector("input")!, { key: "Enter" });

  expect(await screen.findByTestId("impact-summary")).toHaveTextContent(
    /2 actividades se movieron/i,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/state/ProjectContext.test.tsx src/components/views/GanttView.test.tsx -t "impacto"`
Expected: FAIL — `result.current.lastChange` es `undefined`: `changedTaskIds` existe pero su resultado solo
va a `PlanningAuditEvent` (`ProjectContext.tsx:344, 373, 431`). Y `impact-summary` no existe.

- [ ] **Step 3: Write minimal implementation**

En `ProjectContext.tsx`, junto a `lastRejection` (línea 309):

```tsx
  const [lastChange, setLastChange] = useState<{
    taskIds: (string | number)[];
    token: number;
  } | null>(null);
```

En los tres sitios donde ya se llama a `changedTaskIds`, guardar además:

```tsx
    const ids = changedTaskIds(previous, next);
    if (ids.length > 0) setLastChange({ taskIds: ids, token: nextActionToken() });
```

y publicar `lastChange` en el objeto del contexto (junto a `lastRejection`, líneas 875-876 y 914-915).

En `GanttView.tsx`, junto al `RejectionToast` (línea 1483):

```tsx
        {lastChange && (
          <span
            key={lastChange.token}
            data-testid="impact-summary"
            role="status"
            className="gantt-impact-summary"
          >
            {lastChange.taskIds.length === 1
              ? "1 actividad se movió"
              : `${lastChange.taskIds.length} actividades se movieron`}
          </span>
        )}
```

y pasar `changedTaskIds={lastChange?.taskIds ?? []}` a la tabla y al chart, donde `GanttRow` y `TaskBar`
añaden `data-changed="true"` a las filas y barras afectadas. En `globals.css`, la animación de resaltado que
se apaga sola, con `var(--aia-warn-xlight)` si existe o el token de fondo destacado que ya haya — **sin color
nuevo**; comprobar con `grep -n "xlight" src/app/globals.css` cuál está disponible.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/state src/components/views/GanttView.test.tsx`
Expected: PASS (3 + 1 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/ProjectContext.tsx src/lib/state/ProjectContext.test.tsx src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx src/components/gantt/table/GanttRow.tsx src/components/gantt/bars/TaskBar.tsx src/app/globals.css
git commit -m "feat(gantt): resaltar y contar lo que se movio tras una edicion (E31)"
```

---

## Task 11: Los cambios de calado se avisan

**Files:**
- Create: `src/lib/gantt/deepChanges.ts`
- Test: `src/lib/gantt/deepChanges.test.ts`
- Modify: `src/components/views/GanttView.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface DeepChange { projectFinishMoved: number | null; criticalPathChanged: boolean }
  export function detectDeepChanges(before: GanttTask[], after: GanttTask[]): DeepChange;
  ```
- Consumes: `task.isCritical`, que `cpm.ts:60` ya recalcula en cada `recalculateSchedule`.

- [ ] **Step 1: Write the failing test**

```ts
import { detectDeepChanges } from "./deepChanges";
import { createProjectDate } from "@/lib/date/projectDate";

function t(id: number, finish: string, isCritical = false) {
  return {
    id,
    name: `T${id}`,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate(finish),
    duration: 1,
    progress: 0,
    isCritical,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
  };
}

describe("cambios de calado (Bloque B)", () => {
  test("detecta que el fin de obra se corrió, y cuántos días", () => {
    const r = detectDeepChanges([t(1, "2026-03-01")], [t(1, "2026-03-06")]);
    expect(r.projectFinishMoved).toBe(5);
  });

  test("un adelanto se informa en negativo, no se ignora", () => {
    const r = detectDeepChanges([t(1, "2026-03-06")], [t(1, "2026-03-01")]);
    expect(r.projectFinishMoved).toBe(-5);
  });

  test("si el fin no se mueve, no hay nada que avisar", () => {
    const r = detectDeepChanges([t(1, "2026-03-01")], [t(1, "2026-03-01")]);
    expect(r.projectFinishMoved).toBeNull();
  });

  test("detecta que la ruta crítica cambió de actividades", () => {
    const r = detectDeepChanges(
      [t(1, "2026-03-01", true), t(2, "2026-03-01", false)],
      [t(1, "2026-03-01", false), t(2, "2026-03-01", true)],
    );
    expect(r.criticalPathChanged).toBe(true);
  });

  test("misma ruta crítica, aunque cambie el orden del array", () => {
    const r = detectDeepChanges(
      [t(1, "2026-03-01", true), t(2, "2026-03-01", false)],
      [t(2, "2026-03-01", false), t(1, "2026-03-01", true)],
    );
    expect(r.criticalPathChanged).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/deepChanges.test.ts`
Expected: FAIL — `Cannot find module './deepChanges'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GanttTask } from "@/components/gantt/types";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function finDeObra(tasks: GanttTask[]): number | null {
  if (tasks.length === 0) return null;
  return Math.max(...tasks.map((t) => t.finish.getTime()));
}

function rutaCritica(tasks: GanttTask[]): string {
  return tasks
    .filter((t) => t.isCritical)
    .map((t) => String(t.id))
    .sort()
    .join("|");
}

export interface DeepChange {
  /** Días que se corrió el fin de obra; negativo si se adelantó; null si no cambió. */
  projectFinishMoved: number | null;
  criticalPathChanged: boolean;
}

/**
 * Dos cambios merecen que la app hable aunque el usuario no los haya pedido:
 * que se mueva la fecha de entrega y que cambie por dónde pasa la ruta crítica.
 * El resto de recálculos son ruido.
 */
export function detectDeepChanges(
  before: GanttTask[],
  after: GanttTask[],
): DeepChange {
  const antes = finDeObra(before);
  const despues = finDeObra(after);
  const movido =
    antes === null || despues === null || antes === despues
      ? null
      : Math.round((despues - antes) / MS_POR_DIA);

  return {
    projectFinishMoved: movido,
    criticalPathChanged: rutaCritica(before) !== rutaCritica(after),
  };
}
```

En `GanttView.tsx`, guardar las tareas previas en un `useRef`, comparar tras cada recálculo y anunciar junto
al `impact-summary` de la Tarea 10:

```tsx
  {deepChange?.projectFinishMoved != null && (
    <span data-testid="deep-change-finish" role="status">
      {deepChange.projectFinishMoved > 0
        ? `El fin de obra se corrió ${deepChange.projectFinishMoved} días`
        : `El fin de obra se adelantó ${Math.abs(deepChange.projectFinishMoved)} días`}
    </span>
  )}
  {deepChange?.criticalPathChanged && (
    <span data-testid="deep-change-critical" role="status">
      La ruta crítica cambió de actividades
    </span>
  )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/deepChanges.test.ts src/components/views/GanttView.test.tsx`
Expected: PASS (5 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/deepChanges.ts src/lib/gantt/deepChanges.test.ts src/components/views/GanttView.tsx
git commit -m "feat(gantt): avisar cuando cambia el fin de obra o la ruta critica"
```

---

## Task 12: El modo Simple cumple lo que promete

**Files:**
- Create: `src/lib/gantt/interactionMode.ts`
- Test: `src/lib/gantt/interactionMode.test.ts`
- Modify: `src/components/views/GanttView.tsx:274-275, 1363`
- Test: `src/components/views/GanttView.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function simpleModeHides(): { mppColumns: true; planningDropdown: true; whatIf: true };
  export function resolveInteractionMode(settings: UISettings, isFirstVisit: boolean): "simple" | "advanced";
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { resolveInteractionMode } from "./interactionMode";

describe("Simple por defecto solo la primera vez (E36)", () => {
  test("primera visita sin preferencia: empieza en simple", () => {
    expect(resolveInteractionMode({}, true)).toBe("simple");
  });

  test("visitas siguientes sin preferencia: avanzado, como el resto de la app", () => {
    expect(resolveInteractionMode({}, false)).toBe("advanced");
  });

  test("la elección del usuario manda sobre todo lo demás", () => {
    expect(resolveInteractionMode({ interactionMode: "advanced" }, true)).toBe(
      "advanced",
    );
    expect(resolveInteractionMode({ interactionMode: "simple" }, false)).toBe(
      "simple",
    );
  });
});
```

Y en `GanttView.test.tsx`:

```tsx
test("el modo Simple esconde las columnas MPP, no solo un desplegable (E36)", () => {
  render(
    <GanttView
      projectId="1"
      tasks={[makeTask({ id: 1 })]}
      uiSettings={{ interactionMode: "simple" }}
      mppTaskColumns={[
        { key: "costoUnitario", label: "Costo unitario", dataType: "number" },
      ]}
    />,
  );

  expect(screen.queryByText("Costo unitario")).not.toBeInTheDocument();
  expect(screen.queryByTestId("gantt-planning-dropdown")).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId("interaction-mode-advanced"));

  expect(screen.getByText("Costo unitario")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/interactionMode.test.ts src/components/views/GanttView.test.tsx -t "modo Simple"`
Expected: FAIL — módulo inexistente; y en la vista, «Costo unitario» sí aparece en modo simple: hoy
`isAdvancedMode` solo gobierna el `<details>` de la línea 1363.

- [ ] **Step 3: Write minimal implementation**

Crear el módulo con la regla de arriba y, en `GanttView.tsx`, usar `isAdvancedMode` también para filtrar
`mppTaskColumns` antes de pasarlas a `GanttTable`, y para no montar el panel de What-If. El toggle sigue
igual: `handleInteractionModeChange` (líneas 939-947) ya persiste la elección en `uiSettings`.

`isFirstVisit` se deriva de que `uiSettings.interactionMode` sea `undefined` **y** el proyecto no tenga
`planningAuditEvents`: un proyecto con historial no es una primera visita.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/interactionMode.test.ts src/components/views/GanttView.test.tsx`
Expected: PASS. Los tests existentes `autosaves simple interaction mode and hides advanced panels`
(`GanttView.test.tsx:424`) y `hydrates simple interaction mode from project data` (:457) deben seguir en verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/interactionMode.ts src/lib/gantt/interactionMode.test.ts src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx
git commit -m "feat(gantt): el modo Simple esconde de verdad lo avanzado (E36)"
```

---

## Task 13: Editar el fin cambia la duración — o se queda en solo lectura, dicho

**Files:**
- Create: `src/lib/gantt/finishEditing.ts`
- Test: `src/lib/gantt/finishEditing.test.ts`
- Modify: `src/components/gantt/table/GanttRow.tsx:376-398`

**Interfaces:**
- Produces:
  ```ts
  export function durationFromFinish(task: GanttTask, nuevoFin: Date, calendar: ProjectCalendar):
    { ok: true; duration: number } | { ok: false; reason: string };
  ```
- Consumes: `isProjectWorkingDay` (`src/lib/scheduling/projectCalendar.ts`), `MIN_TASK_DURATION`
  (`editValidation.ts`).

**Esta es la tarea de más riesgo del proyecto.** Si al escribir los tests aparece un caso que el motor no
resuelve limpiamente (una restricción de tipo «no empezar antes de», una dependencia que lo impide, un
calendario que deja la duración en cero), **la salida es dejar `finish` en solo lectura** —como quedó en la
Tarea 5— y añadir el texto que lo explica. Esa salida es un resultado válido del plan, no un fracaso: se
documenta en `EXPERIMENTS.md` con el caso concreto que la motivó.

- [ ] **Step 1: Write the failing test**

```ts
import { durationFromFinish } from "./finishEditing";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import { createProjectDate } from "@/lib/date/projectDate";

const tarea = {
  id: 1,
  name: "Excavación",
  start: createProjectDate("2026-01-05"), // lunes
  finish: createProjectDate("2026-01-09"), // viernes
  duration: 5,
  progress: 0,
  isCritical: false,
  isMilestone: false,
  isSummary: false,
  outlineLevel: 1,
  dependencies: [],
};

describe("editar el fin cambia la duración, como MS Project (Bloque B)", () => {
  test("alargar dos días laborables sube la duración a 7", () => {
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-13"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r).toEqual({ ok: true, duration: 7 });
  });

  test("acortar al mismo día de inicio deja la duración en 1", () => {
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-05"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r).toEqual({ ok: true, duration: 1 });
  });

  test("un fin anterior al inicio se rechaza explicando", () => {
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-02"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/antes del inicio/i);
  });

  test("no cuenta los días no laborables del calendario", () => {
    // Del lunes 5 al lunes 12 hay 8 días de calendario pero 6 laborables.
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-12"),
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r).toEqual({ ok: true, duration: 6 });
  });

  test("un fin en día no laborable se rechaza en vez de inventar una duración", () => {
    const r = durationFromFinish(
      tarea,
      createProjectDate("2026-01-10"), // sábado
      DEFAULT_PROJECT_CALENDAR,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no se trabaja/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/finishEditing.test.ts`
Expected: FAIL — `Cannot find module './finishEditing'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";
import { isProjectWorkingDay } from "@/lib/scheduling/projectCalendar";
import { MIN_TASK_DURATION } from "./editValidation";

/**
 * En MS Project, escribir el fin no mueve la tarea: cambia su duración. Es lo
 * que espera quien viene de ahí, y hasta ahora la celda no hacía ni una cosa
 * ni la otra.
 */
export function durationFromFinish(
  task: GanttTask,
  nuevoFin: Date,
  calendar: ProjectCalendar,
): { ok: true; duration: number } | { ok: false; reason: string } {
  if (nuevoFin < task.start) {
    return {
      ok: false,
      reason: "El fin no puede quedar antes del inicio de la actividad.",
    };
  }
  if (!isProjectWorkingDay(nuevoFin, calendar)) {
    return {
      ok: false,
      reason: "Ese día no se trabaja en el calendario del proyecto.",
    };
  }

  let dias = 0;
  const cursor = new Date(task.start);
  while (cursor <= nuevoFin) {
    if (isProjectWorkingDay(cursor, calendar)) dias += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { ok: true, duration: Math.max(dias, MIN_TASK_DURATION) };
}
```

En `GanttRow.tsx:376-398`, la celda `finish` deja de ser `readOnly` **solo si los cinco tests pasan**, y su
`onCommit` llama a `durationFromFinish` y despacha `onUpdateTask(task.id, "duration", r.duration)` o
`onInvalidEdit(r.reason)`.

**Si algún test no se puede hacer pasar sin tocar el motor de cálculo:** revertir la celda a `readOnly` (queda
como la dejó la Tarea 5), añadir bajo la columna el texto «El fin lo calcula el motor a partir del inicio y la
duración», y registrar el caso en `EXPERIMENTS.md`. No forzar el motor.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/finishEditing.test.ts src/components/gantt src/lib/scheduling`
Expected: PASS, **o** la salida degradada documentada. Anotar cuál de las dos ocurrió.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/finishEditing.ts src/lib/gantt/finishEditing.test.ts src/components/gantt/table/GanttRow.tsx
git commit -m "feat(tabla): editar el fin cambia la duracion, con salida degradada documentada"
```

---

## Verificación de la Entrega B

- [ ] `npx jest --runInBand` en verde.
- [ ] `npx eslint src/components/gantt src/lib/gantt src/lib/state/ProjectContext.tsx`
- [ ] `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` — vacío.
- [ ] `npx next build`.
- [ ] Navegador: intentar editar el fin y una fila resumen; teclear texto en un campo numérico MPP; arrastrar
      una barra y leer la fecha destino; crear una dependencia de fin a fin y comprobar que la vista previa
      dice «FF · fin a fin»; editar una duración y ver el recuento de afectadas.

---

# ENTREGA C — Pulido (tareas 14 a 20)

## Task 14: El menú se agrupa y la Matriz entra en él

**Files:**
- Modify: `src/components/gantt/toolbar/ViewSidebar.tsx:24-34, 45-61`
- Test: `src/components/gantt/toolbar/ViewSidebar.test.tsx`

**Interfaces:**
- Produces: `ViewTab` gana `group: "trabajo" | "analisis" | "ajustes"`; `VIEW_TABS` pasa de 9 a 10 entradas.
- Consumes: `ViewType` (ya incluye `"matrix"`, lo consume `GanttView.tsx:31`).

- [ ] **Step 1: Write the failing test**

```tsx
describe("el menú se puede recorrer sin conocer atajos (E14, M27)", () => {
  test("la Matriz está en el menú, no solo tras ⌘K", () => {
    render(<ViewSidebar {...baseProps} />);

    expect(screen.getByTestId("sidebar-view-matrix")).toBeInTheDocument();
  });

  test("las vistas están agrupadas por intención, con títulos", () => {
    render(<ViewSidebar {...baseProps} />);

    expect(screen.getByText("Trabajo")).toBeInTheDocument();
    expect(screen.getByText("Análisis")).toBeInTheDocument();
    expect(screen.getByText("Ajustes")).toBeInTheDocument();
  });

  test("la Matriz vive en Trabajo, junto al Gantt", () => {
    render(<ViewSidebar {...baseProps} />);

    const trabajo = screen.getByTestId("sidebar-group-trabajo");
    expect(within(trabajo).getByTestId("sidebar-view-matrix")).toBeInTheDocument();
    expect(within(trabajo).getByTestId("sidebar-view-gantt")).toBeInTheDocument();
  });

  test("no se pierde ninguna vista por el camino", () => {
    render(<ViewSidebar {...baseProps} />);

    for (const id of [
      "gantt",
      "matrix",
      "executive",
      "resources",
      "lob",
      "scurve",
      "bottlenecks",
      "unidadTipica",
      "calendario",
      "settings",
    ]) {
      expect(screen.getByTestId(`sidebar-view-${id}`)).toBeInTheDocument();
    }
  });

  test("la barra se anuncia como lista de pestañas", () => {
    render(<ViewSidebar {...baseProps} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/toolbar/ViewSidebar.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="sidebar-view-matrix"]`: `VIEW_TABS`
(`ViewSidebar.tsx:24-34`) tiene 9 entradas y ninguna es `matrix`. Además el test existente de la línea 22
(`expect(queryByTestId("sidebar-view-matrix")).not.toBeInTheDocument()`) **fallará**: hay que actualizarlo,
porque afirma exactamente el comportamiento que el grilleo decidió cambiar. Sustituirlo por la aserción
contraria, no borrarlo.

- [ ] **Step 3: Write minimal implementation**

`VIEW_TABS` pasa a llevar `group`, con la Matriz añadida tras el Gantt, y el render agrupa:

```tsx
const GRUPOS = [
  { id: "trabajo", titulo: "Trabajo" },
  { id: "analisis", titulo: "Análisis" },
  { id: "ajustes", titulo: "Ajustes" },
] as const;
```

Reparto: `gantt`, `matrix`, `calendario` → `trabajo`; `executive`, `scurve`, `lob`, `unidadTipica`,
`bottlenecks`, `resources` → `analisis`; `settings` → `ajustes`.
El `<nav>` gana `role="tablist"` y cada grupo un `<div data-testid={`sidebar-group-${id}`}>` con su título.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/toolbar/ViewSidebar.test.tsx src/components/views/GanttView.test.tsx`
Expected: PASS. Ejecutar además los E2E, que consumen la barra:
`npx playwright test --project=chromium` desde `v2/`.

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/toolbar/ViewSidebar.tsx src/components/gantt/toolbar/ViewSidebar.test.tsx
git commit -m "feat(menu): agrupar las vistas y devolver la Matriz al menu (E14, M27)"
```

---

## Task 15: La paleta aguanta una errata y conoce más comandos

**Files:**
- Create: `src/lib/gantt/fuzzyMatch.ts`
- Test: `src/lib/gantt/fuzzyMatch.test.ts`
- Modify: `src/components/views/GanttView.tsx:949-1075, 1332-1341`

**Interfaces:**
- Produces: `export function fuzzyMatches(haystack: string, needle: string): boolean`
- Consumes: `commandActions` (`GanttView.tsx:949-1064`), que pasa de 18 a 21 comandos.

- [ ] **Step 1: Write the failing test**

```ts
import { fuzzyMatches } from "./fuzzyMatch";

describe("la paleta perdona una errata (M36)", () => {
  test("encuentra lo exacto", () => {
    expect(fuzzyMatches("Guardar ahora", "guardar")).toBe(true);
  });

  test("perdona una letra cambiada", () => {
    expect(fuzzyMatches("Guardar ahora", "guardsr")).toBe(true);
  });

  test("perdona una letra que falta", () => {
    expect(fuzzyMatches("Diagrama de red", "diagrma")).toBe(true);
  });

  test("perdona el orden de dos letras", () => {
    expect(fuzzyMatches("Curva S", "cruva")).toBe(true);
  });

  test("no encuentra lo que no está: tolerar no es adivinar", () => {
    expect(fuzzyMatches("Guardar ahora", "presupuesto")).toBe(false);
  });

  test("una consulta vacía no filtra nada", () => {
    expect(fuzzyMatches("Guardar ahora", "")).toBe(true);
  });

  test("ignora tildes y mayúsculas: nadie escribe «Unidad Típica» con tilde en la paleta", () => {
    expect(fuzzyMatches("Unidad Típica", "unidad tipica")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/fuzzyMatch.test.ts`
Expected: FAIL — `Cannot find module './fuzzyMatch'`.

- [ ] **Step 3: Write minimal implementation**

```ts
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Distancia de edición acotada: si supera el tope, corta y devuelve el tope. */
function distancia(a: string, b: string, tope: number): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    let minimoFila = fila[0];
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = temp;
      minimoFila = Math.min(minimoFila, fila[j]);
    }
    if (minimoFila > tope) return tope + 1;
  }
  return fila[b.length];
}

/**
 * La paleta filtraba con `includes`: una errata y no encontraba nada, que es
 * exactamente cuando más falta hace.
 */
export function fuzzyMatches(haystack: string, needle: string): boolean {
  const consulta = normalizar(needle).trim();
  if (!consulta) return true;

  const texto = normalizar(haystack);
  if (texto.includes(consulta)) return true;

  const tope = consulta.length <= 4 ? 1 : 2;
  for (let i = 0; i + consulta.length - tope <= texto.length; i++) {
    const ventana = texto.slice(i, i + consulta.length + tope);
    if (distancia(consulta, ventana, tope) <= tope) return true;
  }
  return false;
}
```

En `GanttView.tsx:1068-1075`, sustituir `haystack.includes(normalizedQuery)` por
`fuzzyMatches(haystack, commandQuery)`. Añadir a `commandActions` los comandos que faltan: exportar el
cronograma, exportar el reporte ejecutivo y abrir Configuración. Y en el botón (línea 1332-1341), añadir
`<kbd>⌘K</kbd>` junto al texto.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/fuzzyMatch.test.ts src/components/views/GanttView.test.tsx`
Expected: PASS (7 nuevos). Los tests existentes de la paleta (`GanttView.test.tsx:189, 204, 220`) deben
seguir en verde: tolerar erratas no puede romper la búsqueda exacta.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/fuzzyMatch.ts src/lib/gantt/fuzzyMatch.test.ts src/components/views/GanttView.tsx
git commit -m "feat(paleta): tolerar erratas, mostrar el atajo y añadir comandos que faltaban (E20, M36)"
```

---

## Task 16: Lo destructivo se separa y Deshacer no desaparece

**Files:**
- Modify: `src/components/gantt/toolbar/ProjectToolbar.tsx:178-248`
- Create: `src/components/gantt/toolbar/ProjectToolbar.test.tsx`

**Interfaces:**
- Consumes: `canUndo`, `canRedo`, `hasSelection`, `onDeleteTask`, ya en las props.

- [ ] **Step 1: Write the failing test**

```tsx
describe("la barra no se reordena bajo el dedo (E15, E34)", () => {
  test("Deshacer y Rehacer siguen ahí cuando no hay historial, apagados", () => {
    render(<ProjectToolbar {...baseProps} canUndo={false} canRedo={false} />);

    expect(screen.getByTestId("toolbar-undo")).toBeDisabled();
    expect(screen.getByTestId("toolbar-redo")).toBeDisabled();
  });

  test("con historial se encienden, en el mismo sitio", () => {
    render(<ProjectToolbar {...baseProps} canUndo canRedo={false} />);

    expect(screen.getByTestId("toolbar-undo")).toBeEnabled();
    expect(screen.getByTestId("toolbar-redo")).toBeDisabled();
  });

  test("Eliminar lleva etiqueta de texto, no solo un icono", () => {
    render(<ProjectToolbar {...baseProps} hasSelection />);

    expect(screen.getByTestId("toolbar-delete")).toHaveTextContent("Eliminar");
  });

  test("Eliminar no queda pegado a Agregar", () => {
    render(<ProjectToolbar {...baseProps} hasSelection />);

    const agregar = screen.getByTestId("toolbar-add");
    const eliminar = screen.getByTestId("toolbar-delete");
    expect(agregar.nextElementSibling).not.toBe(eliminar);
    expect(
      agregar.parentElement!.querySelector(".gantt-project-toolbar__divider"),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/toolbar/ProjectToolbar.test.tsx`
Expected: FAIL — los testids `toolbar-undo`, `toolbar-redo`, `toolbar-add` y `toolbar-delete` no existen; y
el bloque de Deshacer/Rehacer **se desmonta entero** cuando `!canUndo && !canRedo` (`ProjectToolbar.tsx:223`),
así que el primer test no encuentra nada.

- [ ] **Step 3: Write minimal implementation**

Retirar la condición `{(canUndo || canRedo) && (...)}` de la línea 223: los botones se quedan siempre, con su
`disabled` propio, que ya existe (líneas 230, 240). Añadir los cuatro `data-testid`. Al botón de eliminar,
etiqueta de texto «Eliminar» junto al icono, y un `<div className="gantt-project-toolbar__divider" />` entre
el grupo de alta y el destructivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/toolbar`
Expected: PASS (4 nuevos + los de `ViewSidebar` y `BaselineMenu`).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/toolbar/ProjectToolbar.tsx src/components/gantt/toolbar/ProjectToolbar.test.tsx
git commit -m "feat(barra): separar lo destructivo y dejar de desmontar deshacer (E15, E34)"
```

---

## Task 17: El chip de filtro dice cuántas esconde

**Files:**
- Modify: `src/components/gantt/table/GanttTable.tsx:994-1041`
- Test: `src/components/gantt/table/GanttTable.test.tsx`

**Interfaces:**
- Consumes: `filterTasks` (`src/lib/gantt/taskFilters.ts`), `hasActiveTaskFilter` (`GanttTable.tsx:541-542`).

- [ ] **Step 1: Write the failing test**

```tsx
describe("el filtro no esconde nada a escondidas (E7)", () => {
  test("el chip dice cuántas tareas quedaron fuera", () => {
    render(
      <GanttTable
        {...baseProps}
        tasks={[task({ id: 1, isCritical: true }), task({ id: 2 }), task({ id: 3 })]}
        taskFilter={{ type: "critical", text: "" }}
      />,
    );

    expect(screen.getByTestId("gantt-task-filter-count")).toHaveTextContent(
      "2 ocultas",
    );
  });

  test("sin filtro no hay chip que quitar", () => {
    render(
      <GanttTable {...baseProps} tasks={[task({ id: 1 })]} taskFilter={{ type: "all", text: "" }} />,
    );

    expect(screen.queryByTestId("gantt-task-filter-clear")).not.toBeInTheDocument();
  });

  test("una tarea oculta de la que depende una visible se muestra atenuada", () => {
    render(
      <GanttTable
        {...baseProps}
        tasks={[
          task({ id: 1 }),
          task({
            id: 2,
            isCritical: true,
            dependencies: [{ from: 1, to: 2, type: "FS" }],
          }),
        ]}
        taskFilter={{ type: "critical", text: "" }}
      />,
    );

    const fila = screen.getByTestId("gantt-row-1");
    expect(fila).toHaveAttribute("data-filtered-context", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/table/GanttTable.test.tsx -t "el filtro no esconde"`
Expected: FAIL — el contador de la línea 1024-1029 muestra `{visibleTasks.length} / {tasks.length}`, es decir
«1 / 3», no «2 ocultas». Y `data-filtered-context` no existe: hoy la dependencia de una tarea filtrada
simplemente desaparece.

- [ ] **Step 3: Write minimal implementation**

El contador pasa a:

```tsx
  {tasks.length - visibleTasks.length} ocultas de {tasks.length}
```

Y `visibleTasks` incorpora, en gris, las tareas de las que dependa alguna visible, marcadas con
`data-filtered-context="true"` en `GanttRow` y pintadas con `opacity: 0.5`. La flecha de dependencia deja así
de morir en el vacío.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/table`
Expected: PASS (3 nuevos + los existentes del filtro).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/table/GanttTable.tsx src/components/gantt/table/GanttRow.tsx src/components/gantt/table/GanttTable.test.tsx
git commit -m "feat(filtro): contar las ocultas y atenuar las dependencias filtradas (E7)"
```

---

## Task 18: El botón «L1» aplica el nivel 1

**Files:**
- Modify: `src/components/gantt/table/GanttTable.tsx:530-536, 746-780`
- Test: `src/components/gantt/table/GanttTable.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
describe("los niveles WBS hacen lo que dicen (E19)", () => {
  test("el botón L1 aplica el nivel 1", () => {
    const onExpandToLevel = jest.fn();
    render(
      <GanttTable
        {...baseProps}
        tasks={[task({ id: 1, outlineLevel: 1 }), task({ id: 2, outlineLevel: 2 })]}
        onExpandToLevel={onExpandToLevel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "L1" }));

    expect(onExpandToLevel).toHaveBeenCalledWith(1);
  });

  test("con muchos niveles el control sigue siendo botones, no un desplegable", () => {
    render(
      <GanttTable
        {...baseProps}
        tasks={[
          task({ id: 1, outlineLevel: 1 }),
          task({ id: 2, outlineLevel: 2 }),
          task({ id: 3, outlineLevel: 3 }),
          task({ id: 4, outlineLevel: 4 }),
        ]}
      />,
    );

    expect(screen.queryByTestId("expand-level-select")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("expand-level-button")).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/table/GanttTable.test.tsx -t "niveles WBS"`
Expected: FAIL — el primero recibe `2` en vez de `1` (`levelButtons` mapea `label: L${index+1}` a
`level: index+2`, líneas 530-536); el segundo encuentra `expand-level-select`, porque con más de dos niveles
el control cambia de tipo (líneas 759-780).

- [ ] **Step 3: Write minimal implementation**

```tsx
  const levelButtons = useMemo(() => {
    const maxLevel = Math.max(1, ...tasks.map((task) => task.outlineLevel || 1));
    return Array.from({ length: maxLevel }, (_, index) => ({
      label: `L${index + 1}`,
      level: index + 1,
    }));
  }, [tasks]);
```

Y retirar la rama del `<select>` (líneas 759-780): siempre botones. Si con muchos niveles la cinta se
desborda, aplicar el `overflow-x: auto` que ya usa la cinta, sin volver al `<select>`.

**Comprobar el efecto sobre `expandToLevel`:** si esa función espera el valor antiguo, el desfase se ha estado
compensando en dos sitios. Ejecutar `npx jest -t "expandToLevel"` y ajustar el que corresponda para que el
significado sea uno solo: `level` es el nivel WBS visible.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/table src/lib/gantt`
Expected: PASS (2 nuevos + los existentes de expansión).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/table/GanttTable.tsx src/components/gantt/table/GanttTable.test.tsx
git commit -m "fix(wbs): quitar el desfase de la etiqueta y usar siempre botones (E19)"
```

---

## Task 19: Esqueleto al abrir y destello al aceptar

**Files:**
- Create: `src/components/gantt/ScheduleSkeleton.tsx` + `ScheduleSkeleton.test.tsx`
- Modify: `src/app/project/[id]/ProjectView.tsx:199-229`, `src/components/views/GanttView.tsx:14-16`
- Modify: `src/app/globals.css` (destello de celda)

- [ ] **Step 1: Write the failing test**

```tsx
describe("abrir un proyecto no es una pantalla en blanco (E16)", () => {
  test("el esqueleto tiene la forma de lo que va a llegar: tabla y gantt", () => {
    render(<ScheduleSkeleton />);

    expect(screen.getByTestId("skeleton-table")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-chart")).toBeInTheDocument();
  });

  test("se anuncia como carga, para quien no ve la pantalla", () => {
    render(<ScheduleSkeleton />);

    const raiz = screen.getByTestId("schedule-skeleton");
    expect(raiz).toHaveAttribute("role", "status");
    expect(raiz).toHaveAttribute("aria-live", "polite");
    expect(raiz).toHaveTextContent(/cargando/i);
  });

  test("dibuja varias filas, no una sola barra genérica", () => {
    render(<ScheduleSkeleton />);

    expect(
      screen.getAllByTestId("skeleton-row").length,
    ).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/ScheduleSkeleton.test.tsx`
Expected: FAIL — `Cannot find module './ScheduleSkeleton'`. Hoy no existe ningún esqueleto: solo los textos
«Cargando vista…» (`GanttView.tsx:14-16`) y «Cargando cronograma...» (`ProjectView.tsx:199-229`).

- [ ] **Step 3: Write minimal implementation**

Crear el componente con una columna de filas grises a la izquierda y barras de anchos variables a la derecha,
usando `var(--color-border)` y la animación de pulso que se declare en `globals.css`. Sustituir los dos
textos de carga por `<ScheduleSkeleton />`.

Añadir en `globals.css` el destello de E44, que la Tarea 10 ya prepara con `data-changed`:

```css
@keyframes gantt-cell-accepted {
  from { background-color: var(--color-border); }
  to { background-color: transparent; }
}
[data-testid="editable-cell"][data-accepted="true"] {
  animation: gantt-cell-accepted 350ms ease-out;
}
```

y en `EditableCell`, marcar `data-accepted` durante 350 ms tras un `onCommit` aceptado.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/ScheduleSkeleton.test.tsx src/components/gantt/table`
Expected: PASS (3 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/ScheduleSkeleton.tsx src/components/gantt/ScheduleSkeleton.test.tsx src/app/project/[id]/ProjectView.tsx src/components/views/GanttView.tsx src/components/gantt/table/EditableCell.tsx src/app/globals.css
git commit -m "feat(carga): esqueleto de tabla y gantt, y destello al aceptar una edicion (E16, E44)"
```

---

## Task 20: Barrido de limpieza

**Files:**
- Delete: `src/components/upload/MPPUploader.tsx` y su test
- Modify: `src/app/page.tsx` («Nuevo Proyecto» como `<Link>`)
- Modify: el barrido de tildes por todo `src/`

**Va al final de la entrega** para no ensuciar los diffs de fondo, como decidió la spec del supergoal.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function archivosDeUI(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDeUI(ruta, acc);
    else if (/\.tsx?$/.test(entrada) && !/\.test\./.test(entrada)) acc.push(ruta);
  }
  return acc;
}

describe("barrido de tildes (E21)", () => {
  const SIN_TILDE = [
    /"[^"]*\bimportacion\b[^"]*"/,
    /"[^"]*\bextension\b[^"]*"/,
    /"[^"]*\bmaximo\b[^"]*"/,
    /"[^"]*\bsesion\b[^"]*"/,
    /"[^"]*\bnumero\b[^"]*"/,
    /"[^"]*\bobservacion\b[^"]*"/,
  ];

  test("ninguna cadena de interfaz se quedó sin tildes", () => {
    const culpables: string[] = [];
    for (const archivo of archivosDeUI("src")) {
      const contenido = readFileSync(archivo, "utf8");
      for (const patron of SIN_TILDE) {
        if (patron.test(contenido)) culpables.push(`${archivo} → ${patron}`);
      }
    }
    expect(culpables).toEqual([]);
  });
});
```

```ts
describe("no queda codigo muerto de subida (E17)", () => {
  test("MPPUploader ya no existe: la subida real vive en HomeMppUploadAction", () => {
    expect(() => require("@/components/upload/MPPUploader")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/limpieza.test.ts`
Expected: FAIL — la lista de culpables no está vacía (`HomeMppUploadAction.tsx:17-26`, `route.ts:46-63`,
`observations.ts:89-118` entre otros), y `MPPUploader` se importa sin error.

- [ ] **Step 3: Write minimal implementation**

Corregir cada cadena que el test señale. Borrar `src/components/upload/MPPUploader.tsx` y
`src/components/upload/__tests__/MPPUploader.test.tsx`; ajustar
`src/__tests__/integration/mpp-import.test.ts`, que lo referencia, para que pruebe el flujo real de
`/api/import-mpp` en vez del componente muerto — **no borrar ese test**. En `src/app/page.tsx`, «Nuevo
Proyecto» pasa de `<button onClick={router.push}>` a `<Link href="/project/new">`.

**Ninguna capacidad se pierde:** `MPPUploader` no tiene ningún importador de producción; la subida de usuario
vive en `HomeMppUploadAction`, que sigue intacta.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "chore(limpieza): tildes, MPPUploader muerto y Nuevo Proyecto como enlace (E21, E17, E22)"
```

---

## Verificación de la Entrega C

- [ ] `npx jest --runInBand` en verde.
- [ ] `npx playwright test --project=chromium` — la barra de vistas cambió, los E2E la consumen.
- [ ] `npx eslint src` — limpio.
- [ ] `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` — vacío.
- [ ] `npx next build`.
- [ ] Navegador: recorrer el menú agrupado, abrir la Matriz desde él, buscar «cruva» en la paleta, filtrar por
      ruta crítica y leer el contador de ocultas, pulsar «L1».

---

# ENTREGA D — Lo construido e inalcanzable (tareas 21 a 26)

## Task 21: Las exportaciones dicen lo que son

**Files:**
- Modify: `src/lib/gantt/scheduleExchange.ts:41-76`
- Test: `src/lib/gantt/scheduleExchange.test.ts` (crear si no existe)
- Modify: `src/components/gantt/table/GanttTable.tsx:931-964`, `src/components/reports/ExecutivePlanningDashboard.tsx:100-130`

**Interfaces:**
- Produces: `export function tasksToCsv(tasks: GanttTask[], observations: Observation[]): string` con `;`
  como separador; `exportedScheduleFileName` pasa a `.csv`.
- Consumes: `Observation` (`src/lib/observations/observations.ts`).

- [ ] **Step 1: Write the failing test**

```ts
import { tasksToCsv, exportedScheduleFileName } from "./scheduleExchange";

describe("el export del cronograma es un CSV que Excel abre bien (M25)", () => {
  test("separa con punto y coma, que es lo que espera Excel en español", () => {
    const csv = tasksToCsv([tarea({ id: 1, name: "Excavación" })], []);
    expect(csv.split("\n")[0]).toContain("Actividad;Inicio;Fin");
  });

  test("una coma dentro del nombre no parte la columna", () => {
    const csv = tasksToCsv([tarea({ id: 1, name: "Muros, ejes 1 a 4" })], []);
    expect(csv).toContain('"Muros, ejes 1 a 4"');
  });

  test("incluye las observaciones de cada actividad (M31)", () => {
    const csv = tasksToCsv(
      [tarea({ id: 1, name: "Excavación" })],
      [
        {
          id: "o1",
          taskId: 1,
          taskName: "Excavación",
          text: "Falta acero",
          status: "pending",
          createdAt: "2026-08-07T08:00:00.000Z",
        },
      ],
    );

    expect(csv.split("\n")[0]).toContain("Observaciones");
    expect(csv).toContain("Falta acero");
  });

  test("una actividad sin observaciones deja la columna vacía, no la omite", () => {
    const csv = tasksToCsv([tarea({ id: 1 })], []);
    const columnas = csv.split("\n")[1].split(";");
    expect(columnas.length).toBe(csv.split("\n")[0].split(";").length);
  });

  test("el archivo se llama .csv, no .tsv", () => {
    expect(exportedScheduleFileName()).toMatch(/\.csv$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/scheduleExchange.test.ts`
Expected: FAIL — `tasksToCsv` no existe (hoy es `tasksToExcelTsv`, separador `\t`,
`scheduleExchange.ts:41-71`), y `exportedScheduleFileName` devuelve `.tsv` (línea 73-76).

- [ ] **Step 3: Write minimal implementation**

Añadir `tasksToCsv` con `;`, entrecomillado de celdas que contengan `;`, `"` o salto de línea, y una columna
`Observaciones` que junta las de cada tarea con ` · `. Mantener `tasksToExcelTsv` mientras lo consuma alguien;
si nadie lo consume tras esta tarea, borrarlo — el lint lo señalará.

En `GanttTable.tsx`, el botón `excel-copy-export` pasa a decir **«Copiar para Excel»** y `excel-download-export`
**«Descargar CSV»**; ambos usan `tasksToCsv`. En `ExecutivePlanningDashboard.tsx:120`, el botón «PDF» pasa a
decir **«Imprimir o guardar como PDF»**: sigue llamando a `window.print()`, pero ahora lo dice.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt src/components/gantt/table src/components/reports`
Expected: PASS (5 nuevos + los existentes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/scheduleExchange.ts src/lib/gantt/scheduleExchange.test.ts src/components/gantt/table/GanttTable.tsx src/components/reports/ExecutivePlanningDashboard.tsx
git commit -m "fix(exportaciones): CSV real con observaciones y botones que dicen lo que hacen (M25, M31)"
```

---

## Task 22: La API de Last Planner por fin tiene quien la llame

**Files:**
- Create: `src/components/views/LastPlannerView.tsx` + `LastPlannerView.test.tsx`
- Modify: `src/components/gantt/toolbar/ViewSidebar.tsx` (entra en «Trabajo»), `src/components/views/GanttView.tsx`

**Interfaces:**
- Consumes: `POST /api/integrations/last-planner/preview`, cuerpo
  `{ tasks, windowStart?, weeks?, statusDate? }`, respuesta `LastPlannerPreview`
  (`src/lib/integrations/lastPlanner.ts:29-39`): `{ generatedAt, windowStart, windowEnd, weeks[], summary }`.
- Produces: `ViewType` gana `"lastPlanner"`.

- [ ] **Step 1: Write the failing test**

```tsx
describe("los compromisos semanales salen de la API que ya existía (M26)", () => {
  test("llama a la API con las tareas del proyecto", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => preview,
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} statusDate={new Date("2026-08-07")} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/integrations/last-planner/preview");
    expect(JSON.parse(init.body as string).tasks).toHaveLength(1);
  });

  test("pinta las semanas y sus compromisos", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => preview })) as never;

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} statusDate={new Date("2026-08-07")} />);

    expect(await screen.findByText("Excavación eje 3")).toBeInTheDocument();
    expect(screen.getByTestId("lps-summary")).toHaveTextContent("1 compromiso");
  });

  test("una restricción sin responsable se marca, no se esconde", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => preview })) as never;

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} statusDate={new Date("2026-08-07")} />);

    expect(await screen.findByTestId("lps-constraint-sin-responsable")).toBeInTheDocument();
  });

  test("si la API falla, lo dice en vez de quedarse en blanco", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as never;

    render(<LastPlannerView tasks={[tarea({ id: 1 })]} statusDate={new Date("2026-08-07")} />);

    expect(
      await screen.findByText(/no pudimos armar los compromisos/i),
    ).toBeInTheDocument();
  });

  test("sin tareas explica qué falta, no llama a la API", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;

    render(<LastPlannerView tasks={[]} statusDate={new Date("2026-08-07")} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/importa un cronograma/i)).toBeInTheDocument();
  });
});
```

`preview` es un `LastPlannerPreview` de ejemplo con una semana y un compromiso «Excavación eje 3» con una
restricción sin responsable.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/LastPlannerView.test.tsx`
Expected: FAIL — `Cannot find module './LastPlannerView'`. La API existe desde hace tiempo
(`src/app/api/integrations/last-planner/preview/route.ts`) y su único consumidor es su propio test.

- [ ] **Step 3: Write minimal implementation**

Crear la vista: `useEffect` que serializa las tareas (fechas a ISO, como espera `SerializedTask`), llama a la
API, y pinta semanas → compromisos → restricciones. Estados de error y vacío con salida, como los de Curva S
y Línea de Balance, que la propia auditoría calificó de ejemplares. Botón de export reutilizando
`observationsToLpsCsv`.

Añadir `lastPlanner` a `ViewType`, a `VIEW_TABS` (grupo «Trabajo», ver pregunta abierta 1 de la spec) y al
`switch` de vistas de `GanttView.tsx`, con `next/dynamic` como el resto.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/LastPlannerView.test.tsx src/components/gantt/toolbar/ViewSidebar.test.tsx src/app/api/integrations`
Expected: PASS (5 nuevos). Actualizar la aserción de la Tarea 14 que enumera las vistas: ahora son 11.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/LastPlannerView.tsx src/components/views/LastPlannerView.test.tsx src/components/gantt/toolbar/ViewSidebar.tsx src/components/gantt/toolbar/ViewSidebar.test.tsx src/components/views/GanttView.tsx src/types/ui.ts
git commit -m "feat(last-planner): conectar a la app la API que ya estaba construida (M26)"
```

---

## Task 23: Responsable en la observación y vista propia en el menú

**Files:**
- Modify: `src/lib/observations/observations.ts:22-46, 107-118`
- Test: `src/lib/observations/observations.test.ts`
- Create: `src/components/views/ObservationsView.tsx` + test
- Modify: `src/components/gantt/observations/ObservationPanel.tsx`, `ViewSidebar.tsx`, `GanttView.tsx`

**Interfaces:**
- Produces: `Observation` gana `responsible?: string`; `createObservation` lo acepta;
  `observationsToLpsCsv` lo escribe en la columna «Responsable», hoy siempre vacía
  (`observations.ts:108-112`).

- [ ] **Step 1: Write the failing test**

```ts
describe("el responsable de la restricción (M32)", () => {
  test("se guarda cuando se indica", () => {
    const o = createObservation({
      id: "1",
      taskId: 1,
      taskName: "Excavación",
      text: "Falta acero",
      responsible: "Cuadrilla 2",
      createdAt: "2026-08-07T08:00:00.000Z",
    });

    expect(o!.responsible).toBe("Cuadrilla 2");
  });

  test("es opcional: sin él la observación se crea igual", () => {
    const o = createObservation({
      id: "1",
      taskId: 1,
      taskName: "Excavación",
      text: "Falta acero",
      createdAt: "2026-08-07T08:00:00.000Z",
    });

    expect(o).not.toBeNull();
    expect(o!.responsible).toBeUndefined();
  });

  test("el CSV de Last Planner deja de tener la columna Responsable vacía", () => {
    const csv = observationsToLpsCsv([
      {
        id: "1",
        taskId: 1,
        taskName: "Excavación",
        text: "Falta acero",
        responsible: "Cuadrilla 2",
        status: "pending",
        createdAt: "2026-08-07T08:00:00.000Z",
      },
    ]);

    expect(csv.split("\n")[1].split(",")[4]).toBe("Cuadrilla 2");
  });

  test("sin responsable, la columna sale vacía pero la fila conserva sus seis campos", () => {
    const csv = observationsToLpsCsv([
      {
        id: "1",
        taskId: 1,
        taskName: "Excavación",
        text: "Falta acero",
        status: "pending",
        createdAt: "2026-08-07T08:00:00.000Z",
      },
    ]);

    expect(csv.split("\n")[1].split(",")).toHaveLength(6);
  });
});
```

Y en `src/components/views/ObservationsView.test.tsx`:

```tsx
describe("todas las observaciones del proyecto en un sitio", () => {
  test("lista las de todas las actividades, no solo las de una", () => {
    render(<ObservationsView observations={[obs(1, "Falta acero"), obs(2, "Falta andamio")]} onToggle={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getByText("Falta acero")).toBeInTheDocument();
    expect(screen.getByText("Falta andamio")).toBeInTheDocument();
  });

  test("separa lo pendiente de lo atendido", () => {
    render(<ObservationsView observations={[obs(1, "Falta acero"), obs(2, "Ya se resolvió", "done")]} onToggle={jest.fn()} onDelete={jest.fn()} />);

    expect(within(screen.getByTestId("observations-pending")).getByText("Falta acero")).toBeInTheDocument();
    expect(within(screen.getByTestId("observations-done")).getByText("Ya se resolvió")).toBeInTheDocument();
  });

  test("sin observaciones explica el loop, con un ejemplo de obra", () => {
    render(<ObservationsView observations={[]} onToggle={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getByTestId("observations-empty")).toHaveTextContent(/falta acero|eje/i);
  });

  test("se puede exportar el registro completo", () => {
    render(<ObservationsView observations={[obs(1, "Falta acero")]} onToggle={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getByTestId("observations-export-lps")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/observations src/components/views/ObservationsView.test.tsx`
Expected: FAIL — TypeScript rechaza `responsible` en `createObservation` (`observations.ts:27-34`); el tercer
test recibe `""` porque la posición 5 del CSV es un literal vacío (línea 108-112); y
`Cannot find module './ObservationsView'`.

- [ ] **Step 3: Write minimal implementation**

Añadir `responsible?: string` a `Observation` y a `createObservation`, y usarlo en `observationsToLpsCsv`.
En `ObservationPanel.tsx`, un campo «Responsable (opcional)» junto al de texto. Crear `ObservationsView` con
las dos secciones, el estado vacío con ejemplo de obra y los dos exports que ya existen. Añadir la vista al
menú, en «Trabajo».

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/observations src/components/views src/components/gantt/observations`
Expected: PASS (4 + 4 nuevos + los 12 existentes de `observations.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/observations src/components/views/ObservationsView.tsx src/components/views/ObservationsView.test.tsx src/components/gantt/observations/ObservationPanel.tsx src/components/gantt/toolbar/ViewSidebar.tsx src/components/views/GanttView.tsx
git commit -m "feat(observaciones): responsable opcional y vista propia del proyecto (M32)"
```

---

## Task 24: La matriz avisa antes de perder el borrador

**Files:**
- Modify: `src/components/views/MatrixEditorView.tsx:869-879`
- Test: `src/components/views/MatrixEditorView.test.tsx`

**Interfaces:**
- Produces: `MatrixEditorViewProps` gana `onDirtyChange?: (dirty: boolean) => void`, para que `GanttView`
  pueda incluir el borrador en el aviso al cerrar que P1 dejó montado.
- **No toca `src/lib/matrix/*`**: eso es carril B.

- [ ] **Step 1: Write the failing test**

```tsx
describe("el borrador de la matriz no se pierde sin avisar (M28)", () => {
  test("«Deshacer» pasa a llamarse «Descartar cambios»", () => {
    render(<MatrixEditorView {...baseProps} />);

    expect(screen.getByTestId("matrix-discard")).toHaveTextContent(
      "Descartar cambios",
    );
  });

  test("descartar pide confirmación y dice cuánto se pierde", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<MatrixEditorView {...baseProps} />);

    fireEvent.click(screen.getByTestId("matrix-cell-toggle-estructura-piso-1"));
    fireEvent.click(screen.getByTestId("matrix-discard"));

    expect(confirmar).toHaveBeenCalledWith(
      expect.stringMatching(/1 cambio/i),
    );
  });

  test("si el usuario dice que no, el borrador sigue ahí", () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    const { rerender } = render(<MatrixEditorView {...baseProps} />);

    fireEvent.click(screen.getByTestId("matrix-cell-toggle-estructura-piso-1"));
    fireEvent.click(screen.getByTestId("matrix-discard"));

    expect(screen.getByTestId("matrix-dirty")).toBeInTheDocument();
  });

  test("sin cambios, descartar no pregunta nada", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    render(<MatrixEditorView {...baseProps} />);

    fireEvent.click(screen.getByTestId("matrix-discard"));

    expect(confirmar).not.toHaveBeenCalled();
  });

  test("el borrador sucio se anuncia al proyecto", () => {
    const onDirtyChange = jest.fn();
    render(<MatrixEditorView {...baseProps} onDirtyChange={onDirtyChange} />);

    fireEvent.click(screen.getByTestId("matrix-cell-toggle-estructura-piso-1"));

    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/MatrixEditorView.test.tsx -t "no se pierde sin avisar"`
Expected: FAIL — no existe `matrix-discard`; el botón de la línea 871 dice «Deshacer» y clona el plan sin
preguntar nada (líneas 869-872).

- [ ] **Step 3: Write minimal implementation**

Renombrar el botón, añadir el testid, contar los cambios del borrador contra `matrixPlan` y pedir
confirmación con ese número. Publicar `onDirtyChange` cuando el borrador difiera del plan aplicado.
En `GanttView.tsx`, incluir ese estado en `hasPendingChanges`, el que P1 conectó al aviso al cerrar.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/MatrixEditorView.test.tsx src/components/views/GanttView.test.tsx`
Expected: PASS (5 nuevos + los existentes).

- [ ] **Step 5: Commit**

```bash
git add src/components/views/MatrixEditorView.tsx src/components/views/MatrixEditorView.test.tsx src/components/views/GanttView.tsx
git commit -m "feat(matriz): descartar cambios con confirmacion y aviso al salir (M28)"
```

---

## Task 25: El tablero ejecutivo deja de dar verde a un proyecto vacío

**Files:**
- Modify: `src/lib/scheduling/scurve.ts:274-330`
- Test: `src/lib/scheduling/scurve.test.ts`
- Modify: `src/lib/gantt/executiveDashboard.ts:69-118`, `src/components/reports/ExecutivePlanningDashboard.tsx:153-176`
- Test: `src/lib/gantt/executiveDashboard.test.ts`, `src/components/reports/ExecutivePlanningDashboard.test.tsx`

**Interfaces:**
- Produces: `computeEarnedValueSCurve` devuelve `spi: number | null` y `cpi: number | null`;
  `buildExecutivePlanningSummary` acepta `statusDate` y cada indicador lleva `linkTo?: ViewType`.

- [ ] **Step 1: Write the failing test**

```ts
describe("sin datos no se inventa un semáforo verde (M1)", () => {
  test("sin tareas, SPI y CPI no valen 1: valen nada", () => {
    const r = computeEarnedValueSCurve([], [], []);
    expect(r.spi).toBeNull();
    expect(r.cpi).toBeNull();
  });

  test("sin mapeos de presupuesto tampoco se inventan", () => {
    const r = computeEarnedValueSCurve([tarea({ id: 1 })], [], []);
    expect(r.spi).toBeNull();
  });

  test("con datos reales siguen calculándose", () => {
    const r = computeEarnedValueSCurve(tareasConAvance, mapeos, partidas);
    expect(typeof r.spi).toBe("number");
  });
});
```

```tsx
describe("el tablero informa bien o dice que no sabe (M1, M3, M8)", () => {
  test("un proyecto vacío muestra «aún no hay datos», no «Controlado»", () => {
    render(<ExecutivePlanningDashboard summary={resumenVacio} />);

    expect(screen.getByTestId("executive-no-data")).toHaveTextContent(
      /aún no hay datos/i,
    );
    expect(screen.queryByText(/controlado/i)).not.toBeInTheDocument();
  });

  test("muestra a qué día corresponden las cifras", () => {
    render(<ExecutivePlanningDashboard summary={resumenConDatos} />);

    expect(screen.getByTestId("executive-status-date")).toHaveTextContent(
      "07/08/2026",
    );
  });

  test("cada indicador lleva a su detalle", () => {
    const onNavigate = jest.fn();
    render(
      <ExecutivePlanningDashboard summary={resumenConDatos} onNavigate={onNavigate} />,
    );

    fireEvent.click(screen.getByTestId("executive-signal-bottlenecks"));
    expect(onNavigate).toHaveBeenCalledWith("bottlenecks");
  });

  test("el semáforo de avance puede llegar a crítico, como los otros dos", () => {
    render(<ExecutivePlanningDashboard summary={resumenConAvanceMuyBajo} />);

    expect(screen.getByTestId("executive-kpi-progress")).toHaveAttribute(
      "data-health",
      "critical",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/scurve.test.ts src/components/reports`
Expected: FAIL — `computeEarnedValueSCurve` devuelve `{ points: [], cpi: 1, spi: 1 }`
(`scurve.ts:277-280`); no existe `executive-status-date` (`buildExecutivePlanningSummary` ni siquiera recibe
`statusDate`, `executiveDashboard.ts:69-81`); y las tarjetas son `<article>` estáticos sin navegación
(`ExecutivePlanningDashboard.tsx:153-176`).

- [ ] **Step 3: Write minimal implementation**

Cambiar el retorno vacío a `{ points: [], cpi: null, spi: null }` y recorrer los consumidores que el
compilador señale: `executiveDashboard.ts:88-129, 171-178` y `executiveReportExport.ts`. Donde el valor sea
`null`, el tablero muestra «aún no hay datos» en vez de un semáforo.

`buildExecutivePlanningSummary` acepta `statusDate` y lo publica en el resumen; el componente lo pinta con
`data-testid="executive-status-date"`. Las tarjetas de KPI y señal pasan a `<button>` con
`onNavigate?.(view)`, y `GanttView` les pasa `setActiveView`. El umbral de avance gana su tramo crítico,
igual que cronograma y costo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling src/lib/gantt/executiveDashboard.test.ts src/components/reports src/components/views/SCurveView.test.tsx`
Expected: PASS (3 + 4 nuevos + los existentes de Curva S, que consumen el mismo cálculo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/scurve.ts src/lib/scheduling/scurve.test.ts src/lib/gantt/executiveDashboard.ts src/lib/gantt/executiveDashboard.test.ts src/lib/gantt/executiveReportExport.ts src/components/reports/ExecutivePlanningDashboard.tsx src/components/reports/ExecutivePlanningDashboard.test.tsx src/components/views/GanttView.tsx
git commit -m "fix(ejecutivo): sin datos no hay semaforo, con fecha de corte y enlaces al detalle (M1, M3, M8)"
```

---

## Task 26: Asignaciones que se pueden crear, con aviso de sobrecarga

**Files:**
- Modify: `src/lib/scheduling/assignments.ts:55-95` (una sola definición)
- Test: `src/lib/scheduling/assignments.test.ts`
- Modify: `src/components/views/ResourceUsageView.tsx:288`, `src/components/views/AssignmentSheetView.tsx`
- Create: `src/components/views/AssignmentSheetView.test.tsx`

**Interfaces:**
- Produces: `export function wouldOverallocate(assignments, resources, tasks, nueva): OverallocationResult | null`
- Consumes: `detectOverallocation` (`assignments.ts:62`), que ya alimenta Problemas vía
  `detectBottlenecks` (`bottlenecks.ts:58`) y ya tiene tests.

- [ ] **Step 1: Write the failing test**

```ts
describe("una sola definición de sobreasignado (M18)", () => {
  test("la nueva asignación que rebasa el 100% de un día se detecta antes de crearla", () => {
    const aviso = wouldOverallocate(asignacionesExistentes, recursos, tareas, {
      taskId: 2,
      resourceId: "r1",
      units: 100,
    });

    expect(aviso).not.toBeNull();
    expect(aviso!.resourceId).toBe("r1");
  });

  test("una que cabe no genera aviso", () => {
    const aviso = wouldOverallocate([], recursos, tareas, {
      taskId: 2,
      resourceId: "r1",
      units: 50,
    });

    expect(aviso).toBeNull();
  });

  test("usa el mismo umbral diario que Problemas, no uno propio", () => {
    const conNueva = [...asignacionesExistentes, nuevaAsignacion];
    const porProblemas = detectOverallocation(conNueva, recursos, tareas);
    const previo = wouldOverallocate(asignacionesExistentes, recursos, tareas, nuevaAsignacion);

    expect(porProblemas.length > 0).toBe(previo !== null);
  });
});
```

```tsx
describe("armar el proyecto en la app también se puede (M14, M19)", () => {
  test("se puede crear una asignación desde la hoja", () => {
    const onCreate = jest.fn();
    render(<AssignmentSheetView {...baseProps} onCreateAssignment={onCreate} />);

    fireEvent.click(screen.getByTestId("assignment-add"));
    fireEvent.change(screen.getByTestId("assignment-task"), { target: { value: "2" } });
    fireEvent.change(screen.getByTestId("assignment-resource"), { target: { value: "r1" } });
    fireEvent.click(screen.getByTestId("assignment-confirm"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "2", resourceId: "r1" }),
    );
  });

  test("crear una que sobrecarga avisa antes, no después", () => {
    render(
      <AssignmentSheetView
        {...baseProps}
        assignments={asignacionesQueLlenanElDia}
        onCreateAssignment={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("assignment-add"));
    fireEvent.change(screen.getByTestId("assignment-resource"), { target: { value: "r1" } });

    expect(screen.getByTestId("assignment-overload-warning")).toHaveTextContent(
      /sobrecarg/i,
    );
  });

  test("la sobreasignación se ve aquí, sin ir a Problemas", () => {
    render(<AssignmentSheetView {...baseProps} assignments={asignacionesQueLlenanElDia} />);

    expect(screen.getAllByTestId("assignment-overloaded").length).toBeGreaterThan(0);
  });

  test("borrar una asignación pide confirmación", () => {
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    const onDelete = jest.fn();
    render(<AssignmentSheetView {...baseProps} onDeleteAssignment={onDelete} />);

    fireEvent.click(screen.getAllByTestId("assignment-delete")[0]);

    expect(confirmar).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/assignments.test.ts src/components/views/AssignmentSheetView.test.tsx`
Expected: FAIL — `wouldOverallocate` no existe; y `AssignmentSheetView` no tiene ninguna prop de alta o baja
(`AssignmentSheetView.tsx:20-30`): es una hoja de solo lectura.

- [ ] **Step 3: Write minimal implementation**

`wouldOverallocate` se implementa **llamando a `detectOverallocation`** sobre la lista con la asignación
candidata añadida, y devolviendo el resultado que afecte a ese recurso. Así hay una sola definición por
construcción, no por disciplina.

En `ResourceUsageView.tsx:288`, sustituir `cell.hours > dailyCapacity * 7` por el resultado de
`detectOverallocation`. **Advertir en la tarjeta de `EXPERIMENTS.md`:** esta vista pasará a marcar más celdas
que antes, porque el umbral diario es más estricto que el semanal. Es el resultado correcto.

`AssignmentSheetView` gana `onCreateAssignment` y `onDeleteAssignment`, un formulario de alta con selector de
tarea y de recurso, el aviso de sobrecarga al elegir recurso, la marca `assignment-overloaded` en las filas
afectadas y el borrado con confirmación. En `GanttView`, ambos handlers pasan por `runUndoable`, como el
resto de lo destructivo desde E24. En el panel de la tarea del Gantt, un botón «Asignar recurso» que abre el
mismo formulario con la tarea ya elegida.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling src/components/views`
Expected: PASS (3 + 4 nuevos + los existentes de `assignments.test.ts` y `bottlenecks.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/assignments.ts src/lib/scheduling/assignments.test.ts src/components/views/AssignmentSheetView.tsx src/components/views/AssignmentSheetView.test.tsx src/components/views/ResourceUsageView.tsx src/components/views/GanttView.tsx
git commit -m "feat(recursos): alta y baja de asignaciones con una sola definicion de sobrecarga (M14, M18, M19)"
```

---

## Task 27: «Productividad» pasa a llamarse «Ritmo (1/día)»

**Files:**
- Modify: `src/components/views/TypicalUnitView.tsx`
- Test: `src/components/views/TypicalUnitView.test.tsx`

**Interfaces:** solo copy. La productividad real necesita cantidades de obra, que vienen de la matriz
(carril B, P4). Aquí se renombra y nada más, que es lo que decidió el grilleo.

- [ ] **Step 1: Write the failing test**

```tsx
describe("las etiquetas no prometen lo que el número no es (M2)", () => {
  test("el indicador se llama Ritmo, con su unidad real", () => {
    render(<TypicalUnitView {...baseProps} />);

    expect(screen.getByText(/ritmo \(1\/día\)/i)).toBeInTheDocument();
  });

  test("ya no dice «unidades/día», que no existen sin cantidad de obra", () => {
    render(<TypicalUnitView {...baseProps} />);

    expect(screen.queryByText(/unidades\/día/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/productividad/i)).not.toBeInTheDocument();
  });

  test("explica de dónde sale el número", () => {
    render(<TypicalUnitView {...baseProps} />);

    expect(screen.getByTestId("ritmo-nota")).toHaveTextContent(
      /inverso de la duración/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/TypicalUnitView.test.tsx -t "no prometen"`
Expected: FAIL — la vista rotula «Productividad» y «unidades/día», y no hay ninguna nota que explique el
cálculo.

- [ ] **Step 3: Write minimal implementation**

Renombrar las etiquetas y añadir:

```tsx
<p data-testid="ritmo-nota" className="text-sm text-[var(--color-text-muted)]">
  El ritmo es el inverso de la duración: cuántos niveles por día da el paso
  actual. Cuando la matriz aporte cantidades de obra, aquí habrá productividad
  real.
</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/TypicalUnitView.test.tsx`
Expected: PASS (3 nuevos + los existentes).

- [ ] **Step 5: Commit**

```bash
git add src/components/views/TypicalUnitView.tsx src/components/views/TypicalUnitView.test.tsx
git commit -m "fix(unidad-tipica): Productividad pasa a Ritmo (1/dia), que es lo que mide (M2)"
```

---

## Task 28: Cierre del backlog y verificación final

- [ ] **Step 1: Suite completa, lint, tipos y build**

```bash
npx jest --runInBand
```

```bash
npx eslint src
```

```bash
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
```
Expected: salida **vacía**.

```bash
npx next build
```

```bash
npx playwright test --project=chromium
```

- [ ] **Step 2: Cerrar los 27 experimentos en `docs/EXPERIMENTS.md`**

Cada uno pasa a **shipped** con su evidencia real, o a **descartado con motivo escrito**. Ninguno se queda en
`backlog`. Los que este plan no toca por decisión previa —E51, E47, E38 (encabezados comprimidos)— se marcan
descartados con la razón, no se dejan en el limbo.

Registrar además los dos cambios de comportamiento visibles:
- Uso de Recursos marca **más** celdas sobreasignadas que antes (umbral diario, Tarea 26).
- Un `/login?error=<texto>` antiguo deja de pintar nada (Tarea 1).
Y el resultado de la Tarea 13: si la edición del fin quedó activa o degradada a solo lectura, con el caso
concreto que lo motivó.

- [ ] **Step 3: Comprobación en navegador, vista por vista**

`docker compose up -d --build frontend` desde la raíz y recorrer las 11 vistas del menú, no solo la home:
Gantt, Matriz, Observaciones, Last Planner, Calendario, Ejecutivo, Curva S, Línea de Balance, Unidad Típica,
Problemas, Recursos y Configuración. En cada una, comprobar que no hay pantallas en blanco, que el copy está
en español con tildes y que ningún control promete lo que no hace.

- [ ] **Step 4: Commit y revisión**

```bash
git add docs/EXPERIMENTS.md
git commit -m "docs(experiments): cerrar los 27 experimentos del backlog con su evidencia"
```

Luego `superpowers:requesting-code-review` sobre la rama completa y, al pasar,
`superpowers:finishing-a-development-branch` para fusionar a `main`.

---

## Preguntas abiertas

Las dos de la spec, repetidas aquí para que no se pierdan al ejecutar:

1. **Dónde vive Last Planner en el menú.** Este plan la pone en «Trabajo» (Tarea 22). La spec decide el grupo
   de la Matriz pero no el de esta vista. Cambiarlo es una línea en `VIEW_TABS`.
2. **Enlaces antiguos con `?error=<texto>`.** Dejarán de pintar nada tras la Tarea 1. Es el punto del
   arreglo, no una regresión.

Y una tercera que aparece al planificar:

3. **Qué se hace con `tasksToExcelTsv`** una vez que el export pasa a CSV (Tarea 21). El plan lo deja vivo
   mientras tenga consumidores y lo borra si no queda ninguno. Si alguien depende del TSV por costumbre —
   pegar directamente en Excel sin diálogo de importación— convendría mantener los dos botones. **No hay
   decisión del usuario sobre esto**; el plan elige el CSV porque es lo que la spec pide («CSV de verdad, con
   el separador correcto para configuración regional española») y anota aquí la alternativa.

## Dependencias del carril B, no planificadas aquí

- **M10 · corregir clasificaciones ambiguas de la Línea de Balance desde la interfaz**: necesita el
  diccionario que aprende del motor de detección (P3).
- **Productividad real en Unidad Típica**: necesita cantidades de obra desde la matriz (P4). La Tarea 27
  hace solo el renombrado.
