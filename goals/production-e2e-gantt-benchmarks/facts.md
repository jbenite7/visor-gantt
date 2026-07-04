# Facts

- Production is verified to be running the deployed optimization commit before benchmark measurements are collected.
- A production E2E benchmark uses the real MPP schedule and records the visible interaction time for changing an activity duration.
- A production E2E benchmark uses the real MPP schedule and records the visible interaction time for changing an activity predecessor.
- Benchmark output reports average, p95, maximum, and run count for duration-edit and predecessor-edit interactions.
- The production benchmark is considered successful when visible interaction p95 is below 1 second and the instrumented recalculation path p95 is below 250 ms when that internal timing is available.
- The benchmark may create and keep a clearly identifiable production project instead of deleting it after the run.
- The final result includes concrete evidence from production: command output or browser/E2E logs, benchmark numbers, and any gaps or risks in the measurement.
