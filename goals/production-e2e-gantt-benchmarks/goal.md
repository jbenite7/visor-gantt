# Production E2E Gantt Benchmarks

Run production E2E benchmarks against the deployed Gantt optimization to measure real user-visible recalculation performance for duration edits and predecessor edits on the real MPP schedule. The benchmark must verify the production commit first, create and keep an identifiable benchmark project, and report concrete timing evidence.

The shared understanding is in `goals/production-e2e-gantt-benchmarks/facts.md`.

The execution plan is in `goals/production-e2e-gantt-benchmarks/plan.md`.

Done when production benchmark evidence exists with commit/container proof, duration-edit and predecessor-edit avg/p95/max/run count, threshold pass/fail, and any measurement gaps or risks documented.
