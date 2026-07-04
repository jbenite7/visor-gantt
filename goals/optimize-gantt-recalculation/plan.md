# Optimize Gantt Recalculation Plan

## Solution Approach

The measured bottleneck is not the CPM pass alone. On the provided preconstruction file, `recalculateSchedule()` is roughly 19 ms, while `calculateMppFields()` is roughly 1.7 s. The implementation should keep the current convert -> recalculate -> merge architecture, but remove repeated scans and repeated derived-state construction inside the existing pipeline.

Target result: the combined edit recalculation path for the provided `.mpp` should benchmark under 250 ms locally while preserving schedule, MPP fields, resources, assignments, autosave, undo, redo, and reload behavior.

## Ordered Steps

1. Add a repeatable benchmark harness.

   Touches: `v2/scripts/` or `v2/src/lib/**/__tests__` depending on the existing test style.

   Build a benchmark around the real parser output from `/Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp` when available, with a documented fallback fixture or synthetic equivalent. Measure `recalculateSchedule()`, `calculateMppFields()`, and the combined edit path.

   Verification: run the benchmark before changes and record the baseline in the goal implementation notes.

2. Optimize dependency normalization in the schedule engine.

   Touches: `v2/src/lib/scheduling/scheduleEngine.ts`, `v2/src/lib/scheduling/cpm.ts`.

   Replace repeated `deps.filter(...)` per task with a `Map<taskId, dependencies[]>` built once. Replace `queue.shift()` topological queues with index-based iteration. Preserve inactive-task filtering and canonical successor-owned dependency storage.

   Verification: `npm test -- --runTestsByPath src/lib/scheduling/scheduleEngine.test.ts src/lib/scheduling/cpm.test.ts --runInBand`.

3. Optimize calendar lookup overhead where it appears in benchmarks.

   Touches: `v2/src/lib/scheduling/projectCalendar.ts`.

   Avoid repeated calendar normalization inside day loops by constructing indexed calendar state once inside `ProjectSchedulingCalendar`: work-day set, non-working date set, override map, and minutes-per-day cache. Preserve exception and override behavior.

   Verification: `npm test -- --runTestsByPath src/lib/scheduling/projectCalendar.test.ts src/lib/scheduling/scheduleEngine.test.ts --runInBand`.

4. Add indexed calculation context for `calculateMppFields()`.

   Touches: `v2/src/lib/mpp/mppCalculationEngine.ts`.

   Introduce a local calculation context built once per call: task map, task index, active task ids, dependencies by predecessor, dependencies by successor, assignments by task, resources by uid, and any summary/children lookups already needed. Pass this context into internal helpers instead of rebuilding maps or scanning `tasks` and `assignments` per task.

   Key replacements:
   - Replace per-task `tasks.map(...)` context reconstruction with indexed lookup that handles the current task override.
   - Replace successor/predecessor scans with dependency maps.
   - Replace `taskAssignments(task, assignments)` scans with `assignmentsByTaskId`.
   - Replace repeated `resources.find(...)` with `resourceByUid`.

   Verification: `npm test -- --runTestsByPath src/lib/mpp/mppCalculationEngine.test.ts src/lib/mpp/mppCalculationParity.test.ts --runInBand`.

5. Preserve timephased/resource behavior explicitly.

   Touches: `v2/src/lib/mpp/mppCalculationEngine.ts`.

   Keep `buildResourceLoadIndex()` semantics intact, but make it reuse the same resource/task maps where possible. Do not change generated timephased field values unless tests prove the existing value is wrong.

   Verification: include resource/assignment/timephased assertions from the existing MPP test suite and compare selected output snapshots before and after.

6. Validate the user-visible edit path.

   Touches: likely no UI code unless profiling shows a React-specific issue after engine optimization.

   Confirm that editing duration and predecessors in `GanttView` still updates successor dates, autosaves, supports undo/redo, and preserves reload payload shape.

   Verification: `npm test -- --runTestsByPath src/components/views/GanttView.test.tsx src/lib/state/ProjectContext.test.tsx --runInBand`.

7. Run broad verification and Docker runtime check.

   Touches: Docker runtime only.

   Commands:
   - `docker compose run --rm frontend npm test -- --runInBand`
   - `docker compose run --rm frontend npm run lint`
   - `docker compose run --rm frontend npm run build`
   - Refresh/rebuild the running frontend service if needed, then verify the Docker-served app reflects the current code.

## Risks

- `mppCalculationEngine.ts` is broad and heavily tested. Optimize by introducing internal indexes, not by changing field formulas.
- Some existing local files are already modified. Before implementation, check `git status` and avoid reverting unrelated work.
- The 250 ms threshold depends on local machine and Docker state. Treat the benchmark as a guardrail and record the exact command and environment.
- Real `.mpp` parsing requires the Docker `mpp-parser` service because the host lacks Java.

## Done Condition

The accepted facts in `facts.md` are satisfied, the benchmark shows the combined edit recalculation path under 250 ms for the preconstruction cronograma or a documented equivalent, focused tests pass, lint/build pass, and the Docker-served app has been refreshed and checked.
