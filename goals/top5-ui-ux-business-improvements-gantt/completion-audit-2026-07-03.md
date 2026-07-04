# Auditoria de avance - 2026-07-03

Objetivo auditado: convertir Gantt en editor operativo diferenciado frente a MS Project, completar refactor visual apple-like 2026 en toda la app, y asegurar que un `.mpp` importado genere programacion matricial automatica con paridad simetrica CPM/Gantt.

## Estado ejecutivo

Estado actual: **parcial alto, no cerrable todavia**.

La evidencia actual prueba avances importantes en matriz, importacion `.mpp`, UI apple-like, recomendaciones, escenarios, dashboard, Excel, Last Planner preview, persistencia de vistas por rol, dependencias visuales con guardado/recarga, jerarquia visual con guardado/recarga, what-if con preview/aplicar/recarga, asistente de planificacion en runtime, auditoria visual final desktop/mobile, corrida E2E global local y benchmark sintetico. No prueba aun el cierre completo del goal porque falta consolidacion git/release.

## Evidencia fuerte encontrada

| Area | Estado | Evidencia actual |
| --- | --- | --- |
| `.mpp` -> matriz automatica | Probado parcialmente fuerte | `v2/e2e/mpp-import-matrix-runtime.spec.ts` importa un `.mpp` real, valida `matrixPlan`, celdas activas y `matrixSource`; unit tests en `mpp-project`, `matrixFromGantt`, `matrixGenerator`, `matrixSync`. |
| Paridad matriz/Gantt | Probado parcialmente fuerte | Tests de `matrixFromGantt`, `matrixGenerator`, `matrixSync` y autosync en `GanttView.test.tsx`; incluye recursos, costos, hitos, critica, deadlines/baseline preservados en sync. |
| Editor jerarquia | Probado fuerte | `taskStructure.test.ts`, `GanttTable.test.tsx`, `GanttView.test.tsx` y `v2/e2e/hierarchy-visual-persistence.spec.ts`; evidencia incremental de drag/drop, botones, WBS, autosave en PostgreSQL y recarga visible. |
| Editor dependencias | Probado fuerte | `dependencyEditing.test.ts`, `planningValidation.test.ts`, `GanttTable.test.tsx`, `GanttView.test.tsx` y `v2/e2e/dependency-visual-persistence.spec.ts`; cubre popover, panel lateral, sucesoras, ciclos, lags, autosave en PostgreSQL y recarga visible. |
| Asistente preventivo | Probado fuerte | `planningRecommendations.test.ts`, `PlanningAssistantPanel.tsx`, `GanttView.test.tsx` y `v2/e2e/planning-assistant-runtime.spec.ts`; cubre dependencias faltantes, convergencia critica, capacidad, deadline, restricciones MPP, baseline, visualizacion runtime sin mutar `project_data` y persistencia tras recarga. |
| What-if | Probado fuerte | `scenarios.test.ts`, `WhatIfScenarioPanel.tsx`, `GanttView.test.tsx` y `v2/e2e/what-if-persistence.spec.ts`; cubre preview sin mutar DB, descartar, aplicar, autosave en PostgreSQL y recarga visible. |
| LOB y Curva S | Probado por unit/component | `lob.test.ts`, `LineOfBalance.test.tsx`, `scurve.test.ts`, `SCurveView.test.tsx`; diagnosticos automaticos y feedback visual. Falta E2E real con proyecto grande. |
| Triple restriccion/reporting | Probado por component/unit | `executiveDashboard.test.ts`, `ExecutivePlanningDashboard.test.tsx`, `executiveReportExport.test.ts`; CSV/PDF por impresion. Falta E2E dashboard con datos reales de costo/avance recargados. |
| Persistencia UI por rol | Probado fuerte | `v2/e2e/ui-settings-persistence.spec.ts` valida autosave en PostgreSQL y recarga real. |
| Performance | Probado parcialmente | Benchmark sintetico documentado y `production-gantt-benchmark.spec.ts`; la suite global local omite el benchmark de produccion cuando falta `PRODUCTION_SSH_HOST`, porque requiere verificar commit/runtime desplegado. |
| Refactor visual apple-like | Probado fuerte | Muchas capturas en `v2/tmp/`, busquedas de deuda visual legacy registradas en `goal.md` y auditoria visual sistematica en `v2/e2e/final-visual-audit.spec.ts`; 40 capturas desktop/mobile en `v2/tmp/visual-audit-2026-07-03/`. |

## Brechas que impiden marcar completo

1. **Estado git/release**: muchas piezas siguen en worktree no trackeado o no committeado; no se puede afirmar cierre entregable mientras la unidad de cambio siga dispersa.

## Siguiente mejor avance

Prioridad recomendada: **consolidar git/release en commits coherentes**.

Razon: las brechas funcionales E2E principales, la auditoria visual final y la suite E2E global local ya tienen evidencia; el cierre entregable requiere que el trabajo deje de estar disperso en archivos modificados/no trackeados y pueda revisarse/transportarse en commits coherentes.

Flujo minimo:

1. Revisar dependencias entre archivos modificados/no trackeados.
2. Agrupar commits por unidad funcional evitando commits que no compilen desde `HEAD`.
3. Verificar staged diff antes de cada commit.
4. Mantener fuera cualquier artefacto temporal o evidencia pesada que no deba versionarse.

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
