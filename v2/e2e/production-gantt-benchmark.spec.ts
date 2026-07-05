import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash, randomBytes } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { calculateMppFields } from "../src/lib/mpp/mppCalculationEngine";
import { normalizeProjectCalendar } from "../src/lib/scheduling/projectCalendar";
import {
  mppAssignmentsToAssignments,
  mppResourcesToResources,
  mppTasksToGanttTasks,
} from "../src/components/upload/mpp-to-gantt";
import {
  DEFAULT_ASSIGNMENT_COLUMN_SETTINGS,
  DEFAULT_RESOURCE_COLUMN_SETTINGS,
  DEFAULT_TASK_COLUMN_SETTINGS,
} from "../src/lib/mpp/taskColumns";
import { DEFAULT_UI_SETTINGS } from "../src/types/ui";
import type { GanttTask } from "../src/components/gantt/types";
import type { ProjectData as ParsedMppProject } from "../src/lib/parser/mpp-parser";

const SESSION_COOKIE = "vg_session";
const PROJECT_PREFIX = "E2E Production Benchmark Gantt";
const DEFAULT_MPP_PATH =
  "/Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp";
const DEFAULT_PRODUCTION_COMMIT = "b2b2698";
const DEFAULT_OUTPUT_PATH = "../../goals/production-e2e-gantt-benchmarks/benchmark-results.json";
const DEFAULT_SUMMARY_PATH = "../../goals/production-e2e-gantt-benchmarks/benchmark-summary.md";

interface BenchmarkStats {
  runs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  minMs: number;
  valuesMs: number[];
  thresholdMs: number;
  passed: boolean;
}

interface BenchmarkResult {
  collectedAt: string;
  baseURL: string;
  parserURL: string;
  production: {
    expectedCommit: string;
    actualCommit?: string;
    commitMatchesExpected: boolean;
    dockerPs?: string;
    parserHealth?: string;
  };
  project: {
    id: string;
    name: string;
    taskCount: number;
    resourceCount: number;
    assignmentCount: number;
    dependencyCount: number;
    mppPath: string;
    durationTaskId: string;
    predecessorFromTaskId: string;
    predecessorTargetTaskId: string;
  };
  thresholds: {
    visibleInteractionP95Ms: number;
    internalRecalculationP95Ms: number;
  };
  metrics: {
    durationEdit: BenchmarkStats;
    predecessorEdit: BenchmarkStats;
    internalRecalculation?: BenchmarkStats;
  };
  notes: string[];
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for production benchmark seeding");
  }
  return url;
}

function baseURL(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? "http://62.238.11.226:3000";
}

function parserURL(): string {
  return process.env.MPP_PARSER_URL ?? "http://62.238.11.226:8000/api/parse-mpp";
}

function benchmarkRuns(): number {
  return Math.max(1, Number(process.env.BENCHMARK_RUNS ?? 10));
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

async function ensureAuthSchema(client: Client) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
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
      permission_id TEXT NOT NULL REFERENCES permissions(id),
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
    await ensureAuthSchema(client);
    const result = await client.query(
      `INSERT INTO users (email, name, provider)
       VALUES ($1, $2, 'password')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ["e2e-production-benchmark@visor.local", "E2E Production Benchmark"],
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
      url: baseURL(),
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function parseMppProject(mppPath: string): Promise<ParsedMppProject> {
  const file = await fs.readFile(mppPath);
  const formData = new FormData();
  formData.set("file", new File([file], path.basename(mppPath)));
  const response = await fetch(parserURL(), { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error(`MPP parser returned ${response.status}: ${await response.text()}`);
  }
  return await response.json() as ParsedMppProject;
}

function serializeDateValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDateValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, serializeDateValue(nested)]),
    );
  }
  return value;
}

function serializeTasks(tasks: GanttTask[]) {
  return tasks.map((task) => serializeDateValue(task));
}

function dependencyCount(tasks: GanttTask[]): number {
  return tasks.reduce((count, task) => count + task.dependencies.length, 0);
}

async function seedBenchmarkProject(mppPath: string) {
  const parsed = await parseMppProject(mppPath);
  const calendar = normalizeProjectCalendar(parsed.calendar);
  const sourceTasks = mppTasksToGanttTasks(parsed.tasks);
  const resources = mppResourcesToResources(parsed.resources ?? []);
  const assignments = mppAssignmentsToAssignments(parsed.assignments ?? []);
  const mppTaskColumns = parsed.mppTaskColumns ?? [];
  const mppResourceColumns = parsed.mppResourceColumns ?? [];
  const mppAssignmentColumns = parsed.mppAssignmentColumns ?? [];
  const calculated = calculateMppFields({
    tasks: sourceTasks,
    resources,
    assignments,
    baselines: [],
    calendar,
    statusDate: parsed.statusDate,
    mppTaskColumns,
    mppResourceColumns,
    mppAssignmentColumns,
    customFieldDefinitions: parsed.customFieldDefinitions ?? [],
  });
  const projectName = `${PROJECT_PREFIX} ${new Date().toISOString()}`;
  const editableTasks = calculated.tasks.filter((task) => !task.isSummary);
  if (editableTasks.length < 2) {
    throw new Error("Benchmark requires at least two non-summary tasks");
  }
  const durationTaskId = String(editableTasks[0].id);
  const predecessorFromTaskId = String(editableTasks[0].id);
  const predecessorTargetTaskId = String(editableTasks[1].id);
  const projectData = {
    name: projectName,
    statusDate: parsed.statusDate,
    tasks: serializeTasks(calculated.tasks),
    resources: serializeDateValue(calculated.resources),
    assignments: serializeDateValue(calculated.assignments),
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar,
    mppTaskColumns: calculated.mppTaskColumns,
    mppResourceColumns: calculated.mppResourceColumns,
    mppAssignmentColumns: calculated.mppAssignmentColumns,
    customFieldDefinitions: calculated.customFieldDefinitions,
    calculationEngineVersion: calculated.engineVersion,
    calculatedAt: calculated.calculatedAt,
    taskColumnSettings: DEFAULT_TASK_COLUMN_SETTINGS,
    resourceColumnSettings: DEFAULT_RESOURCE_COLUMN_SETTINGS,
    assignmentColumnSettings: DEFAULT_ASSIGNMENT_COLUMN_SETTINGS,
    uiSettings: DEFAULT_UI_SETTINGS,
  };

  const id = await withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO projects (name, project_data)
       VALUES ($1, $2)
       RETURNING id`,
      [projectName, JSON.stringify(projectData)],
    );
    return String(result.rows[0].id);
  });

  return {
    id,
    name: projectName,
    taskCount: calculated.tasks.length,
    resourceCount: calculated.resources.length,
    assignmentCount: calculated.assignments.length,
    dependencyCount: dependencyCount(calculated.tasks),
    durationTaskId,
    predecessorFromTaskId,
    predecessorTargetTaskId,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function summarize(values: number[], thresholdMs: number): BenchmarkStats {
  const total = values.reduce((sum, value) => sum + value, 0);
  const stats = {
    runs: values.length,
    avgMs: Number((total / values.length).toFixed(3)),
    p95Ms: Number(percentile(values, 95).toFixed(3)),
    maxMs: Number(Math.max(...values).toFixed(3)),
    minMs: Number(Math.min(...values).toFixed(3)),
    valuesMs: values.map((value) => Number(value.toFixed(3))),
    thresholdMs,
    passed: false,
  };
  stats.passed = stats.p95Ms < thresholdMs;
  return stats;
}

function benchmarkSummary(result: BenchmarkResult): string {
  const duration = result.metrics.durationEdit;
  const predecessor = result.metrics.predecessorEdit;
  return `# Production E2E Gantt Benchmark Summary

- Collected at: ${result.collectedAt}
- Base URL: ${result.baseURL}
- Parser URL: ${result.parserURL}
- Expected commit: ${result.production.expectedCommit}
- Actual commit: ${result.production.actualCommit ?? "unavailable"}
- Commit matches expected: ${result.production.commitMatchesExpected ? "yes" : "no"}
- Project: ${result.project.name} (id ${result.project.id})
- MPP file: ${result.project.mppPath}
- Tasks/resources/assignments/dependencies: ${result.project.taskCount}/${result.project.resourceCount}/${result.project.assignmentCount}/${result.project.dependencyCount}

## Duration Edit

- Runs: ${duration.runs}
- Average: ${duration.avgMs} ms
- P95: ${duration.p95Ms} ms
- Max: ${duration.maxMs} ms
- Threshold: ${duration.thresholdMs} ms
- Passed: ${duration.passed ? "yes" : "no"}

## Predecessor Edit

- Runs: ${predecessor.runs}
- Average: ${predecessor.avgMs} ms
- P95: ${predecessor.p95Ms} ms
- Max: ${predecessor.maxMs} ms
- Threshold: ${predecessor.thresholdMs} ms
- Passed: ${predecessor.passed ? "yes" : "no"}

## Internal Recalculation Timing

Internal recalculation performance marks are not available in the deployed app. The 250 ms internal threshold is documented as unavailable rather than asserted.

## Notes

${result.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function productionCommand(args: string[]): string | undefined {
  const host = process.env.PRODUCTION_SSH_HOST;
  if (!host) return undefined;
  try {
    return execFileSync("ssh", [host, ...args], {
      encoding: "utf8",
      timeout: 30_000,
    }).trim();
  } catch (error) {
    return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function collectProductionEvidence() {
  const actualCommit = productionCommand([
    "cd /tmp/visor-gantt-deploy && git rev-parse --short HEAD",
  ]);
  const dockerPs = productionCommand([
    "cd /tmp/visor-gantt-deploy && docker compose -p visor-gantt ps",
  ]);
  const parserHealth = productionCommand([
    "curl -s --max-time 10 http://127.0.0.1:8000/api/health",
  ]);
  const expectedCommit = process.env.EXPECTED_PRODUCTION_COMMIT ?? DEFAULT_PRODUCTION_COMMIT;
  return {
    expectedCommit,
    actualCommit,
    commitMatchesExpected: actualCommit === expectedCommit,
    dockerPs,
    parserHealth,
  };
}

async function nextAnimationFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function openEditableCell(page: Page, displayCell: Locator) {
  await displayCell.scrollIntoViewIfNeeded();
  const input = page.locator('input[data-testid="editable-cell"]').first();
  const deadline = Date.now() + 15_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await displayCell.evaluate((element) => {
        element.dispatchEvent(new MouseEvent("dblclick", {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
        }));
      });
      await input.waitFor({ state: "visible", timeout: 1_000 });
      return input;
    } catch (error) {
      lastError = error;
      await displayCell.dblclick({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
    }
  }

  const html = await displayCell.evaluate((element) => element.outerHTML);
  throw new Error(`Editable cell did not open after hydration retries. Cell HTML: ${html}. Last error: ${String(lastError)}`);
}

async function commitEditableCell({
  page,
  displayCell,
  nextValue,
}: {
  page: Page;
  displayCell: Locator;
  nextValue: string;
}): Promise<number> {
  const input = await openEditableCell(page, displayCell);
  await input.fill(nextValue);
  const started = await page.evaluate(() => performance.now());
  await input.press("Enter");
  await expect(input).toBeHidden({ timeout: 10_000 });
  await nextAnimationFrame(page);
  const finished = await page.evaluate(() => performance.now());
  return finished - started;
}

async function visibleRows(page: Page): Promise<Locator> {
  const rows = page.getByTestId("gantt-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  return rows;
}

test.describe("production Gantt recalculation benchmark", () => {
  test.skip(
    !process.env.PRODUCTION_SSH_HOST,
    "Requires PRODUCTION_SSH_HOST to verify the deployed production commit and runtime.",
  );

  test("records duration and predecessor visible interaction timings", async ({ page }) => {
    test.setTimeout(600_000);

    const mppPath = process.env.BENCHMARK_MPP_PATH ?? DEFAULT_MPP_PATH;
    const runs = benchmarkRuns();
    const visibleThresholdMs = Number(process.env.VISIBLE_INTERACTION_THRESHOLD_MS ?? 1000);
    const internalThresholdMs = Number(process.env.INTERNAL_RECALC_THRESHOLD_MS ?? 250);
    const production = await collectProductionEvidence();

    expect(production.actualCommit, "production commit").toBe(production.expectedCommit);

    await authenticate(page);
    const project = await seedBenchmarkProject(mppPath);

    await page.goto(`/project/${project.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 180_000,
    });
    await expect(page.getByTestId("gantt-view")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("project-toolbar")).toContainText(project.name);

    await visibleRows(page);
    const durationRow = page.locator(`[data-testid="gantt-row"][data-task-id="${project.durationTaskId}"]`);
    const predecessorRow = page.locator(`[data-testid="gantt-row"][data-task-id="${project.predecessorTargetTaskId}"]`);
    await expect(durationRow).toBeVisible();
    await expect(predecessorRow).toBeVisible();
    await page.waitForTimeout(5_000);

    const durationCell = durationRow.locator("td").nth(5).getByTestId("editable-cell");
    const predecessorCell = predecessorRow.locator("td").nth(8).getByTestId("editable-cell");

    const durationTimings: number[] = [];
    const predecessorTimings: number[] = [];

    for (let index = 0; index < runs; index += 1) {
      const nextDuration = String(index + 2);
      durationTimings.push(
        await commitEditableCell({
          page,
          displayCell: durationCell,
          nextValue: nextDuration,
        }),
      );

      const nextPredecessor = index % 2 === 0
        ? `${project.predecessorFromTaskId}FS`
        : `${project.predecessorFromTaskId}FS+1d`;
      predecessorTimings.push(
        await commitEditableCell({
          page,
          displayCell: predecessorCell,
          nextValue: nextPredecessor,
        }),
      );
    }

    const result: BenchmarkResult = {
      collectedAt: new Date().toISOString(),
      baseURL: baseURL(),
      parserURL: parserURL(),
      production,
      project: {
        ...project,
        mppPath,
      },
      thresholds: {
        visibleInteractionP95Ms: visibleThresholdMs,
        internalRecalculationP95Ms: internalThresholdMs,
      },
      metrics: {
        durationEdit: summarize(durationTimings, visibleThresholdMs),
        predecessorEdit: summarize(predecessorTimings, visibleThresholdMs),
      },
      notes: [
        "Visible timing is measured from Enter key commit until the inline editor closes plus one animation frame.",
        "No internal recalculation performance marks are available in the deployed app, so the 250 ms internal threshold is documented as unavailable rather than asserted.",
        "The benchmark project is intentionally kept in production for auditability.",
      ],
    };

    const outputPath = path.resolve(__dirname, process.env.BENCHMARK_OUTPUT_PATH ?? DEFAULT_OUTPUT_PATH);
    const summaryPath = path.resolve(__dirname, process.env.BENCHMARK_SUMMARY_PATH ?? DEFAULT_SUMMARY_PATH);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(summaryPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    await fs.writeFile(summaryPath, benchmarkSummary(result));

    expect(result.metrics.durationEdit.passed, "duration edit p95 threshold").toBe(true);
    expect(result.metrics.predecessorEdit.passed, "predecessor edit p95 threshold").toBe(true);
  });
});
