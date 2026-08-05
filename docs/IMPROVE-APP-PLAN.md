# IMPROVE-APP-PLAN — visor-gantt (v2)

Journey `improve-app` iniciado 2026-08-05 a partir de la destilación del visor 1.0 desplegado
([DESTILACION-VISOR-V1.md](DESTILACION-VISOR-V1.md)). App activa: `v2/` (Next.js, 14 vistas).

## Intake (respuestas asumidas — confirmar con el usuario)

1. **Job**: «Cuando recibo el cronograma .mpp de la obra, quiero revisarlo, anotarlo y compartir el análisis con el equipo sin depender de MS Project, para decidir a tiempo.»
2. **Zona más rugosa**: sobrecarga de navegación/densidad (14 vistas concentradas en `GanttView.tsx` 1663 líneas) y fricción de entrada (login/proyecto antes de ver nada).
3. **Evidencia**: auditorías fact-by-fact en `goals/` + esta destilación; sin analytics ni grabaciones.
4. **Plataforma**: web (Docker + Hetzner). Fase 8 aplica.
5. **Upsell**: no hay superficies de venta → Fase 7 **skipped**.
6. **Flujo que más leakea**: importación .mpp → primera vista útil (Big Hire).
7. **Docs previos**: no existen CUSTOMER/DESIGN/POSITIONING/EXPERIMENTS/PRODUCT; el vault `memoria/` es la fuente de contexto.

## Fases

| Fase | Skill | Estado | Nota |
|---|---|---|---|
| 1 | jobs-to-be-done | done (GATE) | Job confirmado; CUSTOMER.md creado 2026-08-05 |
| 2 | ux-heuristics | pending | Foco: flujo upload→primera vista y navegación de 14 vistas |
| 3 | design-everyday-things | pending | Errores de importación, feedback de «Procesando», undo vs confirmaciones |
| 4 | refactoring-ui | pending | Jerarquía visual de toolbar/tabla; tokens |
| 5 | microinteractions | pending | Candidato a momento firma: badge de observaciones en la barra |
| 6 | made-to-stick | pending | Portar el tono de «Ayuda de esta pestaña» del visor 1.0 |
| 7 | influence-psychology | skipped: sin superficies de upsell | — |
| 8 | high-perf-browser | pending | Parseo ~36 s de un .mpp de 11 MB sin progreso; INP en tabla de 300+ tareas |
| 9 | steve-jobs-design-review | pending | Candidatas a corte: vistas de las 14 que nadie usa |

## Key Decisions

- 2026-08-05 — Destilación del visor 1.0 hecha por bundle + API y luego **verificada en vivo** con `aia-ms-project/20260312 DA PORTO TORRE 3.mpp` (7 pestañas, loop de observaciones completo probado); documentada en DESTILACION-VISOR-V1.md. El .mpp de 11 MB solo se pudo probar por API (~36 s); el POST desde el navegador de prueba falló por tamaño/red.
- 2026-08-05 — Usuario confirmó el job statement. Dimensiones más débiles: **emocional y funcional** (ambas se atacan). Leak: **Big Hire y Little Hire por igual** → Fases 2-3 cubren tanto upload→primera vista como navegación/uso diario.
- Pendiente (usuario): prioridad fina de las 6 características destiladas; Fase 7 queda skipped salvo que aparezcan superficies de venta.

## Next Actions

1. Fase 2 (ux-heuristics): evaluación heurística con severidad 0-4 sobre los dos flujos — upload→primera vista (Big Hire) y navegación de 14 vistas (Little Hire) — creando DESIGN.md y EXPERIMENTS.md.
2. Backlog semilla desde la destilación (DESTILACION-VISOR-V1.md §Las mejores características).
