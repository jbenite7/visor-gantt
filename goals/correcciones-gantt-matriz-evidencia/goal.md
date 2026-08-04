# Correcciones Gantt, matriz y evidencia completa

Retomar el trabajo de la sesion "Apple-like UI redesign and matrix scheduling" y cerrar la app completa con evidencia real: importar el MPP indicado, crear el proyecto matricial de vivienda 3 etapas + urbanismo, corregir los defectos detectados y verificar todos los modulos con Playwright, browser nativo, screenshots, videos, traces y logs.

La comprension compartida esta en `goals/correcciones-gantt-matriz-evidencia/facts.md`. El plan aprobado esta en `goals/correcciones-gantt-matriz-evidencia/plan.md`.

Done condition: todos los facts aceptados quedan implementados o verificados; Docker, Jest, lint, build y Playwright Chromium pasan; la evidencia audiovisual y de logs queda en rutas exactas; `evidence-audit.md` documenta la revision visual por modulo; no se despliega a produccion y no se borran los proyectos E2E creados.

## Actualización 2026-08-04 — auditoría fact-by-fact y cierre parcial

Auditoría completa en `goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md`. Ejecución en
`docs/superpowers/plans/2026-08-04-cierre-auditoria-goals.md` y acta en `goals/cierre-auditoria-goals/cierre.md`.

### Facts que pasan a estar implementados

- **65, 66, 67 (LOB) y 92 (Unidad Típica) — clasificación semiautomática de familias.** No existían en el código:
  ningún símbolo `matchedBy`, `confidence`, `breadcrumb` ni `activityFamily` en todo `v2/src`. Ahora implementados en
  `v2/src/lib/scheduling/activityFamily.ts`, con prioridad de breadcrumb sobre WBS sobre nombre, nivel de confianza y
  motivo de revisión. Consumidos por los tres generadores de LOB y por Unidad Típica.
- **8 y 111 — conservación de proyectos E2E.** El código los contradecía: 9 de 12 specs ejecutaban
  `DELETE FROM projects`. Ahora ninguno lo hace; el aislamiento viene de `e2e/helpers/runId.ts`. Probado: tras la
  corrida completa quedan 35 proyectos en base, identificables por su `runId`. La limpieza pasó al script manual
  `v2/scripts/clean-e2e-projects.ts`, que exige `--yes` y solo toca filas con marcador de corrida.
- **35 — persistencia del arrastre WBS.** Antes se probaba con el botón de la barra. Ahora hay cobertura con arrastre
  HTML5 real, en ambos sentidos, verificando base de datos y recarga.
- **4 — cero overflow.** Añadida red de seguridad `overflow-x: hidden` con `max-width` en `html` y `body`. La
  verificación real la sigue haciendo el check en runtime.
- **106 y 112 — corrida de cierre y navegador único.** `playwright.config.ts` fija `workers: 1` siempre, deja solo
  Chromium y activa traza, vídeo y captura de pantalla de forma permanente.

### Hallazgo sobre el estado de la suite E2E

El acta del 2026-07-08 afirma "11 passed, 1 skipped". Al ejecutarla en esta sesión con el stack real, el punto de
partida era **5 fallos**, causados por cambios de UI posteriores que nunca se reflejaron en los tests: el Asistente
y What-If se movieron dentro de un `<details>` colapsable, las columnas responsivas ocultan controles en viewports
estrechos, y un campo de tipo pasó a ser `<select>`. Reparados. Además, el fixture `.mpp` apuntaba a una ruta de otra
máquina, lo que hacía el spec inejecutable fuera de ella; ahora resuelve por variable de entorno, ruta original o
fixture del repositorio.

Estado final: **50 passed, 1 skipped, 0 failed**. El único saltado es `production-gantt-benchmark`, que exige
`PRODUCTION_SSH_HOST` por diseño del spec. Tras la corrida completa la base conserva 87 proyectos, prueba directa de
los facts 8 y 111.
