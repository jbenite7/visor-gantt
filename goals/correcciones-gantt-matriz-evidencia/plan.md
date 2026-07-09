# Plan

## Enfoque

Cerrar el goal como una correccion funcional + evidencia completa sobre el runtime real Docker de `v2`. El contrato de aceptacion esta en `facts.md`: todos los modulos deben cargar, navegar, persistir cuando aplique, cumplir cero overflow, no emitir errores criticos y dejar evidencia visual/logs revisables.

El precedente de `lps-aia` se aplica como criterio, no como dependencia directa: Linea de Balance y Unidad Tipica deben clasificar familias con ruta/WBS/breadcrumb, reglas, prioridad, confianza y revision humana cuando haya ambiguedad.

## Pasos

1. Inventario inicial y evidencia pendiente
   - Revisar el arbol sucio sin revertir cambios no relacionados.
   - Inventariar evidencia ya existente en `v2/test-results/e2e`, `v2/playwright-report` y capturas nativas.
   - Crear durante la ejecucion un `goals/correcciones-gantt-matriz-evidencia/evidence-audit.md` con hallazgos visuales por modulo: OK, overflow, pantalla vacia, error JS, dato faltante o pendiente.
   - Verificacion: abrir/revisar manualmente screenshots clave y registrar rutas exactas.

2. Runtime Docker y datos de prueba
   - Levantar `docker compose up -d --build`.
   - Confirmar `mpp-parser` con `/api/health` y frontend en `http://127.0.0.1:3000`.
   - Validar que existe el archivo exacto `/Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp`.
   - Verificacion: health OK, contenedores saludables y error claro si el MPP no existe.

3. Contrato de importacion y proyecto matricial
   - Revisar `v2/src/app/api/import-mpp/route.ts`, `v2/src/lib/import/mpp-project.ts`, `v2/src/app/actions/project.ts` y `v2/src/app/project/new/NewProjectForm.tsx`.
   - Asegurar que el import MPP conserva tareas, dependencias, calendario, recursos cuando existan, `matrixPlan`, ID entero y Unique ID entero.
   - Asegurar que Crear Proyecto produce el caso vivienda: 3 etapas, torre de 10 pisos por etapa, Urbanismo con Vias, Redes exteriores y Zonas comunes, 4 alcances y persistencia en BD.
   - Verificacion: tests de import/API y validaciones DB en Playwright.

4. Gantt: ID, Unique ID, WBS drag y persistencia
   - Archivos: `v2/src/components/gantt/table/GanttRow.tsx`, `v2/src/lib/gantt/taskIds.ts`, `v2/src/lib/matrix/matrixGenerator.ts`, `v2/src/components/gantt/table/GanttTable.tsx`, `v2/src/lib/state/ProjectContext.tsx`, `v2/src/app/actions/project.ts`.
   - Mantener ID e Id. unico como enteros estilo MS Project, tanto en MPP importado como en tareas generadas desde matriz.
   - Validar drag horizontal real: derecha indenta y empaqueta como hija; izquierda desindenta. El cambio debe persistir tras guardar/recargar.
   - Verificacion: `GanttTable.test.tsx`, `matrixGenerator.test.ts`, E2E de drag y captura nativa en browser Codex.

5. Cero overflow global
   - Archivos: `v2/src/app/project/[id]/ProjectView.tsx`, `v2/src/components/views/GanttView.tsx`, `v2/src/components/gantt/toolbar/ProjectToolbar.tsx`, `v2/src/components/gantt/toolbar/ViewSidebar.tsx`, `v2/src/app/globals.css` y vistas en `v2/src/components/views/`.
   - Consolidar `min-w-0`, `overflow-hidden` de contenedores de pagina y `overflow-auto` solo en regiones internas.
   - Evitar barras/franjas vacias laterales como la capturada en `/project/126`.
   - Verificacion: Playwright mide `documentElement.scrollWidth`, `body.scrollWidth` y captura por modulo; inspeccion visual manual confirma que no hay overflow incoherente.

6. Clasificacion semiautomatica para LOB y Unidad Tipica
   - Crear o extender una capa compartida, propuesta: `v2/src/lib/scheduling/activityClassifier.ts` con tests.
   - Entradas: `GanttTask[]`, `matrixPlan` cuando exista, WBS, nombre, resumen padre/breadcrumb y ruta de matriz.
   - Salida: familia/sistema, unidad detectada, `matchedBy`, nivel de breadcrumb, confianza, `reviewRequired`, `reviewReason`, y fuente de datos.
   - Reglas inspiradas en `lps-aia`: cascada nombre -> breadcrumb/WBS -> capitulo/ruta, filtro por contexto, regex con prioridad/confianza, tokens normalizados, y bloqueo de matches ambiguos por textos como Piso, Torre, Staff, Retiro, Ejes o Zona.
   - Verificacion: tests con casos ambiguos equivalentes al precedente de `lps-aia`; no clasificar por nombre si el WBS/breadcrumb contradice el texto.

7. Linea de Balance
   - Archivos: `v2/src/lib/scheduling/lob.ts`, `v2/src/components/charts/LineOfBalance.tsx`, `v2/src/components/views/GanttView.tsx`, `v2/src/lib/scheduling/lob.test.ts`.
   - Reemplazar/fortalecer heuristicas simples con la clasificacion compartida.
   - Mostrar patrones reales desde tareas/matriz, diagnosticos, estado limpio y razon de insuficiencia cuando no haya datos.
   - Exponer trazabilidad visible o adjunta: fuente, confianza y motivo de revision.
   - Verificacion: unit tests de generacion LOB y E2E del modulo `lob` para MPP y vivienda matricial.

8. Unidad Tipica
   - Archivos: `v2/src/lib/scheduling/typicalUnit.ts`, `v2/src/components/views/TypicalUnitView.tsx`, `v2/src/lib/scheduling/typicalUnit.test.ts`.
   - Usar la misma clasificacion compartida para agrupar sistemas repetidos por piso/torre/etapa/unidad.
   - Mostrar modo consolidado y por nivel, con estado limpio cuando no existan al menos tres niveles comparables.
   - Verificacion: unit tests para agrupacion, ambiguedad y degradacion; E2E de botones Consolidado/Por Nivel.

9. Endurecimiento modulo por modulo
   - Login/Home/Upload/Crear Proyecto: rutas `v2/src/app/login/page.tsx`, `v2/src/app/page.tsx`, `v2/src/app/upload/page.tsx`, `v2/src/app/project/new/*`.
   - Proyecto: `GanttView.tsx` y vistas `TaskSheetView`, `TrackingGanttView`, `NetworkDiagramView`, `ResourceSheetView`, `ResourceUsageView`, `AssignmentSheetView`, `SCurveView`, `BottlenecksView`, `ConflictsView`, `CalendarView`, `CalendarSettingsView`, `TypicalUnitView`.
   - Para cada modulo: selector/test id estable, contenido distintivo, estado vacio limpio, datos reales cuando existan, cero overflow y no errores JS.
   - Verificacion: tests enfocados existentes o nuevos por modulo donde el riesgo sea de logica; E2E para la cobertura visual.

10. Suite E2E con evidencia completa
    - Refactor o extender `v2/e2e/full-app-evidence.spec.ts`; si crece demasiado, extraer helpers a `v2/e2e/support/evidence.ts`.
    - Mantener `test.use({ video: "on", screenshot: "on", trace: "on" })` para esta suite aunque `playwright.config.ts` tenga defaults mas conservadores.
    - Capturar logs por modulo: console, pageerror, requestfailed, responses >=400, URL, modulo, escenario, timestamp y metricas de overflow.
    - Escenarios: `import-mpp-full-flow`, `matrix-housing-full-flow`, app modules y cada modulo de proyecto con video propio.
    - Validaciones DB: proyectos conservados, tareas > 0, dependencias, `matrixPlan`, 4 alcances, 33 ubicaciones, 132 celdas activas en el caso vivienda.
    - Verificacion: comando principal desde `v2` con `PLAYWRIGHT_BASE_URL`, `DATABASE_URL`, `MPP_PARSER_URL`, Chromium y `--workers=1`.

11. Revision visual nativa
    - Usar browser nativo de Codex para al menos: Gantt real importado, Gantt demo/drag WBS, Linea de Balance, Unidad Tipica y una captura de overflow global.
    - Guardar capturas/logs en `v2/test-results/e2e/native-browser-*`.
    - Verificacion: documentar en `evidence-audit.md` que las imagenes fueron revisadas visualmente y no solo generadas.

12. Cierre de calidad
    - Ejecutar verificaciones enfocadas primero:
      - `npx jest src/components/gantt/table/GanttTable.test.tsx src/lib/matrix/matrixGenerator.test.ts src/lib/scheduling/lob.test.ts src/lib/scheduling/typicalUnit.test.ts --runInBand`
      - tests nuevos de `activityClassifier` si se crea.
    - Ejecutar verificacion completa:
      - `npm test -- --runInBand`
      - `npm run lint`
      - `npm run build`
      - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 DATABASE_URL=postgresql://visoruser:visorpass@localhost:5432/visormpp MPP_PARSER_URL=http://127.0.0.1:8000 npx playwright test e2e/full-app-evidence.spec.ts --project=chromium --workers=1`
    - Cierre aceptado solo si no hay errores JS criticos, no hay respuestas 500, los proyectos persisten y la evidencia audiovisual/logs queda ubicada y revisada.

## Matriz granular por modulo

Esta matriz es el checklist operativo durante la implementacion. Cada fila debe quedar marcada en `evidence-audit.md` con ruta de screenshot/video/log y resultado de overflow.

| Modulo | Archivos principales | Acciones exactas | Verificacion |
| --- | --- | --- | --- |
| Login | `v2/src/app/login/page.tsx`, `v2/src/app/actions/auth.ts`, `v2/src/lib/auth/session.ts` | Abrir `/login`, probar credenciales validas, probar credenciales invalidas, validar cookie `vg_session`, validar redireccion desde ruta protegida sin sesion. | Playwright app module Login, screenshot, logs sin pageerror, assert URL Home tras login y error visible con password invalido. |
| Home | `v2/src/app/page.tsx`, `v2/src/components/ProjectList.tsx`, `v2/src/lib/date/projectDate.ts` | Listar proyectos E2E, abrir proyecto importado, abrir proyecto matricial, verificar estado vacio si aplica, revisar fechas estables. | Screenshot Home, assert heading Mis proyectos, assert links `/project/<id>`, no mismatch por fechas, overflow false. |
| Upload | `v2/src/app/upload/page.tsx`, `v2/src/app/api/import-mpp/route.ts`, `v2/src/lib/api/mpp-client.ts`, `v2/src/lib/import/mpp-project.ts` | Seleccionar el MPP exacto, esperar `/project/<id>`, validar error recuperable si parser falla, adjuntar ruta fuente. | DB: tareas > 0, dependencias > 0 cuando existan, `matrixPlan` presente, IDs enteros; video/trace/log parser. |
| Crear Proyecto | `v2/src/app/project/new/NewProjectForm.tsx`, `v2/src/app/actions/project.ts`, `v2/src/lib/matrix/templates.ts`, `v2/src/lib/matrix/matrixGenerator.ts` | Crear vivienda 3 etapas, Torre 1/2/3, Piso 01..10, Urbanismo con Vias/Redes exteriores/Zonas comunes, activar todas las celdas, guardar. | DB: 4 alcances leaf, 33 ubicaciones leaf, 132 celdas activas, tareas generadas, reload desde Home. |
| Gantt | `GanttView.tsx`, `GanttTable.tsx`, `GanttRow.tsx`, `GanttChart.tsx`, `taskIds.ts`, `ProjectContext.tsx` | Revisar columnas ID/Id. unico/EDT, cambiar escala Dia/Semana/Mes/Trimestre, abrir comandos, seleccionar fila, drag WBS derecha/izquierda, guardar/recargar. | IDs enteros, drag persiste WBS, no overflow lateral, screenshot nativo antes/despues, tests tabla. |
| Ejecutivo | `v2/src/components/reports/ExecutivePlanningDashboard.tsx`, `v2/src/lib/gantt/executiveDashboard.ts`, `executiveReportExport.ts` | Validar KPIs, copiar/descargar/imprimir reporte, revisar datos reales y estados sin baseline/costos. | E2E export CSV, status visible, KPI visible, no ceros falsos en proyecto con tareas. |
| Seguimiento | `TrackingGanttView.tsx`, `v2/src/lib/scheduling/baseline.ts`, `ProjectContext.tsx` | Guardar baseline, seleccionar baseline, comparar plan vs real, navegar controles. | Baseline visible, vista no rota sin baseline previo, reload conserva baseline si se guardo. |
| Hoja Tareas | `TaskSheetView.tsx`, `GanttTable.tsx`, `ColumnSelector.tsx`, `taskColumns.ts` | Filtrar por texto, limpiar filtro, ordenar por ID/EDT/nombre/duracion, editar campo permitido, revisar columnas MPP. | Conteo cambia con filtro, IDs no cambian, tipos MPP parseables, scroll interno controlado. |
| Diagrama Red | `NetworkDiagramView.tsx`, `v2/src/lib/layout/networkLayout.ts`, `v2/src/lib/scheduling/cpm.ts` | Abrir vista, validar nodos/dependencias, ruta critica, interaccion con nodo, estado con ciclos o sin dependencias. | Screenshot de red, texto distintivo, layout sin overflow, tests de `networkLayout`. |
| Recursos | `ResourceSheetView.tsx`, `ResourceUsageView.tsx`, `AssignmentSheetView.tsx`, `BudgetTable.tsx`, `BudgetMapping.tsx`, `assignments.ts` | Alternar hoja/uso/asignaciones/presupuesto/mapeo, revisar recursos importados, estado vacio, editar recurso permitido. | E2E subviews, logs sin error, campos MPP visibles cuando existan, estado limpio sin recursos. |
| Linea Balance | `LineOfBalance.tsx`, `v2/src/lib/scheduling/lob.ts`, nuevo `activityClassifier.ts` | Generar LOB desde tareas/matriz, mostrar ejes/series, diagnosticos, fuente de clasificacion, confianza y revision. | Tests de clasificacion + LOB, casos ambiguos WBS vs nombre, screenshot con grafico o estado limpio explicado. |
| Matriz | `MatrixEditorView.tsx`, `matrixGenerator.ts`, `matrixSync.ts`, `matrixFromGantt.ts`, `tree.ts` | Navegar Alcances/Ubicaciones/Matriz, activar/desactivar celdas, asignar receta, sync desde Gantt, aplicar a Gantt, guardar. | Tests paridad, DB `matrixPlan`, tareas con `matrixSource`, IDs enteros, evidencia visual. |
| Curva S | `SCurveView.tsx`, `v2/src/lib/scheduling/scurve.ts`, `budgetMappings` | Alternar Presupuesto/Valor Ganado/Cronograma, validar fuente cuando falten costos, revisar granularidad. | Grafico o estado limpio, sin errores de chart, screenshot/log por ambos escenarios. |
| Cuellos | `BottlenecksView.tsx`, `v2/src/lib/scheduling/bottlenecks.ts`, `planningRecommendations.ts` | Mostrar issue types, severidad, recomendacion, estado sin issues, confirmar que no modifica cronograma. | Tests de bottlenecks, screenshot con cards o estado limpio, no cambios automaticos en DB. |
| Conflictos | `ConflictsView.tsx`, `v2/src/lib/scheduling/conflicts.ts` | Detectar conflictos de dependencias/fechas, filtrar por severidad/tipo si existe, estado limpio sin conflictos. | Tests de conflictos, screenshot, logs sin 500, no mutacion sin confirmacion. |
| Unidad Tipica | `TypicalUnitView.tsx`, `v2/src/lib/scheduling/typicalUnit.ts`, nuevo `activityClassifier.ts` | Detectar sistemas repetidos por WBS/matriz, alternar Consolidado/Por Nivel, mostrar confianza/revision cuando aplique. | Tests de agrupacion y ambiguedad, screenshot de tabla o estado limpio, overflow false. |
| Calendario | `CalendarView.tsx`, `projectCalendar.ts`, `colombiaHolidays.ts` | Navegar mes anterior/siguiente, mostrar laborales/no laborales/festivos, tareas superpuestas. | Tests calendario/festivos, screenshot mensual, logs sin error. |
| Configuracion | `CalendarSettingsView.tsx`, `ProjectContext.tsx`, `project.ts` | Cambiar dias laborales, validar bloqueo de valores invalidos, guardar, recargar, recalcular si afecta fechas. | Tests settings, reload conserva cambio, screenshot/log, no estado parcial corrupto. |

## Granularidad de evidencia

- Por cada modulo se adjuntan cuatro artefactos minimos: screenshot, video del test, trace.zip y log JSON.
- El log JSON de cada modulo incluye `scenario`, `module`, `url`, `timestamp`, `console`, `pageerror`, `requestfailed`, `http4xx`, `http5xx`, `htmlScrollWidth`, `bodyScrollWidth`, `clientWidth` y `hasDocumentOverflow`.
- El reporte final lista las rutas exactas bajo `v2/test-results/e2e` y `v2/playwright-report`.
- La revision manual marca cada captura como `ok`, `overflow`, `blank`, `broken-state` o `needs-follow-up`.

## Cobertura fact-by-fact

Cada fact aceptado debe cerrarse de forma explicita. La columna Pasos apunta a los pasos anteriores; la columna Check mantiene el texto verificable del fact para que no se pierda detalle durante la implementacion.

| Fact | Modulo | Pasos | Check verificable | Tipo |
| --- | --- | --- | --- | --- |
| global-01 | Global | 1, 2, 10, 12 | La verificacion principal se ejecuta contra el runtime real de Docker, no solo contra componentes aislados. | Automatica |
| global-02 | Global | 1, 2, 10, 12 | Cada modulo principal de la app debe tener evidencia visual nueva: screenshot, video Playwright o captura del browser nativo cuando aplique. | Automatica |
| global-03 | Global | 1, 2, 10, 12 | Cada modulo principal debe adjuntar logs con consola, pageerror, requestfailed, respuestas >=400, URL final, modulo, escenario y timestamp. | Automatica |
| global-04 | Global | 1, 2, 10, 12 | La regla global de cero overflow se cumple cuando html/body no tienen scroll horizontal y los scrolls internos aparecen solo en regiones intencionales. | Automatica |
| global-05 | Global | 1, 2, 10, 12 | Un modulo se considera funcional cuando carga contenido distintivo, no produce errores JavaScript, no recibe respuestas 500 y conserva navegacion estable. | Automatica |
| global-06 | Global | 1, 2, 10, 12 | La suite E2E conserva los proyectos creados/importados en la base local para revision posterior. | Automatica |
| login-01 | Login | 9, 10 | Login permite autenticar con email/password validos y redirige a Home con sesion persistida. | Automatica |
| login-02 | Login | 9, 10 | Login rechaza credenciales invalidas con un error visible y sin dejar una sesion activa. | Automatica |
| login-03 | Login | 9, 10 | Una sesion/cookie valida permite entrar a Home sin repetir login. | Automatica |
| login-04 | Login | 9, 10 | Las rutas protegidas redirigen a Login cuando no hay sesion valida. | Automatica |
| login-05 | Login | 9, 10 | La pantalla Login cumple cero overflow en escritorio y movil. | Automatica |
| login-06 | Login | 9, 10 | Login queda cubierto con captura visual y logs sin errores criticos. | Automatica |
| home-01 | Home | 9, 10 | Home lista proyectos existentes con nombre, fechas y acciones de navegacion estables. | Automatica |
| home-02 | Home | 9, 10 | Home muestra un estado vacio limpio cuando no hay proyectos visibles para el usuario. | Automatica |
| home-03 | Home | 9, 10 | Home permite abrir un proyecto importado o creado y llega a la ruta /project/<id> correcta. | Automatica |
| home-04 | Home | 9, 10 | Las fechas visibles en Home son deterministas y no cambian por locale/hidratacion entre SSR y cliente. | Automatica |
| home-05 | Home | 9, 10 | Home cumple cero overflow y mantiene controles accesibles en escritorio y movil. | Automatica |
| home-06 | Home | 9, 10 | Home queda cubierto con captura visual, video y logs por escenario. | Automatica |
| upload-01 | Upload | 2, 3, 10 | Upload importa el archivo real /Users/juanfelipebenitezramos/Downloads/20260303_Cronograma preconstrucción_DP 2.mpp. | Automatica |
| upload-02 | Upload | 2, 3, 10 | Upload funciona por UI autenticada y por endpoint/API usada por la suite E2E. | Automatica |
| upload-03 | Upload | 2, 3, 10 | La importacion conserva campos MPP clave: ID entero, Unique ID entero, WBS, fechas, duracion, dependencias, porcentaje y recursos cuando existan. | Automatica |
| upload-04 | Upload | 2, 3, 10 | Los errores del parser MPP se muestran como error recuperable y no como pantalla rota. | Automatica |
| upload-05 | Upload | 2, 3, 10 | Despues de importar, el proyecto abre en /project/<id> y contiene tareas, dependencias y matrixPlan persistidos en BD. | Automatica |
| upload-06 | Upload | 2, 3, 10 | Upload queda cubierto con captura, video, trace y logs del parser/API. | Automatica |
| new-project-01 | Crear Proyecto | 3, 10 | Crear Proyecto permite crear un proyecto matricial de vivienda con 3 etapas, una torre de 10 pisos por etapa y urbanismo. | Automatica |
| new-project-02 | Crear Proyecto | 3, 10 | El proyecto matricial nuevo incluye alcances Estructura, Arquitectura, Redes MEP y Urbanismo. | Automatica |
| new-project-03 | Crear Proyecto | 3, 10 | El proyecto matricial nuevo crea ubicaciones Etapa 1/Torre 1/Piso 01..10, Etapa 2/Torre 2/Piso 01..10, Etapa 3/Torre 3/Piso 01..10 y Urbanismo con Vias, Redes exteriores y Zonas comunes. | Automatica |
| new-project-04 | Crear Proyecto | 3, 10 | Crear Proyecto valida datos obligatorios y muestra errores visibles sin perder el formulario. | Automatica |
| new-project-05 | Crear Proyecto | 3, 10 | El proyecto matricial nuevo persiste en BD y sobrevive guardar, recargar y reabrir desde Home. | Automatica |
| new-project-06 | Crear Proyecto | 3, 10 | Crear Proyecto queda cubierto con evidencia nativa y E2E incluyendo logs de persistencia. | Automatica |
| gantt-01 | Gantt | 4, 5, 10, 11 | Gantt muestra ID y Id. unico como enteros estilo MS Project, sin slugs ni strings derivados del id interno. | Automatica |
| gantt-02 | Gantt | 4, 5, 10, 11 | Las tareas generadas desde matriz reciben ID, UNIQUE_ID y UID enteros secuenciales y persistibles. | Automatica |
| gantt-03 | Gantt | 4, 5, 10, 11 | Arrastrar una actividad a la derecha con el mouse la indenta: sube profundidad WBS y queda hija del grupo inmediatamente superior. | Automatica |
| gantt-04 | Gantt | 4, 5, 10, 11 | Arrastrar una actividad a la izquierda con el mouse la desindenta: baja profundidad WBS y deja de estar empaquetada en el grupo anterior. | Automatica |
| gantt-05 | Gantt | 4, 5, 10, 11 | Los cambios WBS por drag se guardan y sobreviven recarga del proyecto. | Automatica |
| gantt-06 | Gantt | 4, 5, 10, 11 | Gantt cumple cero overflow global: tabla y timeline manejan scroll interno sin crear franja vacia lateral en la pagina. | Automatica |
| executive-01 | Ejecutivo | 9, 10 | Ejecutivo muestra KPIs principales del proyecto con datos reales: tareas, avance, duracion, fechas, ruta critica o indicadores equivalentes disponibles. | Automatica |
| executive-02 | Ejecutivo | 9, 10 | Ejecutivo no muestra ceros falsos cuando el proyecto tiene datos; usa estados vacios solo cuando el dato realmente no existe. | Automatica |
| executive-03 | Ejecutivo | 9, 10 | Ejecutivo permite exportar o preparar reporte sin bloquear la pantalla ni producir errores. | Automatica |
| executive-04 | Ejecutivo | 9, 10 | Ejecutivo degrada limpiamente cuando faltan costos, baseline u otros datos opcionales. | Automatica |
| executive-05 | Ejecutivo | 9, 10 | Ejecutivo cumple cero overflow y se puede revisar visualmente en captura. | Automatica |
| tracking-01 | Seguimiento | 9, 10 | Seguimiento muestra linea base o estado 'sin linea base' de forma clara y no rota. | Automatica |
| tracking-02 | Seguimiento | 9, 10 | Seguimiento compara plan vs real cuando hay datos suficientes. | Automatica |
| tracking-03 | Seguimiento | 9, 10 | Los controles de Seguimiento modifican vista o filtros sin errores ni perdida de contexto. | Automatica |
| tracking-04 | Seguimiento | 9, 10 | Los datos editados o seleccionados en Seguimiento persisten cuando el flujo los guarda. | Automatica |
| tracking-05 | Seguimiento | 9, 10 | Seguimiento cumple cero overflow y queda cubierto con evidencia visual y logs. | Automatica |
| task-sheet-01 | Hoja Tareas | 4, 9, 10 | Hoja Tareas muestra columnas por defecto utiles: ID, Id. unico, EDT, actividad, fechas, duracion, avance y dependencias cuando existan. | Automatica |
| task-sheet-02 | Hoja Tareas | 4, 9, 10 | Hoja Tareas conserva tipos MPP clave: identificadores enteros, fechas parseables, porcentajes numericos y duraciones consistentes. | Automatica |
| task-sheet-03 | Hoja Tareas | 4, 9, 10 | Hoja Tareas permite edicion inline en campos editables y bloquea o degrada limpiamente los no editables. | Automatica |
| task-sheet-04 | Hoja Tareas | 4, 9, 10 | Filtros, busqueda o seleccion en Hoja Tareas no rompen la tabla ni cambian IDs visibles. | Automatica |
| task-sheet-05 | Hoja Tareas | 4, 9, 10 | Hoja Tareas cumple cero overflow con scroll interno controlado para muchas columnas. | Automatica |
| network-01 | Diagrama Red | 9, 10 | Diagrama Red muestra nodos y dependencias del proyecto cuando existen relaciones. | Automatica |
| network-02 | Diagrama Red | 9, 10 | Diagrama Red destaca ruta critica o tareas criticas cuando el calculo CPM las identifica. | Automatica |
| network-03 | Diagrama Red | 9, 10 | Diagrama Red permite interaccion basica con nodos sin errores de layout. | Automatica |
| network-04 | Diagrama Red | 9, 10 | Diagrama Red detecta o degrada ciclos/dependencias invalidas sin pantalla rota. | Automatica |
| network-05 | Diagrama Red | 9, 10 | Diagrama Red cumple cero overflow y queda cubierto con captura y logs. | Automatica |
| resources-01 | Recursos | 9, 10 | Recursos muestra subvistas o secciones disponibles para asignaciones, carga y resumen de recursos. | Automatica |
| resources-02 | Recursos | 9, 10 | Recursos conserva campos importados de MPP cuando el archivo incluye recursos o asignaciones. | Automatica |
| resources-03 | Recursos | 9, 10 | Recursos permite editar o revisar asignaciones sin romper dependencias ni tareas. | Automatica |
| resources-04 | Recursos | 9, 10 | Recursos muestra estado vacio limpio si el proyecto no tiene recursos importados. | Automatica |
| resources-05 | Recursos | 9, 10 | Recursos cumple cero overflow y queda cubierto con evidencia visual y logs. | Automatica |
| lob-01 | Linea Balance | 6, 7, 10, 11 | Linea de Balance deriva patrones, ejes o series desde tareas reales y/o matrixPlan, no desde datos demo invisibles. | Automatica |
| lob-02 | Linea Balance | 6, 7, 10, 11 | Linea de Balance usa clasificacion semiautomatica auditada para familias de actividad: nombre, breadcrumb/WBS, capitulo/ruta, reglas regex, prioridad y confianza. | Automatica |
| lob-03 | Linea Balance | 6, 7, 10, 11 | Linea de Balance registra fuente de clasificacion, matchedBy, nivel de breadcrumb, confianza y motivo de revision cuando la familia no es automatica. | Automatica |
| lob-04 | Linea Balance | 6, 7, 10, 11 | Linea de Balance no aplica una familia solo por palabras ambiguas como Piso, Torre, Staff, Retiro, Ejes o Zona si el WBS/breadcrumb indica otra familia. | Automatica |
| lob-05 | Linea Balance | 6, 7, 10, 11 | Linea de Balance muestra estado limpio cuando no hay patrones suficientes y explica que falta clasificacion o matriz. | Automatica |
| lob-06 | Linea Balance | 6, 7, 10, 11 | Linea de Balance cumple cero overflow y queda cubierta con tests de datos, captura, video y logs. | Automatica |
| matrix-01 | Matriz | 3, 4, 9, 10 | Matriz muestra jerarquia de alcances y ubicaciones del proyecto con expandir/colapsar estable. | Automatica |
| matrix-02 | Matriz | 3, 4, 9, 10 | Matriz permite activar celdas y asignar recetas o actividades sin generar tareas duplicadas incoherentes. | Automatica |
| matrix-03 | Matriz | 3, 4, 9, 10 | Matriz sincroniza cambios hacia Gantt y Gantt conserva paridad con matrixPlan. | Automatica |
| matrix-04 | Matriz | 3, 4, 9, 10 | Matriz persiste celdas, jerarquia, recetas y tareas generadas despues de guardar y recargar. | Automatica |
| matrix-05 | Matriz | 3, 4, 9, 10 | Matriz cumple cero overflow y permite revisar tablas amplias con scroll interno controlado. | Automatica |
| matrix-06 | Matriz | 3, 4, 9, 10 | Matriz queda cubierta con tests de paridad matriz-Gantt y evidencia visual. | Automatica |
| scurve-01 | Curva S | 9, 10 | Curva S calcula curvas a partir de fuentes disponibles del proyecto: avance, duracion, costos o tareas segun corresponda. | Automatica |
| scurve-02 | Curva S | 9, 10 | Curva S muestra granularidad configurable o predeterminada sin romper el grafico. | Automatica |
| scurve-03 | Curva S | 9, 10 | Curva S degrada limpiamente cuando faltan costos o baseline y usa una fuente alternativa explicita. | Automatica |
| scurve-04 | Curva S | 9, 10 | Curva S no produce errores de grafico con proyectos importados ni con proyectos matriciales nuevos. | Automatica |
| scurve-05 | Curva S | 9, 10 | Curva S cumple cero overflow y queda cubierta con captura y logs. | Automatica |
| bottlenecks-01 | Cuellos | 9, 10 | Cuellos identifica tipos de problemas relevantes: tareas sin predecesora, dependencias criticas, holgura negativa, atrasos o señales equivalentes disponibles. | Automatica |
| bottlenecks-02 | Cuellos | 9, 10 | Cuellos asigna severidad clara a cada hallazgo y la muestra visualmente. | Automatica |
| bottlenecks-03 | Cuellos | 9, 10 | Cuellos muestra recomendaciones sin modificar el cronograma automaticamente. | Automatica |
| bottlenecks-04 | Cuellos | 9, 10 | Cuellos muestra estado limpio cuando no hay hallazgos. | Automatica |
| bottlenecks-05 | Cuellos | 9, 10 | Cuellos cumple cero overflow y queda cubierto con captura, video y logs. | Automatica |
| conflicts-01 | Conflictos | 9, 10 | Conflictos detecta problemas de dependencias, fechas o reglas del cronograma y los vincula a tarea/origen. | Automatica |
| conflicts-02 | Conflictos | 9, 10 | Conflictos permite filtrar por tipo, severidad u origen sin perder resultados. | Automatica |
| conflicts-03 | Conflictos | 9, 10 | Conflictos muestra estado limpio cuando no hay conflictos. | Automatica |
| conflicts-04 | Conflictos | 9, 10 | Conflictos no persiste cambios automaticos al cronograma sin confirmacion explicita del usuario. | Automatica |
| conflicts-05 | Conflictos | 9, 10 | Conflictos cumple cero overflow y queda cubierto con evidencia visual y logs. | Automatica |
| typical-unit-01 | Unidad Tipica | 6, 8, 10, 11 | Unidad Tipica detecta patrones repetidos de pisos, torres, etapas o unidades desde WBS/matrixPlan y tareas reales. | Automatica |
| typical-unit-02 | Unidad Tipica | 6, 8, 10, 11 | Unidad Tipica reutiliza el criterio semiautomatico de familias: breadcrumb/WBS/ruta, reglas, confianza y revision cuando la clasificacion sea ambigua. | Automatica |
| typical-unit-03 | Unidad Tipica | 6, 8, 10, 11 | Unidad Tipica muestra resumen visual comparando patrones entre pisos o ubicaciones equivalentes. | Automatica |
| typical-unit-04 | Unidad Tipica | 6, 8, 10, 11 | Unidad Tipica muestra estado limpio cuando no hay patron repetible suficiente. | Automatica |
| typical-unit-05 | Unidad Tipica | 6, 8, 10, 11 | Unidad Tipica cumple cero overflow y queda cubierta con tests, captura, video y logs. | Automatica |
| calendar-01 | Calendario | 9, 10 | Calendario muestra dias laborales, no laborales y festivos segun configuracion del proyecto. | Automatica |
| calendar-02 | Calendario | 9, 10 | Calendario superpone tareas o hitos relevantes en sus fechas correctas. | Automatica |
| calendar-03 | Calendario | 9, 10 | Calendario permite editar configuraciones permitidas sin corromper el cronograma. | Automatica |
| calendar-04 | Calendario | 9, 10 | Calendario respeta datos importados cuando el MPP trae calendario o excepciones reconocibles. | Automatica |
| calendar-05 | Calendario | 9, 10 | Calendario cumple cero overflow y queda cubierto con evidencia visual y logs. | Automatica |
| settings-01 | Configuracion | 9, 10, 12 | Configuracion permite editar ajustes de calendario y parametros del proyecto con validacion visible. | Automatica |
| settings-02 | Configuracion | 9, 10, 12 | Configuracion persiste cambios guardados y los refleja despues de recargar. | Automatica |
| settings-03 | Configuracion | 9, 10, 12 | Configuracion recalcula o solicita recalculo cuando un ajuste afecta fechas del cronograma. | Automatica |
| settings-04 | Configuracion | 9, 10, 12 | Configuracion bloquea valores invalidos sin dejar estado parcial corrupto. | Automatica |
| settings-05 | Configuracion | 9, 10, 12 | Configuracion cumple cero overflow y queda cubierta con captura, video y logs. | Automatica |
| evidence-01 | Evidencia | 1, 10, 11, 12 | El reporte final indica rutas exactas a screenshots, videos, traces, logs JSON y reporte HTML. | Automatica |
| evidence-02 | Evidencia | 1, 10, 11, 12 | La evidencia final incluye una revision manual explicita de las capturas para detectar overflow, pantallas vacias o modulos rotos. | Manual/criterio de cierre |
| evidence-03 | Evidencia | 1, 10, 11, 12 | El cierre solo se acepta si Playwright pasa en Chromium con workers=1 sobre Docker y con trace/video/screenshot habilitados. | Automatica |
| evidence-04 | Evidencia | 1, 10, 11, 12 | La verificacion complementaria incluye tests unitarios/Jest, lint y build cuando el cambio toca codigo compartido. | Automatica |
| scope-01 | Alcance | 1, 10, 12 | No se desplegara a produccion durante este goal. | Manual/criterio de cierre |
| scope-02 | Alcance | 1, 10, 12 | No se borraran proyectos E2E al finalizar. | Automatica |
| scope-03 | Alcance | 1, 10, 12 | No se implementaran mutaciones automaticas por IA sobre el cronograma sin confirmacion explicita del usuario. | Automatica |
| scope-04 | Alcance | 1, 10, 12 | No se hara un rediseño amplio no relacionado; los cambios visuales se limitan a corregir modulo, evidencia y cero overflow. | Manual/criterio de cierre |
| scope-05 | Alcance | 1, 10, 12 | Chromium es el navegador principal de evidencia; Firefox y WebKit quedan fuera salvo nueva instruccion. | Automatica |

## Riesgos y notas

- El archivo MPP vive fuera del repo; si no existe o cambia de nombre, el E2E debe fallar con mensaje explicito.
- La revision audiovisual tiene una parte manual inevitable: Playwright genera evidencia, pero el cierre exige abrir y revisar capturas/videos representativos.
- La clasificacion de familias no debe copiar la base de datos de `lps-aia`; debe implementar el mismo criterio en una capa local testeable, con posibilidad de ampliar reglas despues.
- Los proyectos E2E no se borran al final; cualquier limpieza de BD requeriria instruccion explicita.
- No hay despliegue a produccion ni mutaciones automaticas por IA sobre el cronograma.
