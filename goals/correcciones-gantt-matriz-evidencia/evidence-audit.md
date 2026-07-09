# Evidence audit - Gantt/matriz full app

Fecha de revision: 2026-07-08

## Ejecucion

Comando ejecutado desde `v2/`:

```bash
DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 MPP_PARSER_URL=http://127.0.0.1:8000 npx playwright test e2e/full-app-evidence.spec.ts --project=chromium --workers=1
```

Resultado: `38 passed (1.8m)`.

Runtime verificado:

- Docker frontend: `http://127.0.0.1:3000`
- Parser MPP: `http://localhost:8000/api/health` -> `{"status":"ok","mpxj_available":true}`
- MPP fuente: `/Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp`
- Reporte HTML: `v2/playwright-report/index.html`
- Ultima corrida: `v2/test-results/e2e/.last-run.json`

## Artefactos generados

- Screenshots, videos y traces: `v2/test-results/e2e/full-app-evidence-*`
- Logs JSON por modulo: `70` archivos `*.logs.json` nuevos bajo `v2/test-results/e2e/full-app-evidence-*`
- Conteo de artefactos nuevos screenshot/video/trace: `184`
- Verificacion automatica de logs criticos con el mismo criterio del test: `criticalCount = 0`
- Hojas de contacto revisadas manualmente:
  - `goals/correcciones-gantt-matriz-evidencia/evidence-contact-import-mpp.png`
  - `goals/correcciones-gantt-matriz-evidencia/evidence-contact-matrix-housing.png`

## Directorios principales

| Escenario | Directorio de flujo | Video | Trace |
| --- | --- | --- | --- |
| Import MPP | `v2/test-results/e2e/full-app-evidence-E2E-app--6a981-s-flow-import-mpp-full-flow-chromium` | `video.webm` | `trace.zip` |
| Matrix housing | `v2/test-results/e2e/full-app-evidence-E2E-app--45797-ow-matrix-housing-full-flow-chromium` | `video.webm` | `trace.zip` |

## Revision visual

| Modulo | Import MPP | Matrix housing | Revision |
| --- | --- | --- | --- |
| Home | `.../import-mpp-app-home.png` | `.../matrix-housing-app-home.png` | OK. Lista de proyectos visible; sin overflow global en logs. |
| Upload | `.../import-mpp-app-upload.png` | `.../matrix-housing-app-upload.png` | OK. Formulario visible; flujo importo el MPP real. |
| Crear Proyecto | `.../import-mpp-app-crear-proyecto.png` | `.../matrix-housing-app-crear-proyecto.png` | OK. Editor matricial visible; caso vivienda generado. |
| Gantt | `.../import-mpp-gantt.png` | `.../matrix-housing-gantt.png` | OK. Tabla y timeline cargan; ID/UID visibles como enteros; sin franja lateral en revision. |
| Ejecutivo | `.../import-mpp-executive.png` | `.../matrix-housing-executive.png` | OK. KPIs y acciones de reporte visibles. |
| Seguimiento | `.../import-mpp-tracking.png` | `.../matrix-housing-tracking.png` | OK. Vista baseline/seguimiento visible. |
| Hoja Tareas | `.../import-mpp-tasksheet.png` | `.../matrix-housing-tasksheet.png` | OK. Tabla con columnas principales y scroll interno controlado. |
| Diagrama Red | `.../import-mpp-network.png` | `.../matrix-housing-network.png` | OK. Nodos visibles con dependencias; sin pantalla rota. |
| Recursos | `.../import-mpp-resources.png` | `.../matrix-housing-resources.png` | OK con estado vacio limpio cuando no hay recursos. |
| Linea Balance | `.../import-mpp-lob.png` | `.../matrix-housing-lob.png` | OK. Grafico visible y derivado de tareas/matriz. |
| Matriz | `.../import-mpp-matrix.png` | `.../matrix-housing-matrix.png` | OK. Jerarquia, celdas y panel de celda visibles. |
| Curva S | `.../import-mpp-scurve.png` | `.../matrix-housing-scurve.png` | OK. Grafico visible; sin error de chart. |
| Cuellos | `.../import-mpp-bottlenecks.png` | `.../matrix-housing-bottlenecks.png` | OK. Hallazgos o estado vacio limpio, segun datos. |
| Conflictos | `.../import-mpp-conflictos.png` | `.../matrix-housing-conflictos.png` | OK. Conflictos o estado limpio visible, sin mutacion automatica. |
| Unidad Tipica | `.../import-mpp-unidadtipica.png` | `.../matrix-housing-unidadtipica.png` | OK. Import degrada limpio; vivienda muestra patrones repetidos. |
| Calendario | `.../import-mpp-calendario.png` | `.../matrix-housing-calendario.png` | OK. Calendario con tareas y dias laborales/no laborales visible. |
| Configuracion | `.../import-mpp-settings.png` | `.../matrix-housing-settings.png` | OK. Formulario de calendario laboral visible. |

## Logs y overflow

Cada `*.logs.json` incluye:

- `scenario`
- `module`
- `url`
- `timestamp`
- `console`
- `pageerror`
- `requestfailed`
- `http4xx`
- `http5xx`
- `htmlScrollWidth`
- `bodyScrollWidth`
- `clientWidth`
- `hasDocumentOverflow`

Resultado de la revision automatica de la corrida:

- `hasDocumentOverflow`: `false` en los 70 logs revisados.
- `http5xx`: `0`.
- `pageerror`: `0`.
- `criticalCount`: `0`.
- `requestfailed` observado corresponde a abortos benignos `net::ERR_ABORTED` de navegacion/RSC filtrados por la suite.

## Pendientes de alcance mayor

Esta evidencia cubre la feature E2E actual y deja artefactos revisables por modulo. El goal completo aun mantiene pendientes fuera de esta feature, incluyendo el cierre fact-by-fact completo, posibles endurecimientos de clasificacion LOB/Unidad Tipica y cualquier correccion futura que el usuario pida revisar fix por fix.
