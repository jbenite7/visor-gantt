import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "crypto";
import { Client } from "pg";
import { e2eProjectName } from "./helpers/runId";

const SESSION_COOKIE = "vg_session";
const E2E_PROJECT_PREFIX = "E2E Dependency Persistence";

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
      ["e2e-dependencies@visor.local", "E2E Dependencies"],
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

async function createProject(name: string): Promise<string> {
  return withClient(async (client) => {
    await ensureE2ESchema(client);
    const projectData = {
      name,
      tasks: [
        {
          id: 1,
          name: "Cimentacion",
          start: "2026-01-05T00:00:00.000Z",
          finish: "2026-01-06T00:00:00.000Z",
          duration: 2,
          progress: 0,
          percentComplete: 0,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
          wbs: "1",
        },
        {
          id: 2,
          name: "Estructura",
          start: "2026-01-07T00:00:00.000Z",
          finish: "2026-01-09T00:00:00.000Z",
          duration: 3,
          progress: 0,
          percentComplete: 0,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
          wbs: "2",
        },
        {
          id: 3,
          name: "Fachada",
          start: "2026-01-10T00:00:00.000Z",
          finish: "2026-01-11T00:00:00.000Z",
          duration: 2,
          progress: 0,
          percentComplete: 0,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
          wbs: "3",
        },
      ],
      resources: [],
      assignments: [],
      budgetItems: [],
      budgetMappings: [],
      baselines: [],
      uiSettings: { locale: "es", taskFilter: { text: "", type: "all" } },
      taskColumnSettings: {
        visible: ["id", "wbs", "name", "duration", "start", "finish", "predecessors", "progress"],
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

async function loadProjectData(projectId: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT project_data FROM projects WHERE id = $1`,
      [projectId],
    );
    return result.rows[0]?.project_data;
  });
}

test.beforeEach(async ({ page }) => {
  await authenticate(page);
});

test("persiste dependencias creadas desde popover y panel lateral tras recargar", async ({ page }) => {
  test.setTimeout(75_000);
  const projectName = e2eProjectName(E2E_PROJECT_PREFIX);
  const projectId = await createProject(projectName);

  await page.goto(`/project/${projectId}`);
  await expect(page.getByTestId("gantt-view")).toBeVisible();

  // El control de predecesoras aparece al pasar por la fila (E40): el dato se
  // lee siempre, el botón solo cuando se va a usar.
  await page.getByTestId("cell-predecessors-2").hover();
  await page.getByTestId("dependency-popover-open-2").click();
  await page.getByTestId("dependency-search").fill("Cimentacion");
  await page.getByTestId("dependency-type-select").selectOption("FF");
  await page.getByTestId("dependency-lag-input").fill("2");
  await page.getByTestId("dependency-add").click();
  await page.getByTestId("dependency-apply").click();

  await page.locator('[data-testid="gantt-row"][data-task-id="2"]').click();
  await page.getByTestId("dependency-panel-open").click();
  await page.getByTestId("dependency-panel-successor-task-select").selectOption("3");
  await page.getByTestId("dependency-panel-successor-type-select").selectOption("SF");
  await page.getByTestId("dependency-panel-successor-lag-input").fill("4");
  await page.getByTestId("dependency-panel-add-successor").click();
  await page.getByTestId("dependency-panel-apply").click();

  await expect(page.getByText("Guardado")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => {
      const data = await loadProjectData(projectId);
      const tasks = data?.tasks ?? [];
      const task2 = tasks.find((task: { id: number }) => task.id === 2);
      const task3 = tasks.find((task: { id: number }) => task.id === 3);
      return [task2?.dependencies?.[0] ?? null, task3?.dependencies?.[0] ?? null];
    }, { timeout: 15_000 })
    .toEqual([
      { from: 1, to: 2, type: "FF", lag: 2 },
      { from: 2, to: 3, type: "SF", lag: 4 },
    ]);

  await page.reload();
  await expect(page.getByTestId("gantt-view")).toBeVisible();
  await expect(page.locator('[data-testid="gantt-row"][data-task-id="2"]')).toContainText("1FF+2d");
  await expect(page.locator('[data-testid="gantt-row"][data-task-id="3"]')).toContainText("2SF+4d");
});
