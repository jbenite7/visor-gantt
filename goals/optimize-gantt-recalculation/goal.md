# Optimize Gantt Recalculation

Optimize the Gantt recalculation path so duration and predecessor edits feel near-immediate on the provided preconstruction cronograma. The work should improve both the MPP calculation engine and the schedule engine where benchmarks show repeated avoidable work, without introducing a second scheduling model.

Use `facts.md` as the shared behavior contract and `plan.md` as the execution plan.

Done when the accepted facts are satisfied, the combined edit recalculation benchmark is under 250 ms for the preconstruction cronograma or documented equivalent, focused tests pass, lint/build pass, and the Docker-served app reflects the current code.

## Archivos de este goal

- [[goals/optimize-gantt-recalculation/facts|facts]] — la comprensión compartida
- [[goals/optimize-gantt-recalculation/plan|plan]] — el plan de ejecución aprobado
- [[goals/optimize-gantt-recalculation/cierre|cierre]] — el cierre verificado

Estado de todos los goals: [[estado|Estado de los goals]].
