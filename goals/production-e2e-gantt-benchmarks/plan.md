# Plan

## Solution approach

Run a production-targeted Playwright benchmark against the live Hetzner deployment. The benchmark should authenticate with a production test session, create and keep a clearly named benchmark project from the real `.mpp` file, open `/project/<id>`, edit duration and predecessor cells in the Gantt table, and report visible interaction timings plus any available internal recalculation timings.

Avoid relying on the home upload UI state because the deployed home only shows the save-to-project upload control when the project list is empty. Seed the benchmark project directly into the production database using the same `project_data` shape as `saveProject`, then drive the real production UI for the measured interactions.

## Ordered steps

1. Verify production deployment state.
   - Systems: `hetzner-vps-openclaw`, `/tmp/visor-gantt-deploy`, Docker Compose project `visor-gantt`.
   - Commands:
     - `ssh hetzner-vps-openclaw 'cd /tmp/visor-gantt-deploy && git rev-parse --short HEAD && docker compose -p visor-gantt ps'`
     - Confirm commit is `b2b2698` or the current intended optimization commit.
   - Verification:
     - Frontend container is `Up`.
     - Parser container is healthy.
     - `curl http://127.0.0.1:8000/api/health` returns `mpxj_available: true`.

2. Add a production benchmark E2E spec.
   - Files:
     - `v2/e2e/production-gantt-benchmark.spec.ts`
   - Behavior:
     - Read `PLAYWRIGHT_BASE_URL`, `DATABASE_URL`, `BENCHMARK_MPP_PATH`, and `BENCHMARK_RUNS`.
     - Authenticate by inserting/updating a test user and `vg_session` token in production DB, following the pattern already used in `v2/e2e/matrix-new-project.spec.ts`.
     - Use the real MPP file from `BENCHMARK_MPP_PATH`.
     - Parse it through the production parser URL or the local parser URL selected by env.
     - Convert parsed MPP data to the persisted `project_data` JSON shape expected by `loadProject`.
     - Insert a project named like `E2E Production Benchmark Gantt <timestamp>` and keep it after the run.
   - Verification:
     - The test opens `/project/<id>` and sees `data-testid="gantt-view"`.
     - The toolbar shows the benchmark project name and real task count.

3. Make selectors stable if row/cell indexing is too fragile.
   - Files, only if needed:
     - `v2/src/components/gantt/table/GanttRow.tsx`
   - Preferred non-visual addition:
     - Add `data-task-id` to each row.
     - Add `data-column-key` to editable table cells.
   - Verification:
     - Existing component tests still pass.
     - No visual behavior changes.
   - Risk:
     - This requires a small deploy before the production E2E can use those selectors. If row/cell index selectors are reliable enough, skip this step.

4. Measure duration-edit interaction.
   - Systems:
     - Production frontend through Playwright.
     - Production DB only for setup/auth.
   - Behavior:
     - Locate a non-summary task row with an editable duration cell.
     - Start a browser-side timer immediately before committing the edit.
     - Double-click the duration cell, change duration by `+1`, press Enter.
     - Wait until the visible cell value updates and at least one animation frame has passed.
     - Record elapsed visible time.
     - Repeat for `BENCHMARK_RUNS`.
   - Verification:
     - Report `runs`, `avgMs`, `p95Ms`, `maxMs`.
     - Visible p95 is below `1000 ms`.

5. Measure predecessor-edit interaction.
   - Systems:
     - Production frontend through Playwright.
   - Behavior:
     - Locate a non-summary task row where changing predecessors will not create a cycle.
     - Start a browser-side timer immediately before committing the edit.
     - Double-click the predecessor cell, enter a valid predecessor expression such as `<previousTaskId>FS`, press Enter or blur as required by the current editor.
     - Wait until the visible predecessor cell updates and at least one animation frame has passed.
     - Record elapsed visible time.
     - Repeat for `BENCHMARK_RUNS`.
   - Verification:
     - Report `runs`, `avgMs`, `p95Ms`, `maxMs`.
     - Visible p95 is below `1000 ms`.

6. Capture internal recalculation timing when available.
   - Files, only if needed:
     - `v2/src/components/views/GanttView.tsx`
     - `v2/src/lib/state/ProjectContext.tsx`
   - Preferred approach:
     - First try browser `performance.measure` around user-visible interactions without app changes.
     - If no internal recalculation timing exists, document that gap and report visible E2E timing only.
     - If internal timing is needed, add non-user-facing performance marks around `recalculateSchedule` / `calculateMppFields` and expose them to Playwright.
   - Verification:
     - If implemented, internal recalculation p95 is below `250 ms`.
     - If not implemented, final report clearly states internal timing was not available.

7. Run production benchmark safely.
   - Recommended setup:
     - Open an SSH tunnel for DB access if not running from the server:
       - `ssh -N -L 15432:127.0.0.1:5432 hetzner-vps-openclaw`
     - Run Playwright from local `v2` against production:
       - `PLAYWRIGHT_BASE_URL=http://62.238.11.226:3000 DATABASE_URL=postgresql://visoruser:visorpass@127.0.0.1:15432/visormpp BENCHMARK_MPP_PATH="/Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp" BENCHMARK_RUNS=10 npx playwright test e2e/production-gantt-benchmark.spec.ts --project=chromium --workers=1`
   - Verification:
     - Playwright exits successfully.
     - The benchmark project remains in production with the `E2E Production Benchmark Gantt` prefix.
     - Output includes commit, environment, run count, avg, p95, max, and pass/fail against thresholds.

8. Save evidence.
   - Files:
     - `goals/production-e2e-gantt-benchmarks/benchmark-results.json`
     - `goals/production-e2e-gantt-benchmarks/benchmark-summary.md`
   - Content:
     - Production commit.
     - Container status.
     - Benchmark project id/name.
     - Duration-edit metrics.
     - Predecessor-edit metrics.
     - Internal timing metrics or explicit note that internal timing was unavailable.
     - Any gaps, retries, or manual observations.

## Risks and open questions

- Production `/upload` in the deployed commit does not reliably create a saved project, and the home upload control is hidden when projects already exist. Direct DB seeding is more reliable for a repeatable benchmark.
- Playwright `webServer` may try to start a local dev server if the production base URL is not reachable. If this happens, run with a production-specific config or ensure the production URL is reachable before Playwright starts.
- Direct DB seeding must match `saveProject` serialization exactly enough for `loadProject` and `ProjectView` to hydrate the project.
- The visible timing includes React render, table update, browser work, and possibly autosave side effects. It is the right user-facing metric, but it is not the same as the pure calculation benchmark.
- Internal recalculation timing may require small instrumentation if browser performance marks are not currently present.
