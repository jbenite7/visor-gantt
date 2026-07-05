import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "crypto";
import { mkdirSync } from "fs";
import { Client } from "pg";

const SESSION_COOKIE = "vg_session";
const E2E_PROJECT_PREFIX = "E2E Visual Audit";
const OUTPUT_DIR = "tmp/visual-audit-2026-07-03";

type AuditViewport = "desktop" | "mobile";

function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://visoruser:visorpass@localhost:5432/visormpp";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function withClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function ensureE2ESchema(client: Client) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      project_data JSONB DEFAULT '{"tasks":[],"resources":[],"assignments":[],"budgetItems":[],"budgetMappings":[],"baselines":[]}',
      start_date TIMESTAMP,
      finish_date TIMESTAMP,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      provider TEXT NOT NULL DEFAULT 'password',
      microsoft_oid TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT ''
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      description TEXT DEFAULT ''
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, role_id)
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const permissions = [
    ["project:read", "Ver proyectos"],
    ["project:create", "Crear proyectos"],
    ["project:update", "Editar proyectos"],
    ["project:delete", "Eliminar proyectos"],
  ];
  for (const [id, description] of permissions) {
    await client.query(
      `INSERT INTO permissions (id, description)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description`,
      [id, description],
    );
  }
  await client.query(
    `INSERT INTO roles (id, name)
     VALUES ('admin', 'Administrador')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
  );
  await client.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT 'admin', id FROM permissions
     ON CONFLICT DO NOTHING`,
  );
}

async function authenticate(page: Page) {
  const token = randomBytes(32).toString("hex");
  await withClient(async (client) => {
    await ensureE2ESchema(client);
    const result = await client.query(
      `INSERT INTO users (email, name, provider)
       VALUES ($1, $2, 'password')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ["e2e-visual-audit@visor.local", "E2E Visual Audit"],
    );
    const userId = result.rows[0].id as string;
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, 'admin')
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
    await client.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
      [userId, hashToken(token)],
    );
  });

  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function deleteE2EProjects() {
  await withClient(async (client) => {
    await ensureE2ESchema(client);
    await client.query(`DELETE FROM projects WHERE name LIKE $1`, [`${E2E_PROJECT_PREFIX}%`]);
  });
}

async function createProject(name: string): Promise<string> {
  return withClient(async (client) => {
    await ensureE2ESchema(client);
    const projectData = {
      name,
      tasks: [
        {
          id: 1,
          name: "Obra gris",
          start: "2026-01-05T00:00:00.000Z",
          finish: "2026-01-05T00:00:00.000Z",
          duration: 1,
          progress: 20,
          percentComplete: 20,
          isCritical: false,
          isMilestone: false,
          isSummary: true,
          outlineLevel: 1,
          dependencies: [],
          resourceNames: ["Equipo direccion"],
          wbs: "1",
          cost: 2000,
        },
        {
          id: 2,
          name: "Formaleta torre 1",
          start: "2026-01-06T00:00:00.000Z",
          finish: "2026-01-08T00:00:00.000Z",
          duration: 3,
          progress: 35,
          percentComplete: 35,
          isCritical: true,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 2,
          dependencies: [],
          resourceNames: ["Cuadrilla A"],
          matrixSource: {
            matrixPlanId: "visual-matrix",
            scopeId: "estructura",
            areaId: "torre-1",
            cellId: "cell-torre-1",
            recipeId: "obra-gris",
            activityId: "formaleta",
          },
          wbs: "1.1",
          cost: 4200,
        },
        {
          id: 3,
          name: "Acero torre 1",
          start: "2026-01-09T00:00:00.000Z",
          finish: "2026-01-11T00:00:00.000Z",
          duration: 3,
          progress: 20,
          percentComplete: 20,
          isCritical: true,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 2,
          dependencies: [{ from: 2, to: 3, type: "FS", lag: 0 }],
          resourceNames: ["Cuadrilla B"],
          matrixSource: {
            matrixPlanId: "visual-matrix",
            scopeId: "estructura",
            areaId: "torre-1",
            cellId: "cell-torre-1",
            recipeId: "obra-gris",
            activityId: "acero",
          },
          wbs: "1.2",
          cost: 5300,
        },
        {
          id: 4,
          name: "Formaleta torre 2",
          start: "2026-01-07T00:00:00.000Z",
          finish: "2026-01-09T00:00:00.000Z",
          duration: 3,
          progress: 10,
          percentComplete: 10,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 2,
          dependencies: [{ from: 2, to: 4, type: "SS", lag: 1 }],
          resourceNames: ["Cuadrilla A"],
          matrixSource: {
            matrixPlanId: "visual-matrix",
            scopeId: "estructura",
            areaId: "torre-2",
            cellId: "cell-torre-2",
            recipeId: "obra-gris",
            activityId: "formaleta",
          },
          wbs: "1.3",
          cost: 3900,
        },
        {
          id: 5,
          name: "Hito entrega estructura",
          start: "2026-01-12T00:00:00.000Z",
          finish: "2026-01-12T00:00:00.000Z",
          duration: 0,
          progress: 0,
          percentComplete: 0,
          isCritical: true,
          isMilestone: true,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [{ from: 3, to: 5, type: "FS", lag: 0 }],
          deadline: "2026-01-11T00:00:00.000Z",
          wbs: "2",
          cost: 0,
        },
      ],
      resources: [
        { uid: 1, name: "Cuadrilla A", type: "work", rate: 100, availability: 100, group: "Estructura" },
        { uid: 2, name: "Cuadrilla B", type: "work", rate: 120, availability: 100, group: "Estructura" },
      ],
      assignments: [
        { taskId: 2, resourceId: 1, units: 100, cost: 2400 },
        { taskId: 3, resourceId: 2, units: 100, cost: 2880 },
        { taskId: 4, resourceId: 1, units: 100, cost: 2400 },
      ],
      budgetItems: [
        {
          id: "b1",
          category: "materials",
          subcategory: "Estructura",
          budgetedAmount: 16000,
          spentAmount: 7200,
          period: "2026-01",
          mappedTaskIds: [2, 3],
        },
        {
          id: "b2",
          category: "labor",
          subcategory: "Mano de obra",
          budgetedAmount: 9000,
          spentAmount: 2400,
          period: "2026-01",
          mappedTaskIds: [4],
        },
      ],
      budgetMappings: [
        { budgetItemId: "b1", taskId: 2, amount: 4200 },
        { budgetItemId: "b1", taskId: 3, amount: 5300 },
        { budgetItemId: "b2", taskId: 4, amount: 3900 },
      ],
      baselines: [],
      matrixPlan: {
        id: "visual-matrix",
        name: "Matriz visual auditoria",
        templateId: "visual-template",
        startDate: "2026-01-05",
        scopeTree: [{ id: "estructura", name: "Estructura", type: "disciplina" }],
        areas: [
          { id: "torre-1", name: "Torre 1", type: "torre" },
          { id: "torre-2", name: "Torre 2", type: "torre" },
        ],
        recipes: [
          {
            id: "obra-gris",
            name: "Obra gris",
            activities: [
              { id: "formaleta", name: "Formaleta", productivityPerDay: 1, defaultQuantity: 1, unit: "frente" },
              { id: "acero", name: "Acero", productivityPerDay: 1, defaultQuantity: 1, unit: "frente" },
            ],
            dependencies: [{ predecessorActivityId: "formaleta", successorActivityId: "acero", type: "FS", lagDays: 0 }],
          },
        ],
        cells: [
          {
            id: "cell-torre-1",
            scopeId: "estructura",
            areaId: "torre-1",
            recipeId: "obra-gris",
            active: true,
            quantity: 1,
            unit: "frente",
            generatedTaskIds: [2, 3],
            syncedTaskIds: [2, 3],
          },
          {
            id: "cell-torre-2",
            scopeId: "estructura",
            areaId: "torre-2",
            recipeId: "obra-gris",
            active: true,
            quantity: 1,
            unit: "frente",
            generatedTaskIds: [4],
            syncedTaskIds: [4],
          },
        ],
      },
      uiSettings: { locale: "es", interactionMode: "advanced", taskFilter: { text: "", type: "all" } },
      taskColumnSettings: {
        visible: ["id", "wbs", "name", "summary", "duration", "start", "finish", "predecessors", "progress", "critical"],
        widths: {},
        labelLocale: "es",
      },
      planningAuditEvents: [],
    };
    const result = await client.query(
      `INSERT INTO projects (name, project_data)
       VALUES ($1, $2)
       RETURNING id`,
      [name, JSON.stringify(projectData)],
    );
    return String(result.rows[0].id);
  });
}

async function assertHealthyPage(page: Page) {
  await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error");
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("Hydration failed");
  await expect(page.locator("body")).not.toContainText("Error:");
}

async function capture(page: Page, viewport: AuditViewport, name: string) {
  await assertHealthyPage(page);
  await page.screenshot({
    path: `${OUTPUT_DIR}/${viewport}-${name}.png`,
    fullPage: false,
  });
}

async function setAuditViewport(page: Page, viewport: AuditViewport) {
  await page.setViewportSize(viewport === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
}

async function clickResourceSubView(page: Page, label: string) {
  const clicked = await page.evaluate((targetLabel) => {
    const button = [...document.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === targetLabel,
    ) as HTMLButtonElement | undefined;
    if (!button) return false;
    button.click();
    return true;
  }, label);
  expect(clicked).toBe(true);
  await page.waitForTimeout(250);
}

test.beforeAll(() => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await deleteE2EProjects();
  await authenticate(page);
});

test.afterEach(async () => {
  await deleteE2EProjects();
});

test("captura auditoria visual final desktop y mobile", async ({ page }) => {
  test.setTimeout(300_000);
  const projectId = await createProject(`${E2E_PROJECT_PREFIX} ${Date.now()}`);

  for (const viewport of ["desktop", "mobile"] as const) {
    await setAuditViewport(page, viewport);

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await capture(page, viewport, "home-auth");

    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
    await capture(page, viewport, "login");

    await page.goto("/upload");
    await expect(page.locator("body")).toBeVisible();
    await capture(page, viewport, "upload");

    await page.goto("/project/new");
    await expect(page.locator("body")).toBeVisible();
    await capture(page, viewport, "project-new");

    await page.goto("/gantt-demo");
    await expect(page.getByTestId("gantt-view")).toBeVisible();
    await capture(page, viewport, "gantt-demo");

    await page.goto(`/project/${projectId}`);
    await expect(page.getByTestId("gantt-view")).toBeVisible();
    await capture(page, viewport, "project-gantt");

    const viewCaptures = [
      ["executive", "project-executive"],
      ["tracking", "project-tracking"],
      ["taskSheet", "project-task-sheet"],
      ["network", "project-network"],
      ["resources", "project-resources"],
      ["lob", "project-line-of-balance"],
      ["matrix", "project-matrix"],
      ["scurve", "project-scurve"],
      ["bottlenecks", "project-bottlenecks"],
      ["settings", "project-calendar"],
    ] as const;

    for (const [view, name] of viewCaptures) {
      await page.getByTestId(`sidebar-view-${view}`).click();
      await page.waitForTimeout(250);
      await capture(page, viewport, name);
    }

    await page.getByTestId("sidebar-view-resources").click();
    await clickResourceSubView(page, "Uso de Recursos");
    await capture(page, viewport, "project-resource-usage");
    await clickResourceSubView(page, "Asignaciones");
    await capture(page, viewport, "project-assignments");
    await clickResourceSubView(page, "Presupuesto");
    await capture(page, viewport, "project-budget");
    await clickResourceSubView(page, "Mapeo");
    await capture(page, viewport, "project-budget-mapping");
  }
});
