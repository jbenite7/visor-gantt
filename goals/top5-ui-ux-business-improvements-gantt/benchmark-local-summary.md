# Benchmark local Matrix/Gantt

- Modo: synthetic
- Corridas: 30
- Celdas Matrix: 120
- Tareas totales: 403
- Tareas operativas: 280
- Dependencias: 160

| Ruta medida | Promedio | P50 | P95 | Max |
|---|---:|---:|---:|---:|
| matrixGenerateSchedule | 0.702 ms | 0.588 ms | 1.179 ms | 1.736 ms |
| matrixRoundTripFromGantt | 2.378 ms | 2.061 ms | 4.54 ms | 7.979 ms |
| recalculateSchedule | 8.769 ms | 8.6 ms | 10.671 ms | 10.76 ms |
| combinedMatrixGanttPath | 12.047 ms | 11.39 ms | 16.616 ms | 17.051 ms |

Este benchmark es local y reproducible. No depende del parser MPP externo ni de la base de datos; usa un proyecto sintético de programación matricial con alcance, ubicaciones, recetas, dependencias y recálculo Gantt.

Comando:

```bash
cd v2 && BENCHMARK_RUNS=30 npm run benchmark:gantt
```
