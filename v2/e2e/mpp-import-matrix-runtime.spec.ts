import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { e2eProjectName } from "./helpers/runId";

const SESSION_COOKIE = "vg_session";
const IMPORTED_PROJECT_NAME = "20260312 DA PORTO TORRE 3";

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
      ["e2e-mpp-import@visor.local", "E2E MPP Import"],
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

async function loadProjectData(projectId: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT name, project_data FROM projects WHERE id = $1`,
      [projectId],
    );
    return result.rows[0];
  });
}

async function renameProjectForRun(projectId: string, name: string) {
  await withClient(async (client) => {
    await client.query(`UPDATE projects SET name = $1 WHERE id = $2`, [name, projectId]);
  });
}

test.beforeEach(async ({ page }) => {
  await authenticate(page);
});

test("importa un MPP real y genera programacion matricial automatica con paridad", async ({ page }) => {
  test.setTimeout(120_000);
  const mppPath = path.resolve(__dirname, "../../aia-ms-project/20260312 DA PORTO TORRE 3.mpp");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mis Proyectos" })).toBeVisible();

  const response = await page.request.post("/api/import-mpp", {
    multipart: {
      file: {
        name: "20260312 DA PORTO TORRE 3.mpp",
        mimeType: "application/vnd.ms-project",
        buffer: fs.readFileSync(mppPath),
      },
    },
    maxRedirects: 0,
    timeout: 90_000,
  });
  expect(response.status()).toBe(303);

  const location = response.headers().location;
  // La importación llega con el resumen en la URL desde E32 (tareas,
  // dependencias, recursos y, si las hay, columnas descartadas).
  expect(location).toMatch(/\/project\/\d+(\?.*)?$/);
  const projectId = location?.match(/\/project\/(\d+)/)?.[1];
  expect(projectId).toBeTruthy();

  const runProjectName = e2eProjectName(IMPORTED_PROJECT_NAME);
  await renameProjectForRun(projectId!, runProjectName);

  await page.goto(`/project/${projectId}`);
  await expect(page.getByTestId("gantt-view")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Matriz/ })).toBeVisible();

  const row = await loadProjectData(projectId!);
  expect(row.name).toBe(runProjectName);
  const projectData = row.project_data;
  expect(projectData.matrixPlan).toEqual(
    expect.objectContaining({
      id: "matrix-mpp-20260312-da-porto-torre-3",
      templateId: "mpp-import",
    }),
  );
  expect(projectData.matrixPlan.cells.length).toBeGreaterThan(0);
  expect(projectData.matrixPlan.cells.every((cell: { active: boolean }) => cell.active)).toBe(true);

  const linkedTasks = projectData.tasks.filter((task: { matrixSource?: unknown }) => task.matrixSource);
  expect(linkedTasks.length).toBe(projectData.matrixPlan.cells.length);
  expect(linkedTasks.length).toBeGreaterThan(0);
  expect(linkedTasks.every((task: { matrixSource: { matrixPlanId: string } }) =>
    task.matrixSource.matrixPlanId === projectData.matrixPlan.id,
  )).toBe(true);
});
