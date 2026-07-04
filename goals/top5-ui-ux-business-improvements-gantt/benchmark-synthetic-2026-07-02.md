# Benchmark Sintetico Gantt/Matriz - 2026-07-02

Comando:

```bash
BENCHMARK_SYNTHETIC_FLOORS=60 BENCHMARK_RUNS=20 npm run benchmark:gantt
```

Contexto:

- Modo: `synthetic`
- Runs: `20`
- Celdas matriz: `180`
- Tareas totales: `603`
- Tareas operativas: `420`
- Dependencias: `240`

Resultados:

| Medicion | Avg ms | P50 ms | P95 ms | Min ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Generar cronograma desde matriz | 7.684 | 4.895 | 48.895 | 2.966 | 48.895 |
| Roundtrip Gantt hacia matriz | 15.166 | 11.714 | 29.872 | 8.902 | 29.872 |
| Recalcular cronograma | 56.272 | 45.783 | 146.326 | 37.702 | 146.326 |
| Ruta combinada matriz + Gantt | 70.158 | 63.272 | 122.783 | 50.507 | 122.783 |

Interpretacion:

La ruta combinada matriz + Gantt se mantiene por debajo de 125 ms P95 en una muestra de 603 tareas / 180 celdas / 240 dependencias. Esto deja una evidencia reproducible para la exigencia de benchmark con proyecto grande del goal.
