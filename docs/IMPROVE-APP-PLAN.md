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
| 2 | ux-heuristics | done | 25 hallazgos (3 sev-4, 10 sev-3) en DESIGN.md; 22 experimentos en EXPERIMENTS.md. Verificación visual en navegador pendiente → Fase 4 |
| 3 | design-everyday-things | done | 16 hallazgos (#26-41) con verificación en vivo en `/gantt-demo`; 16 experimentos E23-E38. Norman 4/10 |
| 4 | refactoring-ui | done | Tokens auditados (sólidos); grayscale test 5/10 → hallazgos #42-46 (E39-E42); barra de vistas legible shipped. Sin color nuevo |
| 5 | microinteractions | pending | Candidato a momento firma: badge de observaciones en la barra |
| 6 | made-to-stick | pending | Portar el tono de «Ayuda de esta pestaña» del visor 1.0 |
| 7 | influence-psychology | skipped: sin superficies de upsell | — |
| 8 | high-perf-browser | pending | Parseo ~36 s de un .mpp de 11 MB sin progreso; INP en tabla de 300+ tareas |
| 9 | steve-jobs-design-review | pending | Candidatas a corte: vistas de las 14 que nadie usa |

## Key Decisions

- 2026-08-05 — Destilación del visor 1.0 hecha por bundle + API y luego **verificada en vivo** con `aia-ms-project/20260312 DA PORTO TORRE 3.mpp` (7 pestañas, loop de observaciones completo probado); documentada en DESTILACION-VISOR-V1.md. El .mpp de 11 MB solo se pudo probar por API (~36 s); el POST desde el navegador de prueba falló por tamaño/red.
- 2026-08-05 — Fase 3: se auditó `/gantt-demo` en navegador real (no requiere sesión), evitando autenticarse. Confirmado en vivo el rechazo mudo de ediciones y la adyacencia Agregar/Eliminar.
- 2026-08-05 — Usuario confirmó el job statement. Dimensiones más débiles: **emocional y funcional** (ambas se atacan). Leak: **Big Hire y Little Hire por igual** → Fases 2-3 cubren tanto upload→primera vista como navegación/uso diario.
- Pendiente (usuario): prioridad fina de las 6 características destiladas; Fase 7 queda skipped salvo que aparezcan superficies de venta.

## Next Actions

1. Fase 5 (microinteractions): candidato a momento firma = badge de observaciones en barra (traído del visor 1.0); auditar save/undo/drag ya mejorados.
2. E39 (ruta crítica sin depender del color) es el fix visual de más impacto pendiente.
3. E24 parcial: siguen fuera del historial editar recurso/partida, sync matriz y reset de columnas.
