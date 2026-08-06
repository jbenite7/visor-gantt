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
| 5 | microinteractions | done | Inventario 7 interacciones (5/10); momento firma = badge de observaciones (E43, pasa removal test); E44 nuevo |
| 6 | made-to-stick | done | POSITIONING.md creado; 9 superficies reescritas y shipped (jerga de infraestructura fuera); ayuda por vista (E8) queda en backlog |
| 7 | influence-psychology | skipped: sin superficies de upsell | — |
| 8 | high-perf-browser | done | INP 584 → 184 ms con carga diferida de vistas (E46). LCP/CLS/TTFB en verde (localhost). Pendiente RUM real (E47) |
| 9 | steve-jobs-design-review | done | **NOT DONE 6/10**; PRODUCT.md con cut list (14→9 vistas) y back-of-fence. 404 y estados vacíos resueltos |

## Key Decisions

- 2026-08-06 — **E51/F1 (abrir un .mpp sin cuenta) descartado definitivamente por el usuario.** Se asume mantener 6 pasos hasta el valor. Cerrado, no aplazado.

- 2026-08-05 — Destilación del visor 1.0 hecha por bundle + API y luego **verificada en vivo** con `aia-ms-project/20260312 DA PORTO TORRE 3.mpp` (7 pestañas, loop de observaciones completo probado); documentada en DESTILACION-VISOR-V1.md. El .mpp de 11 MB solo se pudo probar por API (~36 s); el POST desde el navegador de prueba falló por tamaño/red.
- 2026-08-05 — Fase 3: se auditó `/gantt-demo` en navegador real (no requiere sesión), evitando autenticarse. Confirmado en vivo el rechazo mudo de ediciones y la adyacencia Agregar/Eliminar.
- 2026-08-05 — Usuario confirmó el job statement. Dimensiones más débiles: **emocional y funcional** (ambas se atacan). Leak: **Big Hire y Little Hire por igual** → Fases 2-3 cubren tanto upload→primera vista como navegación/uso diario.
- Pendiente (usuario): prioridad fina de las 6 características destiladas; Fase 7 queda skipped salvo que aparezcan superficies de venta.

## Next Actions

**Journey completo: 8 fases `done`, 1 `skipped`.** Lo que queda son decisiones de producto, no auditorías:

1. **E51** — bajar de 6 pasos a 2 hasta el valor (abrir `.mpp` sin cuenta). El mayor hueco frente al visor 1.0.
2. **E50** — ejecutar los cortes C1-C6 de PRODUCT.md: de 14 vistas a 9.
3. **E8** — ayuda por vista; el texto ya está escrito dentro de `Cmd+K`.
4. Menores: E4 (progreso de importación), E12/E13 (feedback de undo/autosave), E24 parcial, E47 (RUM real).
