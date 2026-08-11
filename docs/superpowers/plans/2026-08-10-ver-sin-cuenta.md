# E51 · Ver un `.mpp` sin cuenta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que alguien sin cuenta vea su `.mpp` en **3 pasos**, en solo lectura, con un enlace que caduca a los 7 días y la opción de quedárselo creando cuenta — cerrando la única fila que separa la app del 10/10.

> **Reescrito el 2026-08-10, después de contrastar el spec contra el código.** La primera versión ponía la
> garantía de solo lectura dentro de `saveProject`, «por donde pasa todo guardado». **No era cierto**:
> `snapshots.ts` escribía por su cuenta. Y al ir a mirar apareció algo peor — cuatro acciones de servidor no
> comprobaban ni sesión ni permiso, agujero que se cerró aparte en `fix/acciones-sin-autorizar` antes de
> tocar este plan.
>
> Con eso cerrado, la garantía cambió de sitio y de forma: **`/ver/<token>` no crea sesión ninguna**, y toda
> escritura exige sesión con permiso. Afecta a las tareas **4** (reescrita entera: ahora es la puerta que lee
> por token) y **12** (el guardián ahora vigila que ninguna acción toque la base sin comprobar), y a los
> comentarios de la 9 y la 10. **El plan está al día y se puede ejecutar entero.**

> **Contraste contra `main` del 2026-08-10, después de la auditoría.** `main` incorporó **propiedad de
> proyectos**: `saveProject`, `loadProject`, `listProjects` y `deleteProject` exigen pertenencia en
> `project_members`. Eso toca E51 en tres sitios, comprobados con el código delante:
>
> 1. **A favor, y bastante:** un proyecto temporal no tiene ninguna fila en `project_members`, así que
>    **nadie puede escribirlo, listarlo ni cargarlo por la vía normal**. La garantía de solo lectura que era
>    el punto que decidía este diseño ahora está por partida doble: sin sesión *y* sin pertenencia. La ruta
>    pública entra por `loadSharedProject`, que autoriza por token.
> 2. **En contra, y era grave:** la **Task 10 (adopción)** limpiaba las dos columnas y no creaba la
>    pertenencia. El usuario se habría quedado su cronograma y **lo habría perdido de vista acto seguido**.
>    Corregido: la adopción inserta la fila en la misma transacción, con test y mutación obligatorios.
> 3. **A tener presente:** un admin puede editar un temporal ajeno, porque `canAccessProject` le da acceso a
>    todo. Es coherente con la decisión tomada en la auditoría; queda escrito, no corregido.

**Architecture:** Un proyecto temporal es una fila de `projects` con `share_token` y `expires_at`; la ruta pública `/ver/<token>` lo muestra reutilizando `GanttView`, que ya sabe montarse sin sesión porque `/gantt-demo` lo hace. La garantía de solo lectura **no vive en la interfaz**: quien llega por el enlace **no tiene sesión ninguna**, y toda acción que escribe —el proyecto o sus fotos— exige sesión con permiso, así que ninguna llega a autorizarse. Adoptar es crear cuenta y poner `share_token` y `expires_at` a `NULL`.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · PostgreSQL (`pg`) · Jest + Testing Library · Playwright.

Spec: [2026-08-10-ver-sin-cuenta-design.md](../specs/2026-08-10-ver-sin-cuenta-design.md)

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Sin excepciones.
- Directorio de trabajo: `v2/`. Los `git` se ejecutan desde la raíz del repositorio.
- La suite se corre en serie: `npx jest --runInBand`. En paralelo hay flaky conocidos.
- Punto de partida: **1.528 tests en verde sobre 159 suites**, más 2 `skipped` a propósito (las abscisas de R6). Ninguna tarea puede dejar la suite en rojo.
- Verificación por bloque: `npx eslint <archivos>` y `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`, que debe salir **vacío**.
- Copy de interfaz en **español con tildes**, lenguaje de obra, sin jerga de infraestructura. Hay un test que lo vigila (`src/__tests__/limpieza.test.ts`) y barre comillas, plantillas y texto JSX suelto.
- Identificadores, funciones y tipos en **inglés**, como el resto de `v2/src`.
- Mensajes de commit en **español sin tildes**, formato `tipo(alcance): frase en minúscula`. Alcance: `ver-sin-cuenta`.
- No se añaden colores nuevos: tokens de `src/app/globals.css`.
- **La ruta con cuenta no se toca**: `POST /api/import-mpp` y `GET /project/<id>` quedan exactamente como están.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/lib/share/shareToken.ts` | **Nuevo.** Generar el token y decidir si un temporal caducó | 1 |
| `src/lib/share/uploadThrottle.ts` | **Nuevo.** El contador de subidas por IP | 2 |
| `src/lib/db.ts` | Las dos columnas nuevas de `projects` | 3 |
| `src/lib/share/loadSharedProject.ts` | La puerta del enlace: lee por token, sin sesión y solo para leer | 4 |
| `src/app/actions/project.ts` | Alta de un temporal y adopción | 5, 10 |
| `src/app/api/ver-mpp/route.ts` | **Nuevo.** Subida sin sesión: analiza, guarda temporal, devuelve token | 6 |
| `src/components/upload/AnonymousMppUpload.tsx` | **Nuevo.** El botón de la home que no pide cuenta | 7 |
| `src/app/page.tsx` | Ofrece la entrada sin cuenta | 7 |
| `src/app/ver/[token]/page.tsx` | **Nueva ruta pública.** Muestra el temporal o su caducidad | 9 |
| `src/components/views/GanttView.tsx` | `readOnly`: esconde lo que no aplica | 10 |
| `src/app/api/adoptar/[token]/route.ts` | **Nuevo.** Adoptar con sesión | 11 |
| `scripts/clean-expired-shares.ts` | **Nuevo.** Higiene de temporales caducados | 12 |

**Orden y dependencias:** 1 y 2 son independientes. 3 antes que 4-6. La 4 (la puerta del token) antes que la 9 y la 10. La 11 necesita la 5 y la 8. La 13 cierra.

**Requisito previo, ya cumplido:** este plan da por hecho que **toda acción de servidor comprueba sesión y permiso**. No era cierto hasta el 2026-08-10 —`loadProject` y las tres de `snapshots.ts` no comprobaban nada—; se cerró en `fix/acciones-sin-autorizar` antes de empezar aquí. Sin eso, «sin sesión no se puede escribir» sería una suposición y no una garantía.

---

# BLOQUE A — Las piezas puras

## Task 1: El token y la caducidad

**Files:**
- Create: `src/lib/share/shareToken.ts`
- Create: `src/lib/share/shareToken.test.ts`

**Interfaces:**
- Consumes: `randomBytes` de `node:crypto`. **No vale `Math.random()`, ni el reloj, ni nada derivado
  del nombre del archivo:** el token es lo único que separa un cronograma privado de internet.
- Produces:
  - `export const SHARE_TOKEN_BYTES = 32` — 256 bits. En base64url son 43 caracteres.
  - `export const SHARE_TTL_DAYS = 7`
  - `export function createShareToken(): string` — `randomBytes(SHARE_TOKEN_BYTES).toString("base64url")`
  - `export function shareExpiryFrom(now: Date): Date`
  - `export function isShareExpired(expiresAt: Date | string | null | undefined, now: Date): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import {
  SHARE_TTL_DAYS,
  createShareToken,
  isShareExpired,
  shareExpiryFrom,
} from "./shareToken";

describe("shareToken (E51: el enlace no se adivina y no dura para siempre)", () => {
  test("el token es largo: adivinarlo probando no es una opción", () => {
    expect(createShareToken().length).toBeGreaterThanOrEqual(32);
  });

  test("dos tokens seguidos no se parecen", () => {
    const a = createShareToken();
    const b = createShareToken();

    expect(a).not.toBe(b);
  });

  test("el token solo lleva caracteres seguros para una URL", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(createShareToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  // Los tres tests de arriba —largo, distintos, y caracteres de URL— los pasa
  // también un token derivado del reloj: `Date.now().toString(36)` es único,
  // es único y casa con `[A-Za-z0-9_-]`. Y un token derivado del reloj **se
  // adivina**: quien sube un archivo sabe a qué hora subió el de al lado.
  //
  // Estos dos sí separan lo fuerte de lo débil, y sin atarse a la
  // implementación (no comprueban que se llame a `randomBytes`, comprueban que
  // el resultado no se comporte como un contador).
  test("los tokens no salen ordenados en el tiempo: no vienen del reloj", () => {
    const generados = Array.from({ length: 50 }, () => createShareToken());
    const ordenados = [...generados].sort();

    // Un token derivado del reloj crece monótonamente, así que ordenarlo
    // alfabéticamente lo devuelve en el orden en que se generó.
    expect(ordenados).not.toEqual(generados);
  });

  test("dos tokens seguidos no comparten un prefijo largo", () => {
    const a = createShareToken();
    const b = createShareToken();

    let comunes = 0;
    while (comunes < a.length && a[comunes] === b[comunes]) comunes += 1;

    // Los derivados del tiempo comparten casi todo menos los últimos dígitos.
    expect(comunes).toBeLessThan(4);
  });

  test("caduca siete días después de subirlo", () => {
    const subida = new Date("2026-08-10T09:00:00.000Z");

    expect(shareExpiryFrom(subida).toISOString()).toBe(
      "2026-08-17T09:00:00.000Z",
    );
    expect(SHARE_TTL_DAYS).toBe(7);
  });

  test("antes del plazo sigue vivo; después, no", () => {
    const caduca = new Date("2026-08-17T09:00:00.000Z");

    expect(isShareExpired(caduca, new Date("2026-08-16T23:59:00.000Z"))).toBe(false);
    expect(isShareExpired(caduca, new Date("2026-08-17T09:00:01.000Z"))).toBe(true);
  });

  test("acepta la fecha como texto, que es como viene de la base de datos", () => {
    expect(
      isShareExpired("2026-08-17T09:00:00.000Z", new Date("2026-08-18T00:00:00.000Z")),
    ).toBe(true);
  });

  test("un proyecto sin fecha de caducidad no es temporal: nunca caduca", () => {
    expect(isShareExpired(null, new Date())).toBe(false);
    expect(isShareExpired(undefined, new Date())).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/lib/share/shareToken.test.ts`
Expected: FAIL — `Cannot find module './shareToken' from 'src/lib/share/shareToken.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { randomBytes } from "node:crypto";

/**
 * El enlace de un cronograma que se ve sin cuenta.
 *
 * Los proyectos normales viven en rutas con identificador propio y exigen
 * sesión. Un temporal es público para quien tenga el enlace, así que el enlace
 * **es** la credencial: tiene que ser imposible de acertar probando, y tiene
 * que dejar de valer solo.
 */
export const SHARE_TTL_DAYS = 7;

/** 24 bytes en base64url: 32 caracteres, sin nada que escapar en una URL. */
export function createShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function shareExpiryFrom(now: Date): Date {
  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + SHARE_TTL_DAYS);
  return expiry;
}

export function isShareExpired(
  expiresAt: Date | string | null | undefined,
  now: Date,
): boolean {
  // Sin fecha no es temporal: es un proyecto normal y no caduca nunca.
  if (expiresAt == null) return false;
  const limit = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return limit.getTime() <= now.getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/lib/share/shareToken.test.ts`
Expected: PASS — 7 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add v2/src/lib/share/shareToken.ts v2/src/lib/share/shareToken.test.ts && git commit -m "feat(ver-sin-cuenta): el enlace temporal no se adivina y caduca a los siete dias"
```

---

## Task 2: El freno de subidas por IP

**Files:**
- Create: `src/lib/share/uploadThrottle.ts`
- Create: `src/lib/share/uploadThrottle.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export const ANONYMOUS_UPLOADS_PER_HOUR = 5`
  - `export interface ThrottleVerdict { allowed: boolean; retryAfterSeconds: number }`
  - `export function checkUploadAllowance(ip: string, now: Date): ThrottleVerdict`
  - `export function resetUploadThrottle(): void` — solo para las pruebas

- [ ] **Step 1: Write the failing test**

```ts
import {
  ANONYMOUS_UPLOADS_PER_HOUR,
  checkUploadAllowance,
  resetUploadThrottle,
} from "./uploadThrottle";

describe("uploadThrottle (E51: quitar la sesión abre el analizador a internet)", () => {
  beforeEach(() => {
    resetUploadThrottle();
  });

  const t0 = new Date("2026-08-10T09:00:00.000Z");

  test("las primeras cinco subidas de una hora pasan", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      expect(checkUploadAllowance("1.2.3.4", t0).allowed).toBe(true);
    }
  });

  test("la sexta se frena y dice cuánto falta", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    const verdict = checkUploadAllowance("1.2.3.4", t0);

    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBe(3600);
  });

  test("una hora después vuelve a pasar", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    const unaHoraDespues = new Date("2026-08-10T10:00:01.000Z");

    expect(checkUploadAllowance("1.2.3.4", unaHoraDespues).allowed).toBe(true);
  });

  test("el freno de una conexión no afecta a otra", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    expect(checkUploadAllowance("5.6.7.8", t0).allowed).toBe(true);
  });

  test("el tiempo que falta baja según avanza la hora", () => {
    for (let i = 0; i < ANONYMOUS_UPLOADS_PER_HOUR; i += 1) {
      checkUploadAllowance("1.2.3.4", t0);
    }

    const media = new Date("2026-08-10T09:30:00.000Z");

    expect(checkUploadAllowance("1.2.3.4", media).retryAfterSeconds).toBe(1800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/lib/share/uploadThrottle.test.ts`
Expected: FAIL — `Cannot find module './uploadThrottle' from 'src/lib/share/uploadThrottle.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Un tope de subidas por conexión y hora.
 *
 * La ruta con cuenta está protegida por exigir sesión; la de E51 no puede.
 * El analizador es un microservicio aparte que tarda hasta tres minutos con
 * archivos grandes, así que un goteo automático lo deja sin atender a los
 * usuarios de verdad.
 *
 * En memoria a propósito: es un freno contra el goteo, no contra un ataque
 * coordinado. Una tabla en base de datos sería más infraestructura de la que
 * el problema pide, y el proceso se reinicia con cada despliegue.
 */
export const ANONYMOUS_UPLOADS_PER_HOUR = 5;

const WINDOW_MS = 60 * 60 * 1000;

interface Window {
  startedAt: number;
  count: number;
}

const windows = new Map<string, Window>();

export interface ThrottleVerdict {
  allowed: boolean;
  /** Segundos hasta que vuelva a haber cupo. 0 cuando sí hay. */
  retryAfterSeconds: number;
}

export function checkUploadAllowance(ip: string, now: Date): ThrottleVerdict {
  const current = windows.get(ip);
  const nowMs = now.getTime();

  if (!current || nowMs - current.startedAt >= WINDOW_MS) {
    windows.set(ip, { startedAt: nowMs, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count < ANONYMOUS_UPLOADS_PER_HOUR) {
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const remaining = current.startedAt + WINDOW_MS - nowMs;
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(remaining / 1000),
  };
}

/** Solo para las pruebas: el contador vive en memoria del proceso. */
export function resetUploadThrottle(): void {
  windows.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/lib/share/uploadThrottle.test.ts`
Expected: PASS — 5 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add v2/src/lib/share/uploadThrottle.ts v2/src/lib/share/uploadThrottle.test.ts && git commit -m "feat(ver-sin-cuenta): tope de cinco subidas por hora y conexion"
```

---

# BLOQUE B — La puerta del enlace

## Task 3: Las dos columnas de proyecto temporal

**Files:**
- Modify: `src/lib/db.ts:15-23` (dentro de `ensureProjectsTable`)
- Create: `src/lib/db.schema.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `projects` gana `share_token TEXT UNIQUE` y `expires_at TIMESTAMPTZ`.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";

/**
 * Las columnas se crean con `ALTER TABLE ... IF NOT EXISTS`, no cambiando el
 * `CREATE TABLE`: en las bases que ya existen, el `CREATE TABLE IF NOT EXISTS`
 * no se vuelve a ejecutar y las columnas nuevas nunca aparecerían.
 */
describe("El esquema admite proyectos temporales (E51)", () => {
  const source = readFileSync("src/lib/db.ts", "utf8");

  test("hay una columna para el enlace, y es única", () => {
    expect(source).toContain("ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE");
  });

  test("hay una columna para la caducidad", () => {
    expect(source).toContain("ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ");
  });

  test("se añaden con ALTER, no tocando el CREATE TABLE", () => {
    // Un `CREATE TABLE IF NOT EXISTS` no se reejecuta en bases ya creadas.
    expect(source).toMatch(/ALTER TABLE projects[\s\S]*share_token/);
  });

  test("se busca por token, así que hay índice", () => {
    expect(source).toContain("idx_projects_share_token");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/lib/db.schema.test.ts`
Expected: FAIL — `expect(received).toContain("ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE")`, porque `db.ts` todavía no las declara.

- [ ] **Step 3: Write minimal implementation**

En `src/lib/db.ts`, justo después del `CREATE TABLE IF NOT EXISTS projects (...)` y antes del bloque de `matrix_templates`:

```ts
      // Proyectos temporales de E51: se ven sin cuenta con un enlace que
      // caduca. Van por ALTER porque el CREATE de arriba no se reejecuta en
      // bases que ya existen, y entonces las columnas nunca aparecerían.
      await client.query(`
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
      `);
      await client.query(`
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_projects_share_token
          ON projects (share_token);
      `);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/lib/db.schema.test.ts`
Expected: PASS — 4 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add v2/src/lib/db.ts v2/src/lib/db.schema.test.ts && git commit -m "feat(ver-sin-cuenta): la tabla de proyectos admite temporales con caducidad"
```

---

## Task 4: La puerta del enlace — leer por token, sin sesión y sin permisos

Es **la tarea que sostiene todo el diseño**, y cambió de forma respecto a la primera versión del plan.

> **Por qué ya no va dentro de `saveProject`.** El plan original ponía aquí una invariante: «`saveProject`
> rechaza escribir sobre una fila con `expires_at IS NOT NULL`», con el argumento de que por ahí pasa todo
> guardado. **Se comprobó contra el código y era falso**: `snapshots.ts` escribía por su cuenta. Y al ir a
> mirar apareció algo peor — cuatro acciones de servidor no comprobaban **nada**, ni sesión ni permiso.
> Eso se cerró aparte, antes de esta tarea (`fix/acciones-sin-autorizar`).
>
> Con esas puertas cerradas, la garantía sale gratis y es más fuerte: **`/ver/<token>` no crea sesión**, y
> toda escritura exige sesión con permiso. Nadie tiene que acordarse de añadir una regla nueva cuando
> aparezca una tabla nueva — si su acción autoriza como las demás, nace protegida.

**Files:**
- Create: `src/lib/share/loadSharedProject.ts`
- Create: `src/lib/share/loadSharedProject.test.ts`

**Interfaces:**
- Consumes: `pool` de `@/lib/db`; `isShareExpired` de `./shareToken` (Task 1); `deserializeProjectData` de
  `@/app/actions/project`.
- Produces:
  - `export interface SharedProject { id: string; name: string; data: ProjectData; expiresAt: Date }`
  - `export async function loadSharedProject(token: string): Promise<SharedProject | null>`

**Lo que esta función NO hace, y es deliberado:** no llama a `getCurrentUser`, no llama a
`userHasPermission`, y **no devuelve nada que permita escribir**. El token es la autorización, y solo
autoriza a leer. No se toca `loadProject`, que sigue siendo la puerta con sesión de siempre.

- [ ] **Step 1: Write the failing test**

```ts
const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({ __esModule: true, default: { connect } }));

import { loadSharedProject } from "./loadSharedProject";

beforeEach(() => {
  query.mockReset();
  release.mockClear();
  query.mockResolvedValue({ rows: [] });
});

const filaViva = {
  id: 7,
  name: "Torre 3",
  project_data: { tasks: [], calendar: null },
  expires_at: "2099-01-01T00:00:00.000Z",
};

describe("loadSharedProject (E51: el token es la llave, y solo abre para leer)", () => {
  test("un token vivo devuelve el proyecto", async () => {
    query.mockResolvedValue({ rows: [filaViva] });

    const compartido = await loadSharedProject("un-token-valido");

    expect(compartido?.name).toBe("Torre 3");
  });

  test("busca por share_token, nunca por id: el id no abre nada", async () => {
    query.mockResolvedValue({ rows: [filaViva] });

    await loadSharedProject("un-token-valido");

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("share_token = $1");
    expect(sql).not.toMatch(/WHERE\s+id\s*=/i);
  });

  test("un token caducado no devuelve nada, aunque la fila siga en la base", async () => {
    query.mockResolvedValue({
      rows: [{ ...filaViva, expires_at: "2020-01-01T00:00:00.000Z" }],
    });

    await expect(loadSharedProject("un-token-viejo")).resolves.toBeNull();
  });

  test("un proyecto normal no se abre por esta puerta ni por accidente", async () => {
    // Sin `expires_at` no es temporal: es el proyecto de alguien con cuenta.
    query.mockResolvedValue({ rows: [{ ...filaViva, expires_at: null }] });

    await expect(loadSharedProject("lo-que-sea")).resolves.toBeNull();
  });

  test("un token que no existe devuelve null, no un error", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(loadSharedProject("no-existe")).resolves.toBeNull();
  });

  test("suelta el cliente aunque la consulta falle", async () => {
    query.mockRejectedValue(new Error("base caída"));

    await expect(loadSharedProject("t")).resolves.toBeNull();
    expect(release).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/lib/share/loadSharedProject.test.ts`
Expected: FAIL — `Cannot find module './loadSharedProject'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import pool from "@/lib/db";
import { deserializeProjectData } from "@/app/actions/project";
import type { ProjectData } from "@/app/actions/project";
import { isShareExpired } from "./shareToken";

export interface SharedProject {
  id: string;
  name: string;
  data: ProjectData;
  expiresAt: Date;
}

/**
 * La única puerta del acceso compartido, y solo abre para leer.
 *
 * No pregunta por la sesión a propósito: quien llega por `/ver/<token>` no
 * tiene ninguna, y no se le fabrica. El token es la autorización. Como toda
 * escritura del proyecto exige sesión con permiso, un visitante no puede
 * escribir aunque se le escape un control en pantalla — y una tabla que se
 * añada mañana nace protegida sin que nadie tenga que acordarse de nada.
 *
 * Busca por `share_token` y nunca por `id`: si buscara por id, conocer el
 * número de un proyecto ajeno bastaría para leerlo.
 */
export async function loadSharedProject(
  token: string,
): Promise<SharedProject | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, name, project_data, expires_at
         FROM projects
        WHERE share_token = $1`,
      [token],
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    // Sin caducidad no es un temporal: es el proyecto de alguien con cuenta, y
    // por esta puerta no se entrega.
    if (!row.expires_at) return null;
    if (isShareExpired(row.expires_at, new Date())) return null;

    return {
      id: String(row.id),
      name: row.name,
      data: deserializeProjectData(String(row.id), row),
      expiresAt: new Date(row.expires_at),
    };
  } catch (err) {
    console.error("loadSharedProject error:", err);
    return null;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/lib/share/loadSharedProject.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Romper la comprobación a propósito (obligatorio)**

Es una tarea de seguridad, así que el test no vale hasta que se le vea fallar. Haz **las dos** mutaciones,
una cada vez, y confirma que se pone rojo:

1. Quita `if (!row.expires_at) return null;` → debe romperse «un proyecto normal no se abre por esta puerta».
2. Quita la línea de `isShareExpired` → debe romperse «un token caducado no devuelve nada».

Si alguna mutación **no** pone rojo ningún test, el test que la cubría no sirve: arréglalo antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add v2/src/lib/share/loadSharedProject.ts v2/src/lib/share/loadSharedProject.test.ts
git commit -m "feat(compartir): leer un proyecto por su token, sin sesion y solo para leer"
```

---

## Task 5: Alta y carga de un temporal

**Files:**
- Modify: `src/app/actions/project.ts` (dos funciones nuevas al final)
- Test: `src/app/actions/project.test.ts`

**Interfaces:**
- Consumes: `createShareToken`, `shareExpiryFrom`, `isShareExpired` de `@/lib/share/shareToken`; `serializeProjectData` y `deserializeProjectData`, ya privadas del módulo.
- Produces:
  - `ProjectData` gana `expiresAt?: string` — ISO de la caducidad, presente solo en los temporales
  - `export async function createSharedProject(data: ProjectData): Promise<{ ok: true; token: string } | { ok: false; error: string }>`
  - `export async function loadSharedProject(token: string): Promise<ProjectData | null>`

- [ ] **Step 1: Write the failing test**

```ts
describe("Alta y carga de un proyecto temporal (E51)", () => {
  beforeEach(() => {
    query.mockReset();
  });

  const datos = {
    name: "Estación 16",
    tasks: [],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar,
  };

  test("crear uno devuelve el token con el que se abre", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "temp-1" }] });

    const result = await createSharedProject(datos);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.token.length).toBeGreaterThanOrEqual(32);
  });

  test("se guarda con su fecha de caducidad puesta", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "temp-1" }] });

    await createSharedProject(datos);

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("share_token");
    expect(String(sql)).toContain("expires_at");
    // El cuarto parámetro es la caducidad: tiene que ser futura.
    expect(new Date(params[3]).getTime()).toBeGreaterThan(Date.now());
  });

  test("abrirlo con su token devuelve el cronograma", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: "temp-1",
          name: "Estación 16",
          project_data: { name: "Estación 16", tasks: [] },
          expires_at: "2999-01-01T00:00:00.000Z",
        },
      ],
    });

    const cargado = await loadSharedProject("un-token-largo-de-prueba-123456");

    expect(cargado?.name).toBe("Estación 16");
  });

  test("devuelve también hasta cuándo dura, que la pantalla tiene que decir", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: "temp-1",
          name: "Estación 16",
          project_data: { name: "Estación 16", tasks: [] },
          expires_at: "2999-01-01T00:00:00.000Z",
        },
      ],
    });

    const cargado = await loadSharedProject("un-token-largo-de-prueba-123456");

    expect(cargado?.expiresAt).toBe("2999-01-01T00:00:00.000Z");
  });

  test("un token que no existe no devuelve nada", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    expect(await loadSharedProject("token-inventado")).toBeNull();
  });

  test("un temporal caducado no se muestra, y se borra al intentarlo", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: "temp-viejo",
          name: "Viejo",
          project_data: { name: "Viejo", tasks: [] },
          expires_at: "2020-01-01T00:00:00.000Z",
        },
      ],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const cargado = await loadSharedProject("token-caducado");

    expect(cargado).toBeNull();
    // La garantía no depende de que el script de limpieza haya corrido.
    const sentencias = query.mock.calls.map((call) => String(call[0]));
    expect(sentencias.some((sql) => sql.includes("DELETE FROM projects"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/app/actions/project.test.ts -t "Alta y carga de un proyecto temporal" --runInBand`
Expected: FAIL — TypeScript no encuentra `createSharedProject` ni `loadSharedProject`; en ejecución, `createSharedProject is not a function`.

- [ ] **Step 3: Write minimal implementation**

Primero, `ProjectData` gana el campo, junto a `detectionDictionary`:

```ts
  /** Hasta cuándo vale el enlace público. Solo lo llevan los temporales. */
  expiresAt?: string;
```

Después, al final de `src/app/actions/project.ts`, y con el import nuevo arriba junto a los demás:

```ts
import {
  createShareToken,
  isShareExpired,
  shareExpiryFrom,
} from "@/lib/share/shareToken";
```

```ts
/**
 * Da de alta un cronograma que se verá sin cuenta.
 *
 * No pasa por `saveProject` a propósito: aquello exige permisos de proyecto,
 * y aquí no hay usuario a quien pedírselos. El precio de esa puerta aparte es
 * que la fila nace con `expires_at`, que es justo lo que la vuelve inmutable.
 */
export async function createSharedProject(
  data: ProjectData,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    await ensureProjectsTable();
    const serialized = serializeProjectData(data);
    const token = createShareToken();
    const expiresAt = shareExpiryFrom(new Date());

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO projects (name, project_data, share_token, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [serialized.name, JSON.stringify(serialized), token, expiresAt.toISOString()],
      );
      return { ok: true, token };
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("createSharedProject error:", err);
    return { ok: false, error: "No pudimos guardar el cronograma para verlo." };
  }
}

/**
 * Abre un temporal por su enlace.
 *
 * Si caducó, se borra aquí mismo y se responde como si no existiera: la
 * garantía de que nadie ve un cronograma caducado no puede depender de que el
 * script de limpieza haya corrido esta noche.
 */
export async function loadSharedProject(
  token: string,
): Promise<ProjectData | null> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, name, project_data, expires_at
         FROM projects WHERE share_token = $1`,
        [token],
      );
      const row = res.rows[0];
      if (!row) return null;

      if (isShareExpired(row.expires_at, new Date())) {
        await client.query(`DELETE FROM projects WHERE share_token = $1`, [token]);
        return null;
      }

      const project = deserializeProjectData(row.id as string, row);
      // La pantalla tiene que poder decir hasta cuándo vale el enlace.
      project.expiresAt = new Date(row.expires_at).toISOString();
      return project;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("loadSharedProject error:", err);
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/app/actions/project.test.ts --runInBand`
Expected: PASS — la suite completa.

- [ ] **Step 5: Commit**

```bash
git add v2/src/app/actions/project.ts v2/src/app/actions/project.test.ts && git commit -m "feat(ver-sin-cuenta): alta y carga de un cronograma temporal por su enlace"
```

---

# BLOQUE C — La entrada

## Task 6: La ruta de subida sin sesión

**Files:**
- Create: `src/app/api/ver-mpp/route.ts`
- Create: `src/app/api/ver-mpp/route.test.ts`

**Interfaces:**
- Consumes: `checkUploadAllowance` de `@/lib/share/uploadThrottle`; `humanParserError` de `@/lib/import/parserErrors`; `buildProjectDataFromMpp` de `@/lib/import/mpp-project`; `createSharedProject` de `@/app/actions/project`; `parserEndpoint` — la misma función que usa `import-mpp/route.ts`.
- Produces: `POST /api/ver-mpp` responde `{ token: string }` con 200, o `{ error: string }` con 400/413/429/500.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

jest.mock("@/app/actions/project", () => ({
  createSharedProject: jest.fn(async () => ({ ok: true, token: "token-de-prueba-1234567890ab" })),
}));

jest.mock("@/lib/import/mpp-project", () => ({
  buildProjectDataFromMpp: jest.fn(() => ({
    name: "Estación 16",
    tasks: [],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
  })),
}));

import { POST } from "./route";
import { resetUploadThrottle } from "@/lib/share/uploadThrottle";

function peticion(nombre: string, bytes: number, ip = "1.2.3.4"): Request {
  const file = new File(["x"], nombre, { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: bytes });
  const form = new FormData();
  form.set("file", file);
  return new Request("http://localhost/api/ver-mpp", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": ip },
  });
}

describe("POST /api/ver-mpp (E51: subir sin cuenta)", () => {
  beforeEach(() => {
    resetUploadThrottle();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ tasks: [] }),
    })) as unknown as typeof fetch;
  });

  test("no exige sesión: devuelve el enlace para verlo", async () => {
    const res = await POST(peticion("cronograma.mpp", 1024) as never);

    expect(res.status).toBe(200);
    expect((await res.json()).token).toBe("token-de-prueba-1234567890ab");
  });

  test("rechaza lo que no es un .mpp, en español", async () => {
    const res = await POST(peticion("hoja.xlsx", 1024) as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/\.mpp/);
  });

  test("rechaza lo que pasa de 50 MB", async () => {
    const res = await POST(peticion("grande.mpp", 51 * 1024 * 1024) as never);

    expect(res.status).toBe(413);
  });

  test("a la sexta subida de la hora responde 429 y dice cuándo volver", async () => {
    for (let i = 0; i < 5; i += 1) {
      await POST(peticion("cronograma.mpp", 1024) as never);
    }

    const res = await POST(peticion("cronograma.mpp", 1024) as never);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  test("un error del analizador llega traducido, sin detalle técnico", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "Conversion failed: java.lang.NullPointerException",
    })) as unknown as typeof fetch;

    const res = await POST(peticion("cronograma.mpp", 1024) as never);
    const cuerpo = await res.json();

    expect(cuerpo.error).not.toMatch(/java|Exception/i);
    expect(cuerpo.error).toMatch(/MS Project/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/app/api/ver-mpp/route.test.ts`
Expected: FAIL — `Cannot find module './route' from 'src/app/api/ver-mpp/route.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { NextRequest, NextResponse } from "next/server";
import { buildProjectDataFromMpp } from "@/lib/import/mpp-project";
import { humanParserError } from "@/lib/import/parserErrors";
import { createSharedProject } from "@/app/actions/project";
import { checkUploadAllowance } from "@/lib/share/uploadThrottle";
import type { ParsedMppProject } from "@/types/mpp";

const MAX_FILE_SIZE_MB = 50;

function parserEndpoint(): string {
  return process.env.MPP_PARSER_URL ?? "http://mpp-parser:8000/api/parse-mpp";
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "desconocida"
  );
}

/**
 * Subir un `.mpp` sin cuenta, para verlo.
 *
 * Puerta aparte de `/api/import-mpp` a propósito: aquella exige sesión antes
 * de leer el cuerpo (E3) y eso sigue siendo correcto para el flujo con cuenta.
 * Aquí no hay sesión que exigir, así que el freno lo pone el tope por IP.
 */
export async function POST(request: NextRequest) {
  const allowance = checkUploadAllowance(clientIp(request), new Date());
  if (!allowance.allowed) {
    return NextResponse.json(
      {
        error:
          "Has subido varios cronogramas seguidos. Espera un momento y vuelve a intentarlo.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(allowance.retryAfterSeconds) },
      },
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se proporcionó un archivo .mpp válido" },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith(".mpp")) {
    return NextResponse.json(
      { error: "Selecciona un archivo de Microsoft Project con extensión .mpp" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `El archivo supera el máximo de ${MAX_FILE_SIZE_MB} MB` },
      { status: 413 },
    );
  }

  const parserData = new FormData();
  parserData.set("file", file, file.name);
  const parserResponse = await fetch(parserEndpoint(), {
    method: "POST",
    body: parserData,
  });

  if (!parserResponse.ok) {
    const detail = await parserResponse.text().catch(() => "Sin detalles");
    console.error("[ver-mpp] error del analizador", {
      status: parserResponse.status,
      detail,
    });
    return NextResponse.json(
      { error: humanParserError(detail, parserResponse.status) },
      { status: parserResponse.status },
    );
  }

  const parsed = (await parserResponse.json()) as ParsedMppProject;
  const projectData = buildProjectDataFromMpp(parsed, file.name, {
    calculateFields: false,
  });

  const created = await createSharedProject(projectData);
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 500 });
  }

  return NextResponse.json({ token: created.token });
}
```

> Nota para quien ejecute: `parserEndpoint` y el tipo `ParsedMppProject` ya existen en `src/app/api/import-mpp/route.ts`. Si allí `parserEndpoint` está exportado, impórtalo en vez de duplicarlo; si es privado, exportarlo desde allí y usarlo aquí es preferible a la copia de arriba. Comprobar con `grep -n "parserEndpoint" src/app/api/import-mpp/route.ts` antes de escribir.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/app/api/ver-mpp/route.test.ts src/app/api/import-mpp/route.test.ts --runInBand`
Expected: PASS — 5 tests nuevos y los de la ruta con cuenta, que no se toca.

- [ ] **Step 5: Commit**

```bash
git add v2/src/app/api/ver-mpp && git commit -m "feat(ver-sin-cuenta): la subida que no pide cuenta, con su freno"
```

---

## Task 7: El botón de la home

**Files:**
- Create: `src/components/upload/AnonymousMppUpload.tsx`
- Create: `src/components/upload/AnonymousMppUpload.test.tsx`
- Modify: `src/app/page.tsx:87` y `:138` (junto a `HomeMppUploadAction`)

**Interfaces:**
- Consumes: `POST /api/ver-mpp`; `useRouter` de `next/navigation`.
- Produces: `export default function AnonymousMppUpload(props: { className?: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import AnonymousMppUpload from "./AnonymousMppUpload";

function elegirArchivo(nombre: string) {
  const input = screen.getByLabelText("Ver un .mpp sin cuenta");
  const file = new File(["x"], nombre, { type: "application/octet-stream" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("AnonymousMppUpload (E51)", () => {
  beforeEach(() => {
    push.mockClear();
  });

  test("dice que no hace falta cuenta, que es el punto", () => {
    render(<AnonymousMppUpload />);

    expect(screen.getByTestId("anonymous-upload")).toHaveTextContent(
      /sin cuenta/i,
    );
  });

  test("al terminar lleva al enlace del cronograma", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ token: "abc123" }),
    })) as unknown as typeof fetch;

    render(<AnonymousMppUpload />);
    elegirArchivo("cronograma.mpp");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/ver/abc123"));
  });

  test("si el servidor frena, lo dice en lenguaje de obra", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        error: "Has subido varios cronogramas seguidos. Espera un momento y vuelve a intentarlo.",
      }),
    })) as unknown as typeof fetch;

    render(<AnonymousMppUpload />);
    elegirArchivo("cronograma.mpp");

    expect(
      await screen.findByText(/Espera un momento/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  test("anuncia el formato y el límite antes de elegir", () => {
    render(<AnonymousMppUpload />);

    expect(screen.getByTestId("anonymous-upload-limits")).toHaveTextContent(
      /\.mpp/,
    );
    expect(screen.getByTestId("anonymous-upload-limits")).toHaveTextContent(
      /50 MB/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/components/upload/AnonymousMppUpload.test.tsx`
Expected: FAIL — `Cannot find module './AnonymousMppUpload'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

/**
 * La entrada de E51: ver un cronograma sin crear cuenta.
 *
 * Convive con la subida que sí pide cuenta —que guarda el proyecto de verdad—
 * en vez de sustituirla: quien ya tiene cuenta no debería pasar por el modo
 * temporal.
 */
export default function AnonymousMppUpload({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subir = async (file: File) => {
    setError(null);
    setSubiendo(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/ver-mpp", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "No pudimos abrir el cronograma.");
        return;
      }
      router.push(`/ver/${payload.token}`);
    } catch {
      setError("No pudimos abrir el cronograma. Inténtalo de nuevo.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div data-testid="anonymous-upload" className={className}>
      <label className="sr-only" htmlFor="anonymous-mpp">
        Ver un .mpp sin cuenta
      </label>
      <input
        ref={inputRef}
        id="anonymous-mpp"
        type="file"
        accept=".mpp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void subir(file);
        }}
      />
      <button
        type="button"
        disabled={subiendo}
        onClick={() => inputRef.current?.click()}
        className="apple-button-secondary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-5 py-2.5 text-sm font-semibold"
      >
        <Eye size={16} aria-hidden />
        {subiendo ? "Abriendo el cronograma…" : "Ver un .mpp sin cuenta"}
      </button>

      <p
        data-testid="anonymous-upload-limits"
        className="text-sm text-[var(--color-text-muted)]"
      >
        Archivo de MS Project (.mpp), hasta 50 MB. Se guarda una semana y solo
        lo ve quien tenga el enlace.
      </p>

      {error && (
        <p role="alert" className="text-sm text-[var(--aia-alert-main)]">
          {error}
        </p>
      )}
    </div>
  );
}
```

En `src/app/page.tsx`, junto al `<HomeMppUploadAction />` de la línea 138:

```tsx
            <AnonymousMppUpload />
```

y su import arriba, junto al de `HomeMppUploadAction`:

```tsx
import AnonymousMppUpload from "@/components/upload/AnonymousMppUpload";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/components/upload --runInBand`
Expected: PASS — 4 tests nuevos y los de `HomeMppUploadAction`, que no cambia.

- [ ] **Step 5: Commit**

```bash
git add v2/src/components/upload/AnonymousMppUpload.tsx v2/src/components/upload/AnonymousMppUpload.test.tsx v2/src/app/page.tsx && git commit -m "feat(ver-sin-cuenta): la home ofrece ver un mpp sin crear cuenta"
```

---

# BLOQUE D — La vista pública

## Task 8: `GanttView` en solo lectura

**Files:**
- Modify: `src/components/views/GanttView.tsx` (interfaz de props y los controles de edición)
- Test: `src/components/views/GanttView.test.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `GanttViewProps` gana `readOnly?: boolean`.

- [ ] **Step 1: Write the failing test**

```tsx
describe("GanttView en solo lectura (E51)", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSaveProject.mockClear();
  });

  test("no ofrece agregar ni eliminar tareas", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} readOnly />);

    expect(screen.getByTestId("toolbar-add")).toBeDisabled();
    expect(screen.getByTestId("toolbar-delete")).toBeDisabled();
  });

  test("las celdas de la tabla no entran en edición", () => {
    render(<GanttView tasks={[makeTask({ id: 1, name: "Excavación" })]} readOnly />);

    const celda = screen.getByTestId("cell-name-1");
    fireEvent.doubleClick(celda.querySelector('[data-testid="editable-cell"]')!);

    expect(celda.querySelector("input")).toBeNull();
  });

  test("no intenta guardar nada, ni al montar ni después", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} readOnly />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSaveProject).not.toHaveBeenCalled();
  });

  test("sin readOnly todo sigue como estaba", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    expect(screen.getByTestId("toolbar-add")).toBeEnabled();
  });

  test("lo de mirar sigue estando: las vistas de análisis no se esconden", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} readOnly />);

    expect(screen.getByTestId("sidebar-view-lob")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-view-executive")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/components/views/GanttView.test.tsx -t "en solo lectura" --runInBand`
Expected: FAIL — TypeScript rechaza la prop `readOnly`, y en ejecución `toolbar-add` está habilitado.

- [ ] **Step 3: Write minimal implementation**

En `src/components/views/GanttView.tsx`:

1. `GanttViewProps` gana la prop, y `GanttViewInner` la recibe como `readOnly`:

```tsx
  /**
   * Modo mirador: se ve todo, no se toca nada.
   *
   * Es la **cortesía**, no la cerradura: la garantía de que un temporal no se
   * modifica es que quien llega por `/ver/<token>` **no tiene sesión**, y toda
   * escritura exige sesión con permiso. Aquí solo se esconde lo que no aplica,
   * para no prometer lo que no se puede hacer (E51). Si a alguien se le
   * escapara un control, no pasaría nada: el servidor lo rechaza igual.
   */
  readOnly?: boolean;
```

2. Los controles de edición se apagan pasando `undefined` en vez de los manejadores:

```tsx
          onAddTask={readOnly ? undefined : handleAddTask}
          onDeleteTask={readOnly ? undefined : handleDeleteTask}
          onOpenObservations={readOnly ? undefined : () => setObservationPanelTaskId(selectedTaskIds[0] ?? null)}
```

3. La tabla deja de recibir el actualizador, que es lo que hace `canEdit` falso en `GanttRow`:

```tsx
                      onUpdateTask={readOnly ? undefined : updateTask}
```

4. El autoguardado no arranca:

```tsx
  useEffect(() => {
    if (readOnly) return;
    if (!didMountSaveStateRef.current) {
```

y lo mismo en el efecto de observaciones y en el de desmontaje, con un `if (readOnly) return;` como primera línea.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/components/views/GanttView.test.tsx --runInBand`
Expected: PASS — la suite completa de `GanttView`, incluidos los ~90 tests previos.

- [ ] **Step 5: Commit**

```bash
git add v2/src/components/views/GanttView.tsx v2/src/components/views/GanttView.test.tsx && git commit -m "feat(ver-sin-cuenta): el gantt sabe montarse en modo mirador"
```

---

## Task 9: La ruta `/ver/<token>`

**Files:**
- Create: `src/app/ver/[token]/page.tsx`
- Create: `src/app/ver/[token]/SharedProjectView.tsx`
- Create: `src/app/ver/[token]/SharedProjectView.test.tsx`

**Interfaces:**
- Consumes: `loadSharedProject` de `@/app/actions/project`; `GanttView` con `readOnly`.
- Produces: la página pública. `SharedProjectView` recibe `{ project: ProjectData; token: string; expiresAt: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/components/views/GanttView", () => ({
  __esModule: true,
  default: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="gantt-view" data-readonly={String(Boolean(readOnly))} />
  ),
}));

import SharedProjectView from "./SharedProjectView";

const proyecto = {
  name: "Estación 16",
  tasks: [],
  resources: [],
  assignments: [],
  budgetItems: [],
  budgetMappings: [],
  baselines: [],
} as never;

describe("SharedProjectView (E51)", () => {
  test("monta el cronograma en modo mirador, no editable", () => {
    render(
      <SharedProjectView
        project={proyecto}
        token="abc123"
        expiresAt="2026-08-17T09:00:00.000Z"
      />,
    );

    expect(screen.getByTestId("gantt-view")).toHaveAttribute(
      "data-readonly",
      "true",
    );
  });

  test("dice que es de solo lectura y hasta cuándo dura", () => {
    render(
      <SharedProjectView
        project={proyecto}
        token="abc123"
        expiresAt="2026-08-17T09:00:00.000Z"
      />,
    );

    const aviso = screen.getByTestId("shared-banner");
    expect(aviso).toHaveTextContent(/solo lectura/i);
    expect(aviso).toHaveTextContent("17/08/2026");
  });

  test("ofrece quedárselo, que es el camino a tener cuenta", () => {
    render(
      <SharedProjectView
        project={proyecto}
        token="abc123"
        expiresAt="2026-08-17T09:00:00.000Z"
      />,
    );

    const enlace = screen.getByTestId("shared-adopt");
    expect(enlace).toHaveTextContent(/qued[áa]rmelo/i);
    expect(enlace).toHaveAttribute(
      "href",
      "/login?next=%2Fapi%2Fadoptar%2Fabc123",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest "src/app/ver"`
Expected: FAIL — `Cannot find module './SharedProjectView'`

- [ ] **Step 3: Write minimal implementation**

`src/app/ver/[token]/SharedProjectView.tsx`:

```tsx
"use client";

import Link from "next/link";
import GanttView from "@/components/views/GanttView";
import type { ProjectData } from "@/app/actions/project";

function formatDay(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/**
 * Un cronograma visto sin cuenta.
 *
 * El aviso dice las dos cosas que la persona necesita saber y que no puede
 * deducir: que no puede editar, y que esto no dura para siempre.
 */
export default function SharedProjectView({
  project,
  token,
  expiresAt,
}: {
  project: ProjectData;
  token: string;
  expiresAt: string;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <div
        data-testid="shared-banner"
        role="status"
        className="flex flex-wrap items-center gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-4 py-2 text-sm text-[var(--color-text-muted)]"
      >
        <span>
          Estás viendo <strong>{project.name}</strong> en solo lectura. El
          enlace deja de funcionar el {formatDay(expiresAt)}.
        </span>
        <Link
          data-testid="shared-adopt"
          href={`/login?next=${encodeURIComponent(`/api/adoptar/${token}`)}`}
          className="apple-button-primary rounded-[var(--radius-lg)] px-3 py-1 text-sm font-semibold"
        >
          Entrar y quedármelo
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <GanttView
          readOnly
          projectName={project.name}
          tasks={project.tasks}
          calendar={project.calendar}
          resources={project.resources}
          assignments={project.assignments}
          budgetItems={project.budgetItems}
          budgetMappings={project.budgetMappings}
          baselines={project.baselines}
          matrixPlan={project.matrixPlan}
          observations={project.observations}
          detectionDictionary={project.detectionDictionary}
        />
      </div>
    </div>
  );
}
```

`src/app/ver/[token]/page.tsx`:

**Test obligatorio de esta tarea** (va antes que la implementación):

```ts
test("adoptar deja al usuario como dueño: si no, se queda un proyecto invisible", async () => {
  query.mockResolvedValue({ rows: [{ id: 42 }], rowCount: 1 });

  await adoptSharedProject("un-token", "user-7");

  const sql = query.mock.calls.map((c) => String(c[0])).join("\n");
  expect(sql).toContain("INSERT INTO project_members");
  // En la misma transacción que el UPDATE: un proyecto adoptado sin dueño es un
  // proyecto perdido, y una pertenencia sin adopción es basura.
  expect(sql).toContain("BEGIN");
  expect(sql).toContain("COMMIT");
});

test("si el enlace ya no vale, no deja pertenencias sueltas", async () => {
  query.mockResolvedValue({ rows: [], rowCount: 0 });

  const r = await adoptSharedProject("caducado", "user-7");

  expect(r.ok).toBe(false);
  const sql = query.mock.calls.map((c) => String(c[0])).join("\n");
  expect(sql).toContain("ROLLBACK");
  expect(sql).not.toContain("INSERT INTO project_members");
});
```

**Mutación obligatoria:** quita el `INSERT INTO project_members` y confirma que el primer test se pone rojo.

```tsx
import { notFound } from "next/navigation";
import { loadSharedProject } from "@/app/actions/project";
import SharedProjectView from "./SharedProjectView";

export const dynamic = "force-dynamic";

/**
 * La única ruta de proyecto que no exige sesión. Los `/project/<id>` siguen
 * pidiéndola: aquí la credencial es el propio enlace.
 */
export default async function SharedProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await loadSharedProject(token);

  // Caducado y no encontrado se responden igual, a propósito: distinguirlos
  // le diría a quien prueba enlaces cuáles existieron alguna vez.
  if (!project) notFound();

  return (
    <SharedProjectView
      project={project}
      token={token}
      expiresAt={project.expiresAt ?? ""}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest "src/app/ver" --runInBand`
Expected: PASS — 3 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add v2/src/app/ver && git commit -m "feat(ver-sin-cuenta): la ruta publica que muestra el cronograma temporal"
```

---

# BLOQUE E — Quedárselo y limpiar

## Task 10: Adoptar el temporal

**Files:**
- Create: `src/app/api/adoptar/[token]/route.ts`
- Create: `src/app/api/adoptar/[token]/route.test.ts`
- Modify: `src/app/actions/project.ts` (función nueva `adoptSharedProject`)

**Interfaces:**
- Consumes: `getCurrentUser` de `@/lib/auth/session`.
- Produces:
  - `export async function adoptSharedProject(token: string): Promise<{ ok: true; id: string } | { ok: false; error: string }>`
  - `GET /api/adoptar/<token>` redirige a `/project/<id>` con sesión, o a `/login?next=…` sin ella.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

const getCurrentUser = jest.fn();
jest.mock("@/lib/auth/session", () => ({ getCurrentUser }));

const adoptSharedProject = jest.fn();
jest.mock("@/app/actions/project", () => ({ adoptSharedProject }));

import { GET } from "./route";

function peticion(): Request {
  return new Request("http://localhost/api/adoptar/abc123");
}

describe("GET /api/adoptar/<token> (E51)", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    adoptSharedProject.mockReset();
  });

  test("sin sesión manda al login y recuerda a dónde volvía", async () => {
    getCurrentUser.mockResolvedValue(null);

    const res = await GET(peticion() as never, {
      params: Promise.resolve({ token: "abc123" }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("adoptar");
  });

  test("con sesión lo adopta y lleva al proyecto ya suyo", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: "a@b.c" });
    adoptSharedProject.mockResolvedValue({ ok: true, id: "proj-9" });

    const res = await GET(peticion() as never, {
      params: Promise.resolve({ token: "abc123" }),
    });

    expect(adoptSharedProject).toHaveBeenCalledWith("abc123");
    expect(res.headers.get("location")).toContain("/project/proj-9");
  });

  test("un token caducado no adopta nada: manda a la home", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: "a@b.c" });
    adoptSharedProject.mockResolvedValue({ ok: false, error: "no existe" });

    const res = await GET(peticion() as never, {
      params: Promise.resolve({ token: "abc123" }),
    });

    expect(res.headers.get("location")).toMatch(/\/$|\/\?/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest "src/app/api/adoptar"`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Write minimal implementation**

En `src/app/actions/project.ts`:

```ts
/**
 * Un temporal pasa a ser un proyecto normal.
 *
 * Quitar `share_token` cierra el enlace público, y quitar `expires_at` es lo
 * que impide que el barrido de limpieza se lo lleve. La adopción **exige
 * sesión** —es su primer paso—, así que este es el único sitio donde un
 * temporal cambia de manos.
 *
 * **Y hay que darle la pertenencia, en la misma transacción.** Desde que un
 * proyecto tiene dueño (auditoría del 2026-08-10), quitar esas dos columnas no
 * basta: sin fila en `project_members` el usuario se queda el cronograma y
 * **acto seguido lo pierde de vista** — no sale en su home, no lo puede abrir y
 * no lo puede guardar. Sería el peor final posible para el flujo que da sentido
 * a E51: «prueba con tu obra y quédatela».
 */
export async function adoptSharedProject(
  token: string,
  /** Quién se lo queda. Sale de la sesión, no del cliente. */
  userId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const client = await pool.connect();
    try {
      // Las dos escrituras van juntas: un proyecto adoptado sin dueño es un
      // proyecto perdido, y un dueño de un proyecto que no se adoptó es una
      // pertenencia huérfana. O las dos, o ninguna.
      await client.query("BEGIN");
      try {
        const res = await client.query(
          `UPDATE projects
           SET share_token = NULL, expires_at = NULL, updated_at = NOW()
           WHERE share_token = $1 AND expires_at > NOW()
           RETURNING id`,
          [token],
        );
        const id = res.rows[0]?.id as string | undefined;
        if (!id) {
          await client.query("ROLLBACK");
          return { ok: false, error: "Ese enlace ya no está disponible." };
        }

        await client.query(
          `INSERT INTO project_members (project_id, user_id, role_id)
           VALUES ($1, $2, 'admin')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [String(id), userId],
        );

        await client.query("COMMIT");
        return { ok: true, id };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("adoptSharedProject error:", err);
    return { ok: false, error: "No pudimos quedarnos el cronograma." };
  }
}
```

`src/app/api/adoptar/[token]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { adoptSharedProject } from "@/app/actions/project";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    const next = encodeURIComponent(`/api/adoptar/${token}`);
    return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
  }

  const adopted = await adoptSharedProject(token);
  if (!adopted.ok) {
    return NextResponse.redirect(new URL("/?adopcion=caducada", request.url));
  }

  return NextResponse.redirect(
    new URL(`/project/${adopted.id}`, request.url),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest "src/app/api/adoptar" src/app/actions/project.test.ts --runInBand`
Expected: PASS — 3 tests nuevos y la suite de acciones.

- [ ] **Step 5: Commit**

```bash
git add v2/src/app/api/adoptar v2/src/app/actions/project.ts && git commit -m "feat(ver-sin-cuenta): entrar con cuenta y quedarse el cronograma temporal"
```

---

## Task 11: El script de limpieza

**Files:**
- Create: `scripts/clean-expired-shares.ts`
- Create: `src/lib/share/cleanExpired.ts`
- Create: `src/lib/share/cleanExpired.test.ts`

**Interfaces:**
- Consumes: `pool` de `@/lib/db`.
- Produces: `export async function deleteExpiredShares(now: Date): Promise<number>` — devuelve cuántas filas borró.

- [ ] **Step 1: Write the failing test**

```ts
const query = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect: jest.fn(async () => ({ query, release: jest.fn() })) },
}));

import { deleteExpiredShares } from "./cleanExpired";

describe("deleteExpiredShares (E51: higiene de temporales)", () => {
  beforeEach(() => {
    query.mockReset();
  });

  test("borra solo los temporales caducados, nunca un proyecto normal", async () => {
    query.mockResolvedValue({ rowCount: 3 });

    await deleteExpiredShares(new Date("2026-08-20T00:00:00.000Z"));

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("DELETE FROM projects");
    // Las dos condiciones importan: sin la primera borraría proyectos normales.
    expect(sql).toContain("expires_at IS NOT NULL");
    expect(sql).toContain("expires_at <");
  });

  test("devuelve cuántos borró, para que el script pueda decirlo", async () => {
    query.mockResolvedValue({ rowCount: 3 });

    expect(await deleteExpiredShares(new Date())).toBe(3);
  });

  test("sin caducados devuelve cero y no falla", async () => {
    query.mockResolvedValue({ rowCount: 0 });

    expect(await deleteExpiredShares(new Date())).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npx jest src/lib/share/cleanExpired.test.ts`
Expected: FAIL — `Cannot find module './cleanExpired'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/share/cleanExpired.ts`:

```ts
import pool from "@/lib/db";

/**
 * Borra los temporales que ya caducaron.
 *
 * La garantía de que nadie ve uno caducado no está aquí —está en
 * `loadSharedProject`, que borra al intentar abrirlo—. Esto es higiene: que la
 * tabla no acumule cronogramas de gente que probó la app hace meses.
 *
 * Las dos condiciones importan: sin `expires_at IS NOT NULL` esta consulta
 * borraría proyectos normales.
 */
export async function deleteExpiredShares(now: Date): Promise<number> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `DELETE FROM projects
       WHERE expires_at IS NOT NULL AND expires_at < $1`,
      [now.toISOString()],
    );
    return res.rowCount ?? 0;
  } finally {
    client.release();
  }
}
```

`scripts/clean-expired-shares.ts`:

```ts
import { deleteExpiredShares } from "../src/lib/share/cleanExpired";

/**
 * Higiene de los cronogramas que se vieron sin cuenta. Pensado para correr a
 * diario. No pide confirmación porque solo toca filas que ya caducaron y que
 * nadie puede abrir.
 */
async function main() {
  const borrados = await deleteExpiredShares(new Date());
  console.log(`Temporales caducados borrados: ${borrados}`);
  process.exit(0);
}

void main();
```

Y en `package.json`, junto a `clean:e2e`:

```json
    "clean:shares": "tsx scripts/clean-expired-shares.ts",
```

> Comprobar con qué ejecuta `clean:e2e` sus scripts (`grep -n "clean:e2e" package.json`) y usar el mismo, en vez de asumir `tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/lib/share --runInBand`
Expected: PASS — las tres suites de `share/`.

- [ ] **Step 5: Commit**

```bash
git add v2/src/lib/share/cleanExpired.ts v2/src/lib/share/cleanExpired.test.ts v2/scripts/clean-expired-shares.ts v2/package.json && git commit -m "feat(ver-sin-cuenta): script de limpieza de temporales caducados"
```

---

# BLOQUE F — Cierre

## Task 12: El guardián — ninguna acción de servidor sin cerradura

Cambió de forma con el resto del Bloque B, y a mejor: en vez de vigilar **una** regla dentro de
`saveProject`, vigila **la propiedad de la que depende todo el diseño** — que toda acción de servidor que
toca la base comprueba sesión y permiso.

> **Este guardián habría cazado el agujero que encontramos el 2026-08-10.** `loadProject`,
> `saveProjectSnapshot`, `listProjectSnapshots` y `loadProjectSnapshot` no comprobaban nada. No las cazó
> ningún test porque ningún test miraba esa propiedad; las cazó una persona leyendo el código antes de
> construir encima. Un guardián existe justo para que la próxima no dependa de eso.

**Files:**
- Create: `src/app/actions/todasLasAccionesAutorizan.test.ts`

**Interfaces:**
- Consumes: `node:fs`.
- Produces: nada; es un test guardián.

- [ ] **Step 1: Write the failing test**

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRECTORIO = "src/app/actions";

/**
 * Las acciones que pueden saltarse la cerradura, declaradas una a una.
 *
 * Declarar es el punto: una excepción con motivo escrito es una decisión;
 * una excepción silenciosa es el agujero del 2026-08-10 otra vez.
 */
const SIN_CERRADURA_A_PROPOSITO: { funcion: string; porque: string }[] = [
  {
    funcion: "createMatrixPlanFromTemplate",
    porque:
      "No toca la base: transforma una plantilla en memoria y devuelve el resultado.",
  },
];

const SEÑALES_DE_CERRADURA = [
  "authorizeProjectAction",
  "tienePermiso",
  "getCurrentUser",
];

/** Las funciones exportadas de un fichero, con su cuerpo hasta la siguiente. */
function accionesDe(source: string): { nombre: string; cuerpo: string }[] {
  const partes = source.split(/export async function /).slice(1);
  return partes.map((parte) => ({
    nombre: parte.slice(0, parte.search(/[(<\s]/)),
    cuerpo: parte,
  }));
}

describe("Toda acción de servidor comprueba sesión y permiso", () => {
  const ficheros = readdirSync(DIRECTORIO).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );

  test("hay ficheros que revisar: el guardián no se quedó mirando al vacío", () => {
    expect(ficheros.length).toBeGreaterThan(0);
  });

  for (const fichero of ficheros) {
    const source = readFileSync(join(DIRECTORIO, fichero), "utf8");

    for (const { nombre, cuerpo } of accionesDe(source)) {
      const declarada = SIN_CERRADURA_A_PROPOSITO.find(
        (e) => e.funcion === nombre,
      );
      if (declarada) continue;

      test(`${fichero} · ${nombre} comprueba antes de tocar la base`, () => {
        const tocaLaBase = /client\.query|pool\.query/.test(cuerpo);
        if (!tocaLaBase) return;

        const tieneCerradura = SEÑALES_DE_CERRADURA.some((señal) =>
          cuerpo.includes(señal),
        );

        expect(tieneCerradura).toBe(true);
      });
    }
  }
});
```

**Por qué no incluye `loadSharedProject`:** vive en `src/lib/share/`, no en `src/app/actions/`, y su
cerradura es el token, no la sesión. Si algún día se moviera a `actions/`, este guardián lo marcaría — y
tendría razón en pedir que se declare como excepción con su motivo.

- [ ] **Step 2: Run test to verify it fails**

A diferencia del resto, este test **pasa** desde el primer momento: la rama `fix/acciones-sin-autorizar` ya
cerró las cuatro acciones que faltaban. Un test que nace verde no vale nada hasta que se le ve fallar, así
que **hay que romperlo a propósito**:

```bash
cd v2
# Quita la comprobación de loadProject en src/app/actions/project.ts y corre:
npx jest src/app/actions/todasLasAccionesAutorizan.test.ts
```

Expected: FALLA en `project.ts · loadProject comprueba antes de tocar la base`, con `expect(false).toBe(true)`.
Restaurar acto seguido y confirmar que vuelve a verde.

Si al romperlo **no** falla, el guardián no sirve: revisa que `accionesDe` esté partiendo bien el fichero
antes de seguir.

- [ ] **Step 3: Write minimal implementation**

No hay código de producción nuevo. El entregable es el guardián.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v2 && npx jest src/app/actions/todasLasAccionesAutorizan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v2/src/app/actions/todasLasAccionesAutorizan.test.ts
git commit -m "test(guardian): ninguna accion de servidor toca la base sin comprobar sesion"
```

---

## Task 13: Verificación y cierre de la fila

**Files:**
- Modify: `docs/PRODUCT.md` (la revisión de cierre pasa a 10/10)
- Modify: `docs/EXPERIMENTS.md` (E51 deja de estar descartado)

- [ ] **Step 1: Suite, tipos, lint y build**

```bash
cd v2 && npx jest --runInBand
```
Expected: 0 fallos, con los 2 `skipped` de las abscisas.

```bash
cd v2 && npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
```
Expected: salida **vacía**.

```bash
cd v2 && npx eslint src && npx next build
```

- [ ] **Step 2: Contar los pasos en el navegador, que es la fila**

Levantar el build de producción y, **sin sesión**, contar desde la home hasta ver el cronograma con un `.mpp` real:

1. Llegar a la home.
2. Pulsar «Ver un .mpp sin cuenta».
3. Elegir el archivo.

Expected: **3 pasos** y el Gantt en pantalla. Comprobar además: la tabla no entra en edición al doble clic, «Agregar» y «Eliminar» están apagados, el aviso dice la fecha de caducidad, y las vistas de análisis —Curva S, Línea de Balance, Problemas— siguen accesibles.

- [ ] **Step 3: Comprobar que la cerradura aguanta en vivo**

Con el temporal abierto, en la consola del navegador:

```js
await fetch("/api/adoptar/NO-EXISTE").then((r) => r.url)
```
Expected: acaba en `/login` o en la home, nunca en un proyecto.

Y probar que `/project/<id>` del temporal —el identificador se ve en el HTML— **sigue pidiendo sesión**.

- [ ] **Step 4: Actualizar los dos documentos**

En `docs/EXPERIMENTS.md`, la fila de E51 pasa de `backlog` a **shipped**, y se retira de «Fuera de alcance» el motivo del descarte, dejando escrito que el usuario lo reabrió el 2026-08-10.

En `docs/PRODUCT.md`, la sección «Decisión firme: la cuenta se queda» se corrige: la cuenta se queda **para editar y guardar**, y se añade a la revisión de cierre que la fila de los pasos pasa y el veredicto sube a **10/10**, con los 3 pasos contados como evidencia.

- [ ] **Step 5: Commit**

```bash
git add docs/EXPERIMENTS.md docs/PRODUCT.md && git commit -m "docs(ver-sin-cuenta): E51 entregado y la fila de los pasos pasa"
```

---

## Preguntas abiertas

Ninguna del diseño: las cinco decisiones se tomaron en el grilleo del 2026-08-10 y el plazo de 7 días quedó aceptado.

Dos cosas que el ejecutor decide con el código delante, y que este plan señala en su sitio:

1. **Si `parserEndpoint` está exportado** en `import-mpp/route.ts`, se importa en vez de duplicarlo (tarea 6).
2. **Con qué ejecuta el repositorio sus scripts** (`tsx`, `ts-node` u otro): se copia lo que use `clean:e2e` (tarea 11).
