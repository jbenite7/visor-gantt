import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash, randomBytes } from "crypto";
import { Client } from "pg";
import { e2eProjectName } from "./helpers/runId";

const SESSION_COOKIE = "vg_session";
const E2E_PROJECT_PREFIX = "E2E Matriz 2 etapas 2 torres 20 pisos";

test.use({
  screenshot: "on",
  trace: "on",
  video: "on",
});

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
      ["e2e-matrix-deep@visor.local", "E2E Matrix Deep"],
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

async function evidence(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`evidence-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`evidence-${name}`, {
    path,
    contentType: "image/png",
  });
}

async function addItem(page: Page, placeholder: string, buttonName: string, value: string) {
  await page.getByPlaceholder(placeholder).fill(value);
  await page.getByRole("button", { name: buttonName }).click();
}

async function setInputByLabel(page: Page, label: string, value: string) {
  await expect(page.getByLabel(label).first()).toBeVisible({ timeout: 10_000 });
  await page.evaluate(
    ({ targetLabel, nextValue }) => {
      const input = [...document.querySelectorAll("input")].find(
        (item) => item.getAttribute("aria-label") === targetLabel,
      ) as HTMLInputElement | undefined;
      if (!input) {
        throw new Error(`Input not found: ${targetLabel}`);
      }
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { targetLabel: label, nextValue: value },
  );
}

async function renameArea(page: Page, currentName: string, nextName: string, type: string) {
  await setInputByLabel(page, `Nombre ubicación ${currentName}`, nextName);
  await expect(page.getByLabel(`Nombre ubicación ${nextName}`).first()).toHaveValue(nextName);
  // El campo "Tipo" es un <select>, no un <input>: se usa selectOption en vez de setInputByLabel.
  await page.getByLabel(`Tipo ubicación ${nextName}`).first().selectOption(type);
  await expect(page.getByLabel(`Tipo ubicación ${nextName}`).first()).toHaveValue(type);
}

async function createTowerWithFloors(page: Page, etapaName: string, towerName: string) {
  await page.getByRole("button", { name: `Agregar hijo a ${etapaName}` }).click();
  await renameArea(page, "Nueva sub-ubicación", towerName, "Torre");

  for (let floor = 1; floor <= 10; floor += 1) {
    await page.getByRole("button", { name: `Agregar hijo a ${towerName}`, exact: true }).click();
    await renameArea(
      page,
      "Nueva sub-ubicación",
      `${towerName} Piso ${String(floor).padStart(2, "0")}`,
      "Piso",
    );
  }
}

test.beforeEach(async ({ page }) => {
  await authenticate(page);
});

test("crea evidencia profunda de Programacion Matricial con 2 etapas, 2 torres y 20 pisos", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const projectName = e2eProjectName(E2E_PROJECT_PREFIX);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/project/new");
  await expect(page.getByRole("heading", { name: "Crear cronograma" })).toBeVisible();
  await expect(page.getByTestId("matrix-editor")).toBeVisible();
  await evidence(page, testInfo, "01-matriz-vacia");

  await page.locator('[data-testid="matrix-editor"] input').first().fill(projectName);
  await page.getByLabel("Inicio").fill("2026-01-05");

  for (const scope of ["Estructura", "Arquitectura", "Redes MEP"]) {
    await addItem(page, "Nueva disciplina", "Disciplina", scope);
  }
  await page.getByRole("button", { name: "Alcances" }).click();
  await expect(page.getByText("3 disciplinas · 0 ubicaciones · 0 tareas vinculadas")).toBeVisible();
  await evidence(page, testInfo, "02-alcances-completos");

  await addItem(page, "Nueva ubicación", "Ubicación", "Etapa 1");
  await addItem(page, "Nueva ubicación", "Ubicación", "Etapa 2");
  await page.getByRole("button", { name: "Ubicaciones" }).click();
  await createTowerWithFloors(page, "Etapa 1", "Etapa 1 Torre A");
  await createTowerWithFloors(page, "Etapa 2", "Etapa 2 Torre A");
  await expect(page.getByText("3 disciplinas · 20 ubicaciones · 0 tareas vinculadas")).toBeVisible();
  await evidence(page, testInfo, "03-jerarquia-etapa-torre-piso");

  await page.getByRole("button", { name: "Matriz" }).click();
  await expect(page.getByRole("columnheader", { name: "Etapa 1 Torre A Piso 01" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Etapa 2 Torre A Piso 10" })).toBeVisible();
  await evidence(page, testInfo, "04-matriz-60-celdas-inactivas");

  await page.getByRole("button", { name: "Activar todas las celdas" }).click();
  await expect(page.getByText(/Preview: \d+ tareas · 0 alertas/)).toBeVisible();
  await page
    .getByRole("button", { name: /Estructura en concreto 3 actividades/i })
    .first()
    .click();
  await expect(page.getByTestId("matrix-cell-panel")).toContainText("Estructura × Etapa 1 Torre A Piso 01");
  await evidence(page, testInfo, "05-celda-activa-con-detalle");

  await page.getByRole("button", { name: "Guardar y generar cronograma" }).click();
  await expect(page).toHaveURL(/\/project\/\d+$/, { timeout: 30_000 });
  const projectId = page.url().match(/\/project\/(\d+)$/)?.[1];
  expect(projectId).toBeTruthy();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText(/\d+ tareas/).first()).toBeVisible();
  await evidence(page, testInfo, "06-gantt-generado");

  await page.getByTestId("command-palette-open").click();
  await page.getByTestId("command-palette-item-view-matrix").click();
  await expect(page.getByText("3 disciplinas · 20 ubicaciones · 140 tareas vinculadas")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Etapa 2 Torre A Piso 10" })).toBeVisible();
  await evidence(page, testInfo, "07-matriz-vinculada-post-guardado");

  const projectData = await loadProjectData(projectId!);
  const matrixPlan = projectData.matrixPlan;
  const linkedTasks = projectData.tasks.filter((task: { matrixSource?: unknown; isSummary?: boolean }) => task.matrixSource && !task.isSummary);
  const linkedByRecipe = linkedTasks.reduce((acc: Record<string, number>, task: { matrixSource: { recipeId: string } }) => {
    acc[task.matrixSource.recipeId] = (acc[task.matrixSource.recipeId] ?? 0) + 1;
    return acc;
  }, {});

  expect(matrixPlan.scopeTree).toHaveLength(3);
  expect(matrixPlan.areas).toHaveLength(2);
  expect(matrixPlan.areas.map((area: { name: string }) => area.name)).toEqual(["Etapa 1", "Etapa 2"]);
  expect(matrixPlan.areas.every((area: { children: unknown[] }) => area.children.length === 1)).toBe(true);
  expect(matrixPlan.areas.flatMap((area: { children: Array<{ children: unknown[] }> }) => area.children).every((tower) => tower.children.length === 10)).toBe(true);
  expect(matrixPlan.cells).toHaveLength(60);
  expect(matrixPlan.cells.every((cell: { active: boolean }) => cell.active)).toBe(true);
  expect(linkedTasks).toHaveLength(140);
  expect(linkedByRecipe).toEqual({
    "arquitectura-muros": 40,
    "estructura-concreto": 60,
    "mep-rough-in": 40,
  });

  await testInfo.attach("matrix-project-summary", {
    body: JSON.stringify(
      {
        projectId,
        projectName,
        scopeLeaves: 3,
        locationLeaves: 20,
        cells: matrixPlan.cells.length,
        linkedTasks: linkedTasks.length,
        linkedByRecipe,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
