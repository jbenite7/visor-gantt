# Auditoria de avance - 2026-07-03

Objetivo auditado: convertir Gantt en editor operativo diferenciado frente a MS Project, completar refactor visual apple-like 2026 en toda la app, y asegurar que un `.mpp` importado genere programacion matricial automatica con paridad simetrica CPM/Gantt.

## Estado ejecutivo

Estado actual: **cerrado con evidencia actualizada el 2026-07-08**.

La evidencia actual prueba matriz, importacion `.mpp`, UI apple-like, recomendaciones, escenarios, dashboard, Excel, Last Planner preview, persistencia de vistas por rol, dependencias visuales con guardado/recarga, jerarquia visual con guardado/recarga, what-if con preview/aplicar/recarga, asistente de planificacion en runtime, auditoria visual final desktop/mobile, corrida E2E global local, benchmark sintetico, build Docker actual y consolidacion git/release.

## Evidencia fuerte encontrada

| Area | Estado | Evidencia actual |
| --- | --- | --- |
| `.mpp` -> matriz automatica | Probado parcialmente fuerte | `v2/e2e/mpp-import-matrix-runtime.spec.ts` importa un `.mpp` real, valida `matrixPlan`, celdas activas y `matrixSource`; unit tests en `mpp-project`, `matrixFromGantt`, `matrixGenerator`, `matrixSync`. |
| Paridad matriz/Gantt | Probado parcialmente fuerte | Tests de `matrixFromGantt`, `matrixGenerator`, `matrixSync` y autosync en `GanttView.test.tsx`; incluye recursos, costos, hitos, critica, deadlines/baseline preservados en sync. |
| Editor jerarquia | Probado fuerte | `taskStructure.test.ts`, `GanttTable.test.tsx`, `GanttView.test.tsx` y `v2/e2e/hierarchy-visual-persistence.spec.ts`; evidencia incremental de drag/drop, botones, WBS, autosave en PostgreSQL y recarga visible. |
| Editor dependencias | Probado fuerte | `dependencyEditing.test.ts`, `planningValidation.test.ts`, `GanttTable.test.tsx`, `GanttView.test.tsx` y `v2/e2e/dependency-visual-persistence.spec.ts`; cubre popover, panel lateral, sucesoras, ciclos, lags, autosave en PostgreSQL y recarga visible. |
| Asistente preventivo | Probado fuerte | `planningRecommendations.test.ts`, `PlanningAssistantPanel.tsx`, `GanttView.test.tsx` y `v2/e2e/planning-assistant-runtime.spec.ts`; cubre dependencias faltantes, convergencia critica, capacidad, deadline, restricciones MPP, baseline, visualizacion runtime sin mutar `project_data` y persistencia tras recarga. |
| What-if | Probado fuerte | `scenarios.test.ts`, `WhatIfScenarioPanel.tsx`, `GanttView.test.tsx` y `v2/e2e/what-if-persistence.spec.ts`; cubre preview sin mutar DB, descartar, aplicar, autosave en PostgreSQL y recarga visible. |
| LOB y Curva S | Probado fuerte | `lob.test.ts`, `LineOfBalance.test.tsx`, `scurve.test.ts`, `SCurveView.test.tsx` y `v2/e2e/final-visual-audit.spec.ts`; diagnosticos automaticos, feedback visual y captura runtime desktop/mobile. |
| Triple restriccion/reporting | Probado fuerte | `executiveDashboard.test.ts`, `ExecutivePlanningDashboard.test.tsx`, `executiveReportExport.test.ts` y `v2/e2e/final-visual-audit.spec.ts`; CSV/PDF por impresion y dashboard cubierto en runtime visual. |
| Persistencia UI por rol | Probado fuerte | `v2/e2e/ui-settings-persistence.spec.ts` valida autosave en PostgreSQL y recarga real. |
| Performance | Probado parcialmente | Benchmark sintetico documentado y `production-gantt-benchmark.spec.ts`; la suite global local omite el benchmark de produccion cuando falta `PRODUCTION_SSH_HOST`, porque requiere verificar commit/runtime desplegado. |
| Refactor visual apple-like | Probado fuerte | Muchas capturas en `v2/tmp/`, busquedas de deuda visual legacy registradas en `goal.md` y auditoria visual sistematica en `v2/e2e/final-visual-audit.spec.ts`; 40 capturas desktop/mobile en `v2/tmp/visual-audit-2026-07-03/`. |

## Brechas que impiden marcar completo

Ninguna brecha del objetivo original queda abierta al 2026-07-08. El benchmark de produccion remoto sigue condicionado por `PRODUCTION_SSH_HOST`, por diseno del spec; no bloquea el cierre local porque la suite global actual lo marca como `skipped` explicitamente y el benchmark sintetico local queda cubierto.

## Siguiente mejor avance

Prioridad recomendada: **abrir un nuevo goal para la siguiente capa de paridad funcional (`goals/paridad-visor-10/`)**, sin mezclarlo con este cierre.

Razon: el goal actual ya tiene editor operativo, UI apple-like y paridad `.mpp` -> matriz/Gantt verificados. La siguiente lista de 10 ideas es una ampliacion posterior y debe evolucionar como objetivo separado.

Flujo minimo:

1. Mantener este goal cerrado y estable.
2. Implementar `paridad-visor-10` en ciclos propios.
3. Conservar E2E global como gate de regresion antes de mezclar nuevos ViewTypes.

## Actualizacion 2026-07-03

- Cerrada la brecha de dependencias visuales con `v2/e2e/dependency-visual-persistence.spec.ts`.
- Evidencia: `npx eslint e2e/dependency-visual-persistence.spec.ts`; `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/dependency-visual-persistence.spec.ts --project=chromium`; `npm run lint`; `npm run build`.
- Cerrada la brecha de jerarquia visual con `v2/e2e/hierarchy-visual-persistence.spec.ts`.
- Evidencia: `npx eslint e2e/hierarchy-visual-persistence.spec.ts`; `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/hierarchy-visual-persistence.spec.ts --project=chromium`; `npm run lint`; `npm run build`.
- Cerrada la brecha de what-if con `v2/e2e/what-if-persistence.spec.ts`.
- Evidencia: `npx eslint e2e/what-if-persistence.spec.ts`; `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/what-if-persistence.spec.ts --project=chromium`; `npm run lint`; `npm run build`.
- Cerrada la brecha de asistente/recomendaciones con `v2/e2e/planning-assistant-runtime.spec.ts`.
- Evidencia: `npx eslint e2e/planning-assistant-runtime.spec.ts`; `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/planning-assistant-runtime.spec.ts --project=chromium`; `npm run lint`; `npm run build`.
- Cerrada la brecha de auditoria visual final con `v2/e2e/final-visual-audit.spec.ts`.
- Evidencia: `npm test -- --runInBand src/components/views/MatrixEditorView.test.tsx`; `npx eslint e2e/final-visual-audit.spec.ts src/components/views/MatrixEditorView.tsx`; `npm run build`; `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/final-visual-audit.spec.ts --project=chromium`; 40 capturas en `v2/tmp/visual-audit-2026-07-03/`.
- Cerrada la brecha de corrida E2E global local.
- Evidencia: `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 MPP_PARSER_URL=http://127.0.0.1:8000 npm run test:e2e -- --project=chromium --workers=1`: 11 passed, 1 skipped por requerir `PRODUCTION_SSH_HOST`; `npm run lint`; `npm run build`.

## Actualizacion final 2026-07-08

- Consolidacion git/release completada en commits coherentes: importacion `.mpp` con paridad matricial, editor Gantt avanzado, UI apple-like, Last Planner preview, benchmark sintetico, E2E runtime, limpieza de temporales y cierre documental.
- Runtime Docker reconstruido desde el codigo actual con `docker compose up -d --build frontend`; el build de Next paso dentro de Docker y se recrearon `frontend` y `mpp-parser`.
- Verificacion local completa: `npm run lint` paso; `npm test -- --runInBand` paso con 71 suites y 508 tests.
- Verificacion runtime final: `DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 MPP_PARSER_URL=http://127.0.0.1:8000 npx playwright test --project=chromium --workers=1` paso con 11 tests passed y 1 skipped (`production-gantt-benchmark`, requiere `PRODUCTION_SSH_HOST`).
- Salud runtime confirmada: `curl -I http://127.0.0.1:3000/login` devolvio 200 y `curl -s http://127.0.0.1:8000/api/health` devolvio `{"status":"ok","mpxj_available":true}`.
- Estado de cierre: el objetivo original queda probado y cerrable. El paquete `goals/paridad-visor-10/` es trabajo posterior y no cambia el criterio de cierre de este goal.
