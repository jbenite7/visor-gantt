import { createHash, randomBytes, scryptSync } from "crypto";
import fs from "fs";
import path from "path";
import {
  expect,
  test,
  type ConsoleMessage,
  type FileChooser,
  type Locator,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from "@playwright/test";
import { Client } from "pg";

test.use({
  screenshot: "on",
  trace: "on",
  video: "on",
});

test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://visoruser:visorpass@localhost:5432/visormpp";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const EXACT_MPP_PATH =
  "/Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp";

const E2E_EMAIL = "e2e-full-app@visor.local";
const E2E_PASSWORD = "E2E-full-app-2026!";

type BrowserLogEntry = {
  type: string;
  level?: string;
  status?: number;
  url?: string;
  method?: string;
  text?: string;
  timestamp: string;
};

type EvidenceLogger = {
  entries: BrowserLogEntry[];
  stop: () => void;
};

type Scenario = "import-mpp" | "matrix-housing";

type ProjectModule = {
  id: string;
  label: string;
  testId: string;
  /**
   * Cómo se llega hoy. El recorte C1 sacó tres vistas del menú sin quitarlas
   * del producto: se alcanzan por la paleta de comandos o por la vista rol.
   */
  access?: "sidebar" | "palette" | "rolePreset";
  /** Comando de la paleta, cuando `access` es "palette". */
  command?: string;
};

const PROJECT_MODULES: ProjectModule[] = [
  { id: "gantt", label: "Gantt", testId: "gantt-view" },
  { id: "executive", label: "Ejecutivo", testId: "executive-planning-dashboard" },
  {
    id: "tracking",
    label: "Seguimiento",
    testId: "tracking-gantt-view",
    access: "rolePreset",
  },
  {
    id: "taskSheet",
    label: "Hoja Tareas",
    testId: "task-sheet-view",
    access: "palette",
    command: "Hoja de Tareas",
  },
  {
    id: "network",
    label: "Diagrama Red",
    testId: "network-diagram-view",
    access: "palette",
    command: "Diagrama de Red",
  },
  { id: "resources", label: "Recursos", testId: "resource-sheet-view" },
  { id: "lob", label: "Línea Balance", testId: "line-of-balance" },
  { id: "matrix", label: "Matriz", testId: "matrix-editor" },
  { id: "scurve", label: "Curva S", testId: "s-curve-view" },
  { id: "bottlenecks", label: "Cuellos", testId: "bottlenecks-view" },
  {
    id: "conflictos",
    label: "Conflictos",
    testId: "conflicts-view",
    access: "palette",
    command: "Conflictos",
  },
  { id: "unidadTipica", label: "Unidad Típica", testId: "typical-unit-view" },
  { id: "calendario", label: "Calendario", testId: "calendar-view" },
  { id: "settings", label: "Configuración", testId: "calendar-settings-view" },
];

const APP_MODULES = ["Login", "Home", "Upload", "Crear Proyecto"] as const;

let importedProjectId: string | undefined;
let matrixProjectId: string | undefined;

test.describe("E2E app completa con evidencia visual y logs", () => {
  // Warm-up: Next.js dev server compiles routes on demand, on their first request. Every route
  // below except /login gets its first hit inside the two full-flow tests, so by the time the
  // later "app module"/"project module" tests run those routes are already compiled — but /login
  // is never visited by either flow (both authenticate via cookie), so it stays uncompiled until
  // the "Login" module test is the very first to request it. Once the full flows stopped racing
  // an artificial 180s timeout, that module test started running while /login's on-demand
  // compile was still in flight, aborting the main-app.js chunk request mid-navigation. Visiting
  // it once here, with no assertions attached, lets the dev server finish compiling before any
  // test relies on it.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/login", { waitUntil: "load" });
    await page.close();
  });

  test("flow import-mpp-full-flow", async ({ page }, testInfo) => {
    const logger = createEvidenceLogger(page);
    await authenticateByCookie(page);

    await validateAppModule(page, testInfo, "import-mpp", "Home", logger);
    await validateAppModule(page, testInfo, "import-mpp", "Upload", logger);
    importedProjectId = await importMppThroughUi(page, testInfo);
    await validateImportedProjectInDb(importedProjectId);
    await traverseProjectModules(page, testInfo, "import-mpp", logger);

    await attachEvidence(page, testInfo, "import-mpp", "flow-complete", logger);
    assertNoCriticalLogs(logger.entries);
    logger.stop();
  });

  test("flow matrix-housing-full-flow", async ({ page }, testInfo) => {
    const logger = createEvidenceLogger(page);
    await authenticateByCookie(page);

    await validateAppModule(page, testInfo, "matrix-housing", "Home", logger);
    await validateAppModule(page, testInfo, "matrix-housing", "Crear Proyecto", logger);
    matrixProjectId = await createMatrixHousingProject(page, testInfo);
    await validateMatrixProjectInDb(matrixProjectId);
    await traverseProjectModules(page, testInfo, "matrix-housing", logger);

    await attachEvidence(page, testInfo, "matrix-housing", "flow-complete", logger);
    assertNoCriticalLogs(logger.entries);
    logger.stop();
  });

  for (const scenario of ["import-mpp", "matrix-housing"] as const) {
    for (const moduleName of APP_MODULES) {
      test(`${scenario} app module ${moduleName}`, async ({ page }, testInfo) => {
        const logger = createEvidenceLogger(page);
        await validateAppModule(page, testInfo, scenario, moduleName, logger);
        await attachEvidence(page, testInfo, scenario, `app-${moduleName}`, logger);
        assertNoCriticalLogs(logger.entries);
        logger.stop();
      });
    }

    for (const projectModule of PROJECT_MODULES) {
      test(`${scenario} project module ${projectModule.label}`, async ({ page }, testInfo) => {
        const logger = createEvidenceLogger(page);
        await authenticateByCookie(page);
        const projectId = await ensureScenarioProject(page, scenario, testInfo);
        await page.goto(`/project/${projectId}`, { waitUntil: "domcontentloaded" });
        await validateProjectModule(page, testInfo, scenario, projectModule, logger);
        await attachEvidence(page, testInfo, scenario, projectModule.id, logger);
        assertNoCriticalLogs(logger.entries);
        logger.stop();
      });
    }
  }
});

async function validateAppModule(
  page: Page,
  testInfo: TestInfo,
  scenario: Scenario,
  moduleName: (typeof APP_MODULES)[number],
  logger: EvidenceLogger,
) {
  if (moduleName === "Login") {
    await createPasswordUser();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /iniciar sesión/i })).toBeVisible();
    // The login form is a server action (`<form action={loginAction}>`), so submitting it
    // triggers a real navigation away from /login. `domcontentloaded` above doesn't wait for
    // every async script, so without this the page's own main-app.js request can still be
    // in flight when we submit; the browser then cancels it mid-navigation, which shows up as
    // a "requestfailed / net::ERR_ABORTED" entry that `assertNoCriticalLogs` flags below. Letting
    // the network settle before we interact avoids racing our own submit against the page's load.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.locator('input[name="email"]').fill(E2E_EMAIL);
    await page.locator('input[name="password"]').fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await expect(page).toHaveURL(/\/$/);
  } else {
    await authenticateByCookie(page);
    if (moduleName === "Home") {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /mis proyectos/i })).toBeVisible();
    }
    if (moduleName === "Upload") {
      // La subida vive en la home. La antigua página /upload se retiró el
      // 2026-08-10: llamaba a `uploadProject`, que guardaba en tablas que ningún
      // lector consultaba, así que decía «importado» y el proyecto no aparecía.
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /mis proyectos/i })).toBeVisible();
      await expect(page.getByLabel(/seleccionar archivo \.mpp/i)).toBeVisible();
    }
    if (moduleName === "Crear Proyecto") {
      await page.goto("/project/new", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /crear cronograma/i })).toBeVisible();
      await expect(page.getByTestId("matrix-editor")).toBeVisible();
    }
  }

  await attachEvidence(page, testInfo, scenario, `app-${moduleName}`, logger);
}

async function traverseProjectModules(
  page: Page,
  testInfo: TestInfo,
  scenario: Scenario,
  logger: EvidenceLogger,
) {
  for (const projectModule of PROJECT_MODULES) {
    await validateProjectModule(page, testInfo, scenario, projectModule, logger);
  }
}

async function validateProjectModule(
  page: Page,
  testInfo: TestInfo,
  scenario: Scenario,
  projectModule: ProjectModule,
  logger: EvidenceLogger,
) {
  await expect(page.getByTestId("view-sidebar")).toBeVisible({ timeout: 30_000 });

  if (projectModule.access === "rolePreset") {
    await page
      .getByTestId("role-view-preset-select")
      .selectOption(projectModule.id);
  } else if (projectModule.access === "palette") {
    await page.getByTestId("command-palette-open").click();
    await page
      .getByTestId("command-palette-input")
      .fill(projectModule.command ?? projectModule.label);
    await page.keyboard.press("Enter");
  } else {
    await page.getByTestId(`sidebar-view-${projectModule.id}`).click();
    await expect(
      page.getByTestId(`sidebar-view-${projectModule.id}`),
    ).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByTestId(projectModule.testId)).toBeVisible({ timeout: 30_000 });
  await exerciseProjectModuleTools(page, projectModule);
  await expect(page.locator("body")).not.toContainText(/application error|runtime error/i);
  await attachEvidence(page, testInfo, scenario, projectModule.id, logger);
}

async function exerciseProjectModuleTools(page: Page, projectModule: ProjectModule) {
  switch (projectModule.id) {
    case "gantt": {
      for (const scale of ["Semana", "Mes", "Día"]) {
        await page.getByRole("button", { name: scale, exact: true }).click();
        await expect(page.getByRole("button", { name: scale, exact: true })).toBeVisible();
      }
      await expect(page.getByTestId("role-view-preset-select")).toBeVisible();
      await page.getByTestId("command-palette-open").click();
      await expect(page.getByTestId("command-palette")).toBeVisible();
      await page.getByTestId("command-palette-input").fill("Matriz");
      await expect(page.getByTestId("command-palette")).toContainText(/Matriz/i);
      await page.getByTestId("command-palette-close").click();
      await expect(page.getByTestId("command-palette")).toBeHidden();
      break;
    }
    case "executive": {
      await expect(page.getByTestId("executive-report-copy")).toBeVisible();
      await expect(page.getByTestId("executive-report-download")).toBeVisible();
      await expect(page.getByTestId("executive-report-print")).toBeVisible();
      await expect(page.getByTestId("executive-kpi").first()).toBeVisible();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByTestId("executive-report-download").click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/reporte.*\.csv$/i);
      await expect(page.getByTestId("executive-report-export-status")).toHaveText(/Descargado/i);
      await page.evaluate(() => {
        window.print = () => undefined;
      });
      await page.getByTestId("executive-report-print").click();
      await expect(page.getByTestId("executive-report-export-status")).toHaveText(/PDF/i);
      break;
    }
    case "tracking": {
      const saveBaseline = page.getByTestId("save-baseline-btn");
      await expect(saveBaseline).toBeVisible();
      await saveBaseline.click();
      await expect(page.getByTestId("tracking-gantt-view")).toBeVisible();
      await expect(page.getByTestId("baseline-select")).toBeVisible();
      break;
    }
    case "taskSheet": {
      const filter = page.getByPlaceholder(/filtrar por nombre/i);
      await expect(filter).toBeVisible();
      await filter.fill("zz-e2e-no-match");
      await expect(page.getByTestId("task-sheet-view")).toContainText(/0 \/|0 tareas/i);
      await filter.clear();
      await expect(page.getByTestId("task-sheet-view")).toContainText(/tareas/i);
      break;
    }
    case "network": {
      await expect(page.getByTestId("network-diagram-view")).toContainText(/tareas|dependencias|red/i);
      break;
    }
    case "resources": {
      await expect(page.getByTestId("resource-sheet-view")).toContainText(/recurso|nombre|tipo/i);
      break;
    }
    case "lob": {
      await expect(page.getByTestId("line-of-balance")).toContainText(/línea|balance|No se detectaron/i);
      break;
    }
    case "matrix": {
      for (const tab of ["Alcances", "Ubicaciones", "Matriz"]) {
        await page.getByRole("button", { name: tab, exact: true }).click();
        await expect(page.getByTestId("matrix-editor")).toBeVisible();
      }
      await expect(page.getByTestId("matrix-editor")).toContainText(/disciplinas|ubicaciones|celdas/i);
      break;
    }
    case "scurve": {
      await expect(page.getByTestId("s-curve-view")).toContainText(/curva|avance|valor|presupuesto/i);
      for (const subview of ["Curva de Presupuesto", "Valor Ganado", "Curva de Cronograma"]) {
        await page.getByRole("button", { name: subview, exact: true }).click();
        await expect(page.getByTestId("s-curve-view")).toContainText(
          subview === "Valor Ganado" ? /valor ganado/i : /curva/i,
        );
      }
      break;
    }
    case "bottlenecks": {
      await expect(page.getByTestId("bottlenecks-view")).toContainText(/cuello|ruta|crítica|No se/i);
      break;
    }
    case "conflictos": {
      await expect(page.getByTestId("conflicts-view")).toContainText(/conflicto|dependencia|No se/i);
      break;
    }
    case "unidadTipica": {
      await expect(page.getByTestId("typical-unit-view")).toContainText(/unidad|típica|repetit/i);
      await page.getByRole("button", { name: "Consolidado", exact: true }).click();
      await expect(page.getByTestId("typical-unit-view")).toContainText(/consolidado|unidad/i);
      await page.getByRole("button", { name: "Por Nivel", exact: true }).click();
      await expect(page.getByTestId("typical-unit-view")).toContainText(/nivel|unidad/i);
      break;
    }
    case "calendario": {
      await expect(page.getByTestId("calendar-view")).toContainText(/calendario|laboral|tarea/i);
      await page.getByTitle("Mes siguiente").click();
      await expect(page.getByTestId("calendar-view")).toBeVisible();
      await page.getByTitle("Mes anterior").click();
      await expect(page.getByTestId("calendar-view")).toContainText(/laborales/i);
      break;
    }
    case "settings": {
      await expect(page.getByTestId("calendar-settings-view")).toContainText(/calendario laboral/i);
      const saturday = page.getByRole("button", { name: "Sáb", exact: true });
      await saturday.click();
      await expect(page.getByTestId("calendar-settings-view")).toBeVisible();
      await saturday.click();
      break;
    }
    default:
      break;
  }
}

/**
 * El botón "Subir Archivo .mpp" llega habilitado en el HTML que sirve el servidor
 * (disabled={isProcessing} arranca en false), así que toBeEnabled() no detecta
 * hidratación. El onClick real (que hace inputRef.current.click() y abre el selector
 * de archivos) solo existe una vez que React hidrató el componente: un clic disparado
 * antes de ese momento es inerte y no puede "esperarse" después, porque ya ocurrió.
 * Por eso la señal de interactividad es reintentar el clic hasta que efectivamente
 * abra el selector nativo ("filechooser"), en vez de adivinar cuánto tardará la
 * hidratación con un timeout fijo o con networkidle.
 */
async function clickUntilFileChooserOpens(
  page: Page,
  button: Locator,
  options: { attempts?: number; perAttemptTimeoutMs?: number } = {},
): Promise<FileChooser> {
  const attempts = options.attempts ?? 20;
  const perAttemptTimeoutMs = options.perAttemptTimeoutMs ?? 750;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: perAttemptTimeoutMs }),
        button.click(),
      ]);
      return fileChooser;
    } catch {
      // Reintenta: el clic anterior probablemente ocurrió antes de que React
      // hidratara el botón, así que no tuvo ningún efecto.
    }
  }
  throw new Error(
    `El botón "Subir Archivo .mpp" nunca abrió el selector de archivos tras ${attempts} intentos ` +
      `(~${attempts * perAttemptTimeoutMs}ms). La app no llegó a hidratarse a tiempo, o el onClick ` +
      `dejó de invocar inputRef.current.click().`,
  );
}

async function importMppThroughUi(page: Page, testInfo: TestInfo): Promise<string> {
  const mppPath = resolveMppPath();
  testInfo.attach("mpp-source", {
    body: JSON.stringify({ requestedPath: EXACT_MPP_PATH, actualPath: mppPath }, null, 2),
    contentType: "application/json",
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const uploadButton = page.getByRole("button", { name: /subir archivo \.mpp/i });
  await expect(uploadButton).toBeVisible();
  const fileChooser = await clickUntilFileChooserOpens(page, uploadButton);

  // Con la interactividad confirmada, se selecciona el archivo y se verifica que la
  // petición de importación realmente salga antes de esperar la navegación final:
  // así, si algo se rompe aquí, el error es "nunca se disparó la petición" en vez de
  // agotar 180s en un waitForURL sin pistas.
  await Promise.all([
    page.waitForRequest(
      (request) => request.url().includes("/api/import-mpp") && request.method() === "POST",
      { timeout: 15_000 },
    ),
    fileChooser.setFiles(mppPath),
  ]);

  await page.waitForURL(/\/project\/\d+/, { timeout: 180_000 });

  const projectId = projectIdFromUrl(page.url());
  await expect(page.getByTestId("gantt-view")).toBeVisible({ timeout: 60_000 });
  return projectId;
}

async function createMatrixHousingProject(page: Page, testInfo: TestInfo): Promise<string> {
  const projectName = `E2E Vivienda Matricial 3 Etapas Urbanismo ${Date.now()}`;
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/project/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("matrix-editor")).toBeVisible({ timeout: 30_000 });
  // `matrix-editor` visible only proves the (SSR-rendered) markup is on the page, not that React
  // has finished hydrating and attached event handlers yet. Interacting too early is exactly the
  // kind of race addMatrixItem's retry loop compensates for, but on a slow first compile (Next.js
  // dev server, on-demand route compilation) hydration can still be lagging behind by more than
  // the retry budget. Waiting for the network to go idle after the initial HTML/JS payload gives
  // hydration time to complete before the first interaction.
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.locator('[data-testid="matrix-editor"] input').first().fill(projectName);
  await page.getByLabel("Inicio").fill("2026-01-05");

  for (const scope of ["Estructura", "Arquitectura", "Redes MEP", "Urbanismo"]) {
    await addMatrixItem(page, "Nueva disciplina", "Disciplina", scope);
  }

  await page.getByRole("button", { name: "Ubicaciones" }).click();
  for (const area of ["Etapa 1", "Etapa 2", "Etapa 3", "Urbanismo"]) {
    await addMatrixItem(page, "Nueva ubicación", "Ubicación", area);
  }

  await createTowerWithFloors(page, "Etapa 1", "Torre 1");
  await createTowerWithFloors(page, "Etapa 2", "Torre 2");
  await createTowerWithFloors(page, "Etapa 3", "Torre 3");
  // "Urbanismo" es el NOMBRE del nodo padre, no un tipo válido de ubicación (areaTypeOptions en
  // MatrixEditorView.tsx solo admite categorías estructurales: Etapa, Torre, Nivel, Piso, etc.).
  // "Zona" es la categoría que mejor encaja para estos hijos de infraestructura exterior (Vías,
  // Redes exteriores, Zonas comunes). El propio nodo "Urbanismo" no se renombra de tipo: al
  // crearse vía addMatrixItem, inferAreaTypeForLabel no reconoce "urbanismo" como palabra clave y
  // cae en su default "Ubicacion", que ya es una opción válida del <select>.
  await createAreaChildren(page, "Urbanismo", ["Vías", "Redes exteriores", "Zonas comunes"], "Zona");

  await expect(page.getByText(/4 disciplinas · 33 ubicaciones/i)).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Activar todas las celdas" }).click();
  await expect(page.getByText(/Preview: \d+ tareas · 0 alertas/i)).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Guardar y generar cronograma" }).click();
  await page.waitForURL(/\/project\/\d+/, { timeout: 120_000 });
  await expect(page.getByTestId("gantt-view")).toBeVisible({ timeout: 60_000 });

  const projectId = projectIdFromUrl(page.url());
  testInfo.attach("matrix-project-created", {
    body: JSON.stringify({ projectId, projectName }, null, 2),
    contentType: "application/json",
  });
  return projectId;
}

async function addMatrixItem(page: Page, buttonName: string, type: string, value: string) {
  const input = page.getByPlaceholder(buttonName);
  // The button's onClick handler reads the input's React state via closure. `fill()` writes the
  // DOM value directly and only *afterwards* dispatches a synthetic "input" event, so a
  // `toHaveValue` assertion right after `fill()` is trivially true (the DOM already has the
  // target value regardless of whether React's onChange ran) and does not prove React's state
  // was actually updated before the click fires. `pressSequentially` instead sends real
  // per-character keyboard events, each synchronously handled by React's event system before the
  // next one is dispatched, so by the time it resolves the component state is guaranteed to be
  // in sync with the DOM — no fixed delay needed. Confirmed empirically: fill()+toHaveValue lost
  // ~50% of rapid-fire adds under load, pressSequentially lost none across the same stress test.
  // Even with real per-character keyboard events, firing them back-to-back with zero delay lets
  // the last keystroke's React state commit race the immediately-following click: React 18 can
  // schedule that final onChange update on the scheduler instead of flushing it synchronously
  // before the click's mousedown fires, so the click handler reads a stale (sometimes empty)
  // input state and silently no-ops. A tiny inter-key delay gives React time to flush before we
  // click, without reintroducing the fill()-style DOM/state desync this replaced. Confirmed
  // empirically: delay: 0 lost the very first add (before any other interaction warms up the
  // scheduler) in a tight reproduction; delay: 20 was reliable across repeated runs.
  await input.pressSequentially(value, { delay: 20 });
  const button = page.getByRole("button", { name: type, exact: true });

  // Belt-and-suspenders on top of the inter-key delay above: on a loaded page (e.g. first add
  // right after hydration) a single click can still race a deferred React commit and no-op
  // (the click fires, but addScope/addArea reads stale state). The add is idempotent-safe to
  // retry from the test's point of view: success is always observed as "the input cleared itself"
  // (the component resets newScopeName/newAreaName to "" after a successful add), so we just
  // re-click until that happens instead of trusting a single fire-and-forget click.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await button.click();
    try {
      await expect(input).toHaveValue("", { timeout: 2_000 });
      return;
    } catch {
      // input still holds the typed value: the click didn't register, retry.
    }
  }
  await expect(input).toHaveValue("");
}

async function createTowerWithFloors(page: Page, stageName: string, towerName: string) {
  await page.getByRole("button", { name: `Agregar hijo a ${stageName}`, exact: true }).click();
  await renameArea(page, "Nueva sub-ubicación", towerName, "Torre");

  for (let floor = 1; floor <= 10; floor += 1) {
    await page.getByRole("button", { name: `Agregar hijo a ${towerName}`, exact: true }).click();
    await renameArea(
      page,
      "Nueva sub-ubicación",
      `Piso ${String(floor).padStart(2, "0")}`,
      "Piso",
    );
  }
}

async function createAreaChildren(page: Page, parentName: string, children: string[], type: string) {
  for (const child of children) {
    await page.getByRole("button", { name: `Agregar hijo a ${parentName}`, exact: true }).click();
    await renameArea(page, "Nueva sub-ubicación", child, type);
  }
}

async function renameArea(page: Page, currentName: string, nextName: string, type: string) {
  const nameInput = page.getByLabel(`Nombre ubicación ${currentName}`).last();
  await nameInput.fill(nextName);
  // The type field is a native <select> (not a text input), so it must be driven with
  // selectOption(); fill() throws "Element is not an <input>, <textarea> or [contenteditable]".
  const typeInput = page.getByLabel(`Tipo ubicación ${nextName}`).last();
  await typeInput.selectOption(type);
}

async function ensureScenarioProject(
  page: Page,
  scenario: Scenario,
  testInfo: TestInfo,
): Promise<string> {
  if (scenario === "import-mpp") {
    if (!importedProjectId) {
      await authenticateByCookie(page);
      importedProjectId = await importMppThroughUi(page, testInfo);
      await validateImportedProjectInDb(importedProjectId);
    }
    return importedProjectId;
  }

  if (!matrixProjectId) {
    await authenticateByCookie(page);
    matrixProjectId = await createMatrixHousingProject(page, testInfo);
    await validateMatrixProjectInDb(matrixProjectId);
  }
  return matrixProjectId;
}

async function authenticateByCookie(page: Page) {
  const sessionToken = await createSessionUser();
  await page.context().addCookies([
    {
      name: "vg_session",
      value: sessionToken,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    },
  ]);
}

async function createSessionUser(): Promise<string> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const userId = await upsertUser(client, E2E_EMAIL, hashPassword(E2E_PASSWORD));
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await client.query("DELETE FROM user_sessions WHERE user_id = $1", [userId]);
    await client.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, NOW() + INTERVAL '8 hours', NOW())`,
      [userId, tokenHash],
    );
    return token;
  } finally {
    await client.end();
  }
}

async function createPasswordUser() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await upsertUser(client, E2E_EMAIL, hashPassword(E2E_PASSWORD));
  } finally {
    await client.end();
  }
}

async function upsertUser(client: Client, email: string, passwordHash: string): Promise<string> {
  const user = await client.query(
    `INSERT INTO users (email, name, password_hash, provider, created_at, updated_at)
     VALUES ($1, $2, $3, 'password', NOW(), NOW())
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, provider = 'password', updated_at = NOW()
     RETURNING id`,
    [email, "E2E Full App", passwordHash],
  );
  await client.query(
    `INSERT INTO roles (id, name, description)
     VALUES ('admin', 'Administrador', 'Acceso completo E2E')
     ON CONFLICT (id) DO NOTHING`,
  );
  for (const permission of [
    "project:read",
    "project:create",
    "project:update",
    "project:delete",
    "auth:manage",
    "rbac:manage",
  ]) {
    await client.query(
      `INSERT INTO permissions (id, description)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [permission, permission],
    );
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ('admin', $1)
       ON CONFLICT DO NOTHING`,
      [permission],
    );
  }
  await client.query(
    `INSERT INTO user_roles (user_id, role_id, created_at)
     VALUES ($1, 'admin', NOW())
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [user.rows[0].id],
  );
  return user.rows[0].id;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function validateImportedProjectInDb(projectId: string) {
  const project = await loadProjectData(projectId);
  expect(project.tasks.length).toBeGreaterThan(0);
  expect(project.matrixPlan).toBeTruthy();
  expect(project.matrixPlan?.cells?.length ?? 0).toBeGreaterThan(0);
}

async function validateMatrixProjectInDb(projectId: string) {
  const project = await loadProjectData(projectId);
  const matrixPlan = project.matrixPlan;
  expect(matrixPlan).toBeTruthy();
  expect(project.tasks.length).toBeGreaterThan(0);
  expect(countLeafNodes(matrixPlan?.scopeTree ?? [])).toBe(4);
  expect(countLeafNodes(matrixPlan?.areas ?? [])).toBe(33);
  expect(matrixPlan?.cells?.length).toBe(132);
  expect(matrixPlan?.cells?.every((cell: { active: boolean }) => cell.active)).toBe(true);
}

async function loadProjectData(projectId: string) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT id, name, project_data FROM projects WHERE id = $1",
      [projectId],
    );
    expect(result.rowCount).toBe(1);
    return result.rows[0].project_data;
  } finally {
    await client.end();
  }
}

function countLeafNodes(nodes: Array<{ children?: unknown[] }>): number {
  return nodes.reduce((total, node) => {
    if (!node.children || node.children.length === 0) return total + 1;
    return total + countLeafNodes(node.children as Array<{ children?: unknown[] }>);
  }, 0);
}

function createEvidenceLogger(page: Page): EvidenceLogger {
  const entries: BrowserLogEntry[] = [];
  const push = (entry: Omit<BrowserLogEntry, "timestamp">) => {
    entries.push({ ...entry, timestamp: new Date().toISOString() });
  };

  const onConsole = (message: ConsoleMessage) => {
    if (["error", "warning"].includes(message.type())) {
      push({ type: "console", level: message.type(), text: message.text() });
    }
  };
  const onPageError = (error: Error) => push({ type: "pageerror", text: error.message });
  const onRequestFailed = (request: Request) => {
    push({
      type: "requestfailed",
      method: request.method(),
      url: request.url(),
      text: request.failure()?.errorText,
    });
  };
  const onResponse = (response: Response) => {
    if (response.status() >= 400) {
      push({
        type: "response",
        status: response.status(),
        method: response.request().method(),
        url: response.url(),
      });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    entries,
    stop: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
}

async function attachEvidence(
  page: Page,
  testInfo: TestInfo,
  scenario: Scenario,
  moduleName: string,
  logger: EvidenceLogger,
) {
  const safeName = `${scenario}-${moduleName}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const overflow = await page.evaluate(() => ({
    url: window.location.href,
    viewportWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const hasDocumentOverflow =
    Math.max(overflow.htmlScrollWidth, overflow.bodyScrollWidth) >
    overflow.htmlClientWidth + 2;
  expect(
    Math.max(overflow.htmlScrollWidth, overflow.bodyScrollWidth),
    JSON.stringify(overflow, null, 2),
  ).toBeLessThanOrEqual(overflow.htmlClientWidth + 2);
  const screenshotPath = testInfo.outputPath(`${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`${safeName}-screenshot`, {
    path: screenshotPath,
    contentType: "image/png",
  });
  const log = {
    scenario,
    module: moduleName,
    url: page.url(),
    timestamp: new Date().toISOString(),
    console: logger.entries.filter((entry) => entry.type === "console"),
    pageerror: logger.entries.filter((entry) => entry.type === "pageerror"),
    requestfailed: logger.entries.filter((entry) => entry.type === "requestfailed"),
    http4xx: logger.entries.filter(
      (entry) =>
        entry.type === "response" &&
        (entry.status ?? 0) >= 400 &&
        (entry.status ?? 0) < 500,
    ),
    http5xx: logger.entries.filter(
      (entry) => entry.type === "response" && (entry.status ?? 0) >= 500,
    ),
    htmlScrollWidth: overflow.htmlScrollWidth,
    bodyScrollWidth: overflow.bodyScrollWidth,
    clientWidth: overflow.clientWidth,
    hasDocumentOverflow,
    overflow,
    entries: logger.entries,
  };
  const logPath = testInfo.outputPath(`${safeName}.logs.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  await testInfo.attach(`${safeName}-logs`, {
    path: logPath,
    contentType: "application/json",
  });
}

function assertNoCriticalLogs(entries: BrowserLogEntry[]) {
  const critical = entries.filter((entry) => {
    if (
      entry.type === "requestfailed" &&
      entry.text === "net::ERR_ABORTED" &&
      (entry.url?.includes("_rsc=") ||
        entry.url?.endsWith("/project/new") ||
        entry.url?.endsWith("/login") ||
        /\/project\/\d+$/.test(entry.url ?? "") ||
        // Ruido de Fast Refresh del servidor de desarrollo (next dev); no existe en producción.
        entry.url?.endsWith(".hot-update.json"))
    ) {
      return false;
    }
    if (entry.type === "pageerror" || entry.type === "requestfailed") return true;
    if (entry.type === "response" && (entry.status ?? 0) >= 500) return true;
    return false;
  });
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
}

function resolveMppPath(): string {
  const envPath = process.env.E2E_MPP_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  if (fs.existsSync(EXACT_MPP_PATH)) return EXACT_MPP_PATH;

  const repoFixturePath = path.resolve(
    __dirname,
    "../../aia-ms-project/20260312 DA PORTO TORRE 3.mpp",
  );
  if (fs.existsSync(repoFixturePath)) return repoFixturePath;

  throw new Error(
    `No existe el archivo MPP requerido. Se buscaron estas opciones en orden: ` +
      `1) $E2E_MPP_PATH=${envPath ?? "(no definida)"}; ` +
      `2) ruta fija del autor original: ${EXACT_MPP_PATH}; ` +
      `3) fixture del repo: ${repoFixturePath}.`,
  );
}

function projectIdFromUrl(url: string): string {
  const match = url.match(/\/project\/(\d+)/);
  if (!match) throw new Error(`No se pudo extraer projectId desde URL: ${url}`);
  return match[1];
}
