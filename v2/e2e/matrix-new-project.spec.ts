import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "crypto";
import { Client } from "pg";

const SESSION_COOKIE = "vg_session";
const E2E_PROJECT_PREFIX = "E2E Matrix Edificio 10 pisos";

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

async function deleteE2EProjects() {
  await withClient(async (client) => {
    await ensureE2ESchema(client);
    await client.query(`DELETE FROM projects WHERE name LIKE $1`, [`${E2E_PROJECT_PREFIX}%`]);
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

async function authenticate(page: Page) {
  const token = randomBytes(32).toString("hex");
  await withClient(async (client) => {
    await ensureE2ESchema(client);
    const result = await client.query(
      `INSERT INTO users (email, name, provider)
       VALUES ($1, $2, 'password')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ["e2e-matrix@visor.local", "E2E Matrix"],
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

async function addItem(page: Page, placeholder: string, buttonName: string, value: string) {
  await page.getByPlaceholder(placeholder).fill(value);
  await page.getByRole("button", { name: buttonName }).click();
}

test.beforeEach(async ({ page }) => {
  await deleteE2EProjects();
  await authenticate(page);
});

test.afterEach(async () => {
  await deleteE2EProjects();
});

test("crea un edificio de 10 pisos desde Programacion Matricial", async ({ page }) => {
  const projectName = `${E2E_PROJECT_PREFIX} ${Date.now()}`;

  await page.goto("/project/new");
  await expect(page.getByRole("heading", { name: "Crear cronograma" })).toBeVisible();
  await expect(page.getByTestId("matrix-editor")).toBeVisible();
  await expect(page.getByText("0 disciplinas · 0 ubicaciones · 0 tareas vinculadas")).toBeVisible();

  await page.locator('[data-testid="matrix-editor"] input').first().fill(projectName);
  await page.getByLabel("Inicio").fill("2026-01-05");

  for (const scope of ["Estructura", "Arquitectura", "Redes MEP"]) {
    await addItem(page, "Nueva disciplina", "Disciplina", scope);
  }
  for (let floor = 1; floor <= 10; floor += 1) {
    await addItem(page, "Nueva ubicación", "Ubicación", `Piso ${floor}`);
  }

  await expect(page.getByText("3 disciplinas · 10 ubicaciones · 0 tareas vinculadas")).toBeVisible();
  await page.getByRole("button", { name: "Activar todas las celdas" }).click();
  await expect(page.getByText("Preview: 103 tareas · 0 alertas")).toBeVisible();

  await page.getByRole("button", { name: "Guardar y generar cronograma" }).click();

  await expect(page).toHaveURL(/\/project\/\d+$/, { timeout: 20_000 });
  const projectId = page.url().match(/\/project\/(\d+)$/)?.[1];
  expect(projectId).toBeTruthy();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText("103 tareas", { exact: true })).toBeVisible();

  await page.getByTestId("sidebar-view-matrix").click();
  await expect(page.getByText("3 disciplinas · 10 ubicaciones · 70 tareas vinculadas")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Piso 10" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Estructura en concreto 3 actividades/i })).toHaveCount(10);
  await expect(page.getByRole("button", { name: /Muros y acabados base 2 actividades/i })).toHaveCount(10);
  await expect(page.getByRole("button", { name: /Redes embebidas 2 actividades/i })).toHaveCount(10);

  const projectData = await loadProjectData(projectId!);
  const matrixPlan = projectData.matrixPlan;
  const linkedTasks = projectData.tasks.filter((task: { matrixSource?: unknown }) => task.matrixSource);
  const generatedByRecipe = linkedTasks.reduce((acc: Record<string, number>, task: { matrixSource: { recipeId: string } }) => {
    acc[task.matrixSource.recipeId] = (acc[task.matrixSource.recipeId] ?? 0) + 1;
    return acc;
  }, {});

  expect(matrixPlan.scopeTree).toHaveLength(3);
  expect(matrixPlan.scopeTree.map((scope: { name: string }) => scope.name)).toEqual([
    "Estructura",
    "Arquitectura",
    "Redes MEP",
  ]);
  expect(matrixPlan.areas).toHaveLength(10);
  expect(matrixPlan.areas.map((area: { name: string }) => area.name)).toEqual(
    Array.from({ length: 10 }, (_, index) => `Piso ${index + 1}`),
  );
  expect(matrixPlan.cells).toHaveLength(30);
  expect(matrixPlan.cells.every((cell: { active: boolean }) => cell.active)).toBe(true);
  expect(linkedTasks).toHaveLength(70);
  expect(generatedByRecipe).toEqual({
    "arquitectura-muros": 20,
    "estructura-concreto": 30,
    "mep-rough-in": 20,
  });
});
