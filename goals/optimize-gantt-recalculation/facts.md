# Facts

- Editing a task duration or predecessor in the Gantt must feel near-immediate for the provided preconstruction cronograma.
- For the provided preconstruction .mpp, the combined recalculation path should complete under 250 ms in the local benchmark.
- The optimization should improve both the MPP calculation engine and the schedule engine where benchmarks show avoidable repeated work.
- Schedule dates, dependency behavior, critical path fields, and task constraints must remain unchanged after optimization.
- MPP task fields, resource fields, assignment fields, and calculated columns must preserve the same values after optimization.
- Autosave payload shape, undo, redo, and project reload behavior must remain compatible with the existing app.
- The implementation should use local indexes, precomputed lookup maps, and focused memoization inside the existing calculation pipeline.
- The implementation must not introduce a second parallel scheduling model.
- Completion requires focused scheduling and MPP tests, a benchmark, lint/build verification, and confirmation against the Docker-served app.
