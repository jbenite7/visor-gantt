import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "crypto";
import { Client } from "pg";

const SESSION_COOKIE = "vg_session";
const E2E_PROJECT_PREFIX = "E2E Hierarchy Persistence";

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
      ["e2e-hierarchy@visor.local", "E2E Hierarchy"],
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
          name: "Capitulo obra gris",
          start: "2026-01-05T00:00:00.000Z",
          finish: "2026-01-05T00:00:00.000Z",
          duration: 1,
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
          name: "Vaciado concreto",
          start: "2026-01-06T00:00:00.000Z",
          finish: "2026-01-08T00:00:00.000Z",
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
          name: "Curado losa",
          start: "2026-01-09T00:00:00.000Z",
          finish: "2026-01-10T00:00:00.000Z",
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
        visible: ["id", "wbs", "name", "summary", "duration", "start", "finish", "progress"],
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
  await deleteE2EProjects();
  await authenticate(page);
});

test.afterEach(async () => {
  await deleteE2EProjects();
});

test("persiste jerarquia creada desde la toolbar tras recargar", async ({ page }) => {
  test.setTimeout(75_000);
  const projectName = `${E2E_PROJECT_PREFIX} ${Date.now()}`;
  const projectId = await createProject(projectName);

  await page.goto(`/project/${projectId}`);
  await expect(page.getByTestId("gantt-view")).toBeVisible();

  await page.locator('[data-testid="gantt-row"][data-task-id="2"]').click();
  await page.getByTestId("hierarchy-indent").click();

  await expect(page.getByText("Guardado")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => {
      const data = await loadProjectData(projectId);
      const tasks = data?.tasks ?? [];
      return tasks.map((task: { id: number; wbs?: string; outlineLevel: number; isSummary: boolean }) => ({
        id: task.id,
        wbs: task.wbs,
        outlineLevel: task.outlineLevel,
        isSummary: task.isSummary,
      }));
    }, { timeout: 15_000 })
    .toEqual([
      { id: 1, wbs: "1", outlineLevel: 1, isSummary: true },
      { id: 2, wbs: "1.1", outlineLevel: 2, isSummary: false },
      { id: 3, wbs: "2", outlineLevel: 1, isSummary: false },
    ]);

  await page.reload();
  await expect(page.getByTestId("gantt-view")).toBeVisible();
  await expect(page.locator('[data-testid="gantt-row"][data-task-id="1"]')).toContainText("Capitulo obra gris");
  await expect(page.locator('[data-testid="gantt-row"][data-task-id="1"]')).toContainText("Sí");
  await expect(page.locator('[data-testid="gantt-row"][data-task-id="2"]')).toContainText("1.1");
  await expect(page.locator('[data-testid="gantt-row"][data-task-id="2"]')).toContainText("Vaciado concreto");
  await expect(page.locator('[data-testid="gantt-row"][data-task-id="3"]')).toContainText("2");
});
