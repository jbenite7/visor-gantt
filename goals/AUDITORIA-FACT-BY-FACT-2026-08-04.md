# Auditoría fact-by-fact de todos los goals — 2026-08-04

Auditoría independiente contra el **código real**, no contra los autoreportes de `goal.md`,
`plan.md`, `completion-audit-*.md` ni las capturas PNG. Prueba válida = código fuente o test
automatizado existente.

## Verificación de base (salida real de esta sesión)

| Comprobación | Resultado |
| --- | --- |
| `npm test -- --runInBand` | 75 suites, 543 tests, todos pasan |
| `npm run lint` | limpio |
| `npm run build` | exitoso |
| Specs E2E | 12 specs, 17 tests |

## Veredicto por goal

| Goal | Estado declarado | Veredicto real |
| --- | --- | --- |
| correcciones-gantt-matriz-evidencia | abierto | **No cierra** — 7 no cumplen, 9 parciales |
| paridad-visor-10 | `completed` | **No cierra** — criterio 6 incompleto |
| top5-ui-ux-business-improvements-gantt | cerrado 2026-07-08 | **No cierra** — 6 parciales de 33 conductuales |
| server-side-mpp-import | sin cierre | **No cierra** — bug de manejo de errores |
| predecessors-use-row-id | sin cierre | Cierra en código; falta chequeo en navegador |
| optimize-gantt-recalculation | sin cierre | Cierra; falta evidencia Docker y autosave/undo |
| production-e2e-gantt-benchmarks | sin cierre | Mecanismo correcto; ejecución no re-verificable |

## Incumplimientos confirmados por verificación directa

### 1. No existe el módulo de clasificación de familias

Cuatro facts (65, 66, 67 de LOB y 92 de Unidad Típica) describen clasificación semiautomática
con reglas regex, prioridad, nivel de confianza, breadcrumb y motivo de revisión.

Verificación: `grep -rniE "matchedBy|classificationSource|confidence|breadcrumb|activityFamily|familyRule"`
sobre `v2/src` devuelve **cero resultados**. La raíz "famil" no aparece en `lob.ts` ni en
`typicalUnit.ts`. No es una implementación incompleta: no existe.

Impacto: invalida lógica central prometida en Línea de Balance y Unidad Típica.

### 2. La suite E2E borra los proyectos que los facts exigen conservar

Fact 8: "La suite E2E conserva los proyectos creados/importados en la base local para revision
posterior." Fact 111: "No se borraran proyectos E2E al finalizar."

Verificación: **9 de 12 specs** ejecutan `DELETE FROM projects WHERE name LIKE ...`:
`dependency-visual-persistence`, `final-visual-audit`, `hierarchy-visual-persistence`,
`matrix-deep-project-evidence`, `matrix-new-project`, `mpp-import-matrix-runtime`,
`planning-assistant-runtime`, `ui-settings-persistence`, `what-if-persistence`.

Contradicción directa y verificada entre lo prometido y lo que hace el código.

### 3. Los errores de importación se muestran como JSON crudo

`HomeMppUploadAction.tsx:44` es un `<form action="/api/import-mpp" method="post">` nativo
enviado con `requestSubmit()`, **sin `onSubmit`, sin `fetch`, sin `preventDefault`**.

`api/import-mpp/route.ts` responde a los fallos con `NextResponse.json({error}, {status})` en
cinco caminos: archivo inválido (400), extensión incorrecta (400), tamaño excedido (413),
fallo del parser (status del parser), fallo al guardar (500).

Como la navegación es nativa, en los cinco casos el navegador abandona la página y renderiza
el JSON crudo como página completa. Ningún test cubre este camino.

### 4. Banner ausente en un goal marcado como completado

`paridad-visor-10` está marcado `completed`. Su fact 34 pide "Banner informativo sutil entre
toolbar y SplitPane". Verificación: la única ocurrencia de "banner" en `v2/src` está en
`MPPUploader.test.tsx`, un test de otro componente. Los otros 9 criterios sí están implementados.

### 5. El drag de jerarquía no tiene cobertura de persistencia real

El mecanismo existe (`GanttTable.tsx:625`, umbral sobre `deltaX`), pero el único E2E de
persistencia (`hierarchy-visual-persistence.spec.ts:263`) usa el botón `hierarchy-indent` de la
barra de herramientas, no un arrastre de mouse. El fact 35 pide explícitamente que los cambios
por drag sobrevivan a la recarga.

## Falsos positivos descartados

Dos hallazgos reportados por los auditores fueron verificados y **son incorrectos**:

- "No existe explicación de impacto antes/después": sí existe, en `scenarios.ts:79`
  (`dateDeltaDays`, `ScenarioTaskImpact`, lista `impacts`).
- "No está garantizado que la IA no aplique cambios sin confirmación": sí lo está.
  `WhatIfScenarioPanel.tsx:119` tiene botones explícitos Aplicar y Descartar, y
  `onApplyDuration` solo se dispara desde el `onClick` de Aplicar.

## Deuda menor registrada

- No hay `overflow-x: hidden` defensivo en `html`/`body` (`globals.css:362-377`); el cero-overflow
  depende del buen comportamiento de cada componente más un check en runtime.
- `playwright.config.ts` no fuerza `workers: 1` fuera de CI y declara proyectos firefox/webkit
  pese al fact que fija Chromium como navegador único.
- Faltan tests de componente dedicados para `ColumnSelector` y `DependencyPopover`.
- `predecessors-use-row-id` y `optimize-gantt-recalculation` no tienen documento de cierre pese
  a estar implementados y cubiertos por tests.
