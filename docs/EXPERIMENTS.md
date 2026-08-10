# EXPERIMENTS — visor-gantt (v2)

Cada cambio de UI o copy que se ship debe entrar aquí con una métrica pre-comprometida.
Creado 2026-08-05 en Fase 2 de `improve-app`.

## Experiment Backlog

ICE = Impacto · Confianza · Facilidad (1-10 cada uno; score = promedio). Origen = hallazgo en
[DESIGN.md](DESIGN.md) `## UX Audit Findings`.

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E1 | Alta y baja de tareas pasan por el historial + aviso «N tareas eliminadas · Deshacer» | #2 | 4 | 10 | 10 | 7 | **9,0** | 0 reportes de pérdida de trabajo; `Ctrl+Z` recupera un borrado | **shipped 2026-08-05** |
| E2 | Estado de error propio en la home, distinto del vacío, con reintento | #3 | 4 | 9 | 10 | 8 | **9,0** | Un fallo de DB muestra el estado de error, no «No hay proyectos guardados» | **shipped 2026-08-05** |
| E3 | Resolver `/upload`: sesión exigida antes de aceptar el archivo | #1 | 4 | 10 | 9 | 5 | **8,0** | 0 importaciones que terminan en «No autenticado» tras el parseo | **shipped 2026-08-05** |
| E4 | Progreso en la importación + timeout + cancelar | #4 | 3 | 9 | 8 | 5 | **7,3** | La espera muestra fase y segundos, y se puede cancelar de verdad | **shipped 2026-08-06** — se retiraron las dos fases que `fetch` no puede conocer y se añadió el tiempo transcurrido |
| E5 | Mapear errores del parser a mensajes qué/por qué/cómo; detalle técnico solo a logs | #5, #23 | 3 | 8 | 9 | 7 | **8,0** | 0 stack traces visibles en la UI; los 6 errores del flujo pasan el checklist qué/por qué/cómo | **shipped 2026-08-08** — `humanParserError` traduce lo que devuelve el microservicio; el detalle técnico queda en el registro del servidor |
| E6 | Estados vacíos en tabla y Gantt con acción de salida | #9 | 3 | 8 | 9 | 8 | **8,3** | 0 pantallas en blanco — **verificado en navegador** | **shipped 2026-08-05** |
| E7 | Chip de filtro activo siempre visible y removible («Solo ruta crítica ×») | #10 | 3 | 8 | 8 | 8 | **8,0** | Al aplicar el preset «Dirección», el chip aparece; 0 casos de tareas ocultas sin indicador | **shipped 2026-08-08** — el contador dice cuántas esconde («2 ocultas de 3»), y la tarea filtrada de la que algo visible depende se muestra atenuada |
| E8 | Panel «Ayuda de esta vista» por pantalla | #12 | 3 | 8 | 8 | 6 | **7,3** | Todas las vistas alcanzables (13) tienen ayuda accesible sin `Cmd+K` | **shipped 2026-08-06** |
| E9 | Login: conservar el correo al fallar, validar en el campo, códigos de error en vez de texto en la URL | #6, #8 | 3 | 7 | 9 | 7 | **7,7** | El correo sobrevive a un intento fallido; `/login?error=<texto>` ya no pinta texto arbitrario | **shipped 2026-08-08** — el error viaja como código, no como texto; el correo sobrevive. Verificado en navegador |
| E10 | Salida para usuario bloqueado (recuperación o contacto de admin) y mensajes sin jerga de `.env` | #7 | 3 | 7 | 8 | 6 | **7,0** | Existe una ruta de recuperación desde `/login`; 0 menciones de `.env` en pantallas de usuario | **shipped 2026-08-08** — salida hacia quien administra el proyecto, sin jerga de servidor |
| E11 | Anunciar formato y límite de 50 MB junto al botón de subida | #13 | 3 | 6 | 9 | 9 | **8,0** | Caída de los rechazos por tamaño (medido en logs de `import-mpp`) | **shipped 2026-08-08** — «Archivo de MS Project (.mpp), hasta 50 MB» junto al botón |
| E12 | Feedback de undo («Deshecho: <acción>») | #11 | 3 | 7 | 8 | 7 | **7,3** | El mensaje aparece en cada undo | **shipped 2026-08-06** (falta el aviso al llegar al tope de 50) |
| E13 | Indicador de guardado permanente con hora del último guardado | #20 | 2 | 6 | 8 | 7 | **7,0** | Visible al abrir y con la hora tras guardar | **shipped 2026-08-06** |
| E14 | Agrupar las 14 vistas por intención y renombrar «Cuellos» → «Cuellos de botella»; icono propio | #16 | 2 | 7 | 7 | 6 | **6,7** | Tiempo para encontrar una vista concreta en prueba con 5 usuarios | **shipped 2026-08-08** — menú agrupado en Trabajo · Análisis · Ajustes, con la Matriz de vuelta |
| E15 | Etiquetas de texto en acciones destructivas; deshabilitar undo/redo en vez de desmontarlos | #15 | 2 | 6 | 8 | 8 | **7,3** | 0 controles destructivos solo-icono; la barra no se reordena | **shipped 2026-08-08** — Deshacer/Rehacer dejan de desmontarse; «Eliminar» con etiqueta de texto |
| E16 | Skeleton al abrir un proyecto | #14 | 2 | 5 | 8 | 8 | **7,0** | LCP percibido en `/project/[id]` (se cierra con Fase 8) | **shipped 2026-08-08** — `ScheduleSkeleton` con forma de tabla y gantt, en vez del texto «Cargando» |
| E17 | Borrar los componentes muertos (`MPPUploader`, `ViewSwitcher`) o adoptarlos; una sola lista de vistas | #21 | 2 | 5 | 9 | 8 | **7,3** | 0 componentes de UI sin importador; la lista de vistas vive en un solo archivo | **shipped 2026-08-08** — `MPPUploader` borrado; un test vigila que no vuelva |
| E18 | Retorno al destino original tras login (`?next=`) y aviso de sesión expirada | #18 | 2 | 6 | 8 | 7 | **7,0** | Un enlace directo a `/project/<id>` sin sesión vuelve a ese proyecto tras entrar | **shipped 2026-08-08** — guard en `/project/[id]` con `?motivo=sesion-expirada` y retorno al destino |
| E19 | Alinear etiqueta y semántica de los botones de nivel WBS; un solo tipo de control | #17 | 2 | 5 | 8 | 7 | **6,7** | «L1» aplica nivel 1; el control no cambia de tipo según el proyecto | **shipped 2026-08-08** — «L1» aplica el nivel 1; siempre botones. De paso, un resumen colapsado dentro de otro ya no se muestra |
| E20 | Documentar atajos (`Cmd+K` en el botón) y hoja de atajos | #19 | 2 | 5 | 8 | 8 | **7,0** | Uso de la paleta de comandos por sesión | **shipped 2026-08-08** — `⌘K` visible en el botón; comandos de exportación y configuración añadidos |
| E21 | Normalizar tildes y unificar cadenas duplicadas entre capas | #23 | 1 | 3 | 9 | 9 | **7,0** | 0 cadenas de UI sin tildes | **shipped 2026-08-08** — barrido con test que distingue el copy de los códigos y las palabras clave |
| E22 | «Nuevo Proyecto» como `<Link>`; roles ARIA de la barra de vistas | #24, #25 | 1 | 3 | 9 | 9 | **7,0** | Auditoría de accesibilidad sin errores de rol en esa barra | **shipped 2026-08-08** — «Nuevo proyecto» como `<Link>`; la barra de vistas es `role="tablist"` |

### Añadidos en Fase 9 (steve-jobs-design-review)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E48 | 404 propio: en español, con marca y salida a los cronogramas | F5 / back-of-fence | 2 | 6 | 10 | 9 | **8,3** | 0 páginas de sistema en inglés — **verificado en navegador** | **shipped 2026-08-05** |
| E49 | El vacío de «Unidad Típica» enseña qué es un sistema repetido con ejemplo de obra | F3 | 2 | 7 | 9 | 9 | **8,3** | Los estados vacíos explican el concepto, no solo la condición técnica | **shipped 2026-08-05** |
| E50 | **Cortes C1-C6**: de 14 vistas a 9 | PRODUCT.md cut list | 3 | 9 | 7 | 4 | **6,7** | Nº de vistas en la barra ≤ 9 — **9 verificado en navegador** | **shipped 2026-08-06** |
| E51 | Bajar de 6 pasos a 2 hasta el valor (abrir `.mpp` sin cuenta, modo lectura) | PRODUCT.md F1 | 3 | 10 | 8 | 4 | **7,3** | Pasos desde llegar hasta ver el cronograma ≤ 3 | **descartado 2026-08-08** — descartado en firme por el usuario el 2026-08-06: abrir un `.mpp` sin cuenta no se hace |

### Añadidos en Fase 8 (high-perf-browser)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E46 | Carga diferida de las 17 vistas (`next/dynamic`) en vez de importarlas todas en el bundle inicial | #47 | 3 | 9 | 10 | 8 | **9,0** | INP al cambiar de vista < 200 ms — **584 → 184 ms verificado** | **shipped 2026-08-05** |
| E47 | Medición de campo (RUM) sobre proyectos reales de 300+ tareas | #47-49 | 2 | 8 | 7 | 4 | **6,3** | INP/LCP/CLS reales, no de laboratorio en localhost | **descartado 2026-08-08** — necesita usuarios reales sobre proyectos en obra, no código |

### Añadidos en Fase 6 (made-to-stick)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E45 | Reescritura de 9 superficies: fuera la jerga de infraestructura (`.env`, «Conectado», «heredada», tooltip en inglés) | #7, #22, #40 | 2-3 | 7 | 9 | 9 | **8,3** | 0 menciones de infraestructura o inglés en pantallas de usuario | **shipped 2026-08-05** |

### Añadidos en Fase 5 (microinteractions)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E43 | **Momento firma**: loop de observaciones con badge sobre la barra (`!` pendiente / ✓ atendida) + registro + export CSV/LPS | CUSTOMER.md, DESTILACION §2 | 3 | 10 | 8 | 4 | **7,3** | Nº de observaciones creadas/atendidas por semana | **shipped 2026-08-05** |
| E44 | Micro-confirmación al aplicar una edición válida (flash sutil en la celda/barra afectada) | inventario F5 | 2 | 6 | 8 | 8 | **7,3** | Toda edición aceptada tiene feedback <100 ms sobre el elemento tocado | **shipped 2026-08-08** — destello de 350 ms en la celda al aceptar, con `prefers-reduced-motion` |

### Añadidos en Fase 4 (refactoring-ui)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E39 | Señal no cromática de ruta crítica (trama+borde en barra, ▲ en tabla) | #42 | 3 | 8 | 9 | 7 | **8,0** | La criticidad se distingue en escala de grises — **verificado en navegador** | **shipped 2026-08-05** |
| E40 | Columna Pred. como dato («2FS+4d»), editar solo al interactuar | #43 | 2 | 7 | 8 | 7 | **7,3** | El blur test lo gana el dato, no el botón | **shipped 2026-08-08** — el dato manda; el control aparece al señalar la fila |
| E41 | Encabezados claros (small-caps gris); el oscuro solo en una franja | #44 | 2 | 6 | 8 | 8 | **7,3** | Blur test: los datos pesan más que los encabezados | **descartado 2026-08-08** — el encabezado oscuro es marca deliberada y el grilleo del 2026-08-06 no lo incluyó en el Bloque C. Se reabre solo si una revisión en frío lo señala |
| E42 | Cinta de iconos agrupada con etiquetas de grupo y overflow «⋯» | #45 | 2 | 7 | 8 | 6 | **7,0** | 0 botones sin agrupar; tiempo-a-encontrar en prueba con 5 usuarios | **shipped 2026-08-08** — las etiquetas de grupo estaban escritas pero ocultas por CSS: ahora se ven desde 64rem |
| E38a | ✅ Barra de vistas legible: 10 px, 2 líneas, 4.5 rem | #41/#46 | 2 | — | — | — | — | 0 etiquetas truncadas (verificado en navegador) | **shipped 2026-08-05** |

### Añadidos en Fase 3 (design-everyday-things)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E23 | Mostrar el issue donde ocurre la edición (toast + inline), no solo en la pestaña «Cuellos» | #26 | 4 | 10 | 10 | 7 | **9,0** | 0 ediciones rechazadas sin mensaje | **shipped 2026-08-05** |
| E24 | Llevar al historial recursos, presupuesto, mapeos, plan matricial y columnas | #27 | 4 | 9 | 9 | 5 | **7,7** | Toda acción destructiva es deshacible o confirmada | **shipped 2026-08-06** — cerrado: borrar/editar recurso y partida, import CSV, mapeos, aplicar y sincronizar matriz, y restablecer columnas |
| E25 | Renderizar `calendarIssues` junto al editor de calendario | #28 | 4 | 8 | 10 | 8 | **8,7** | Un calendario inválido muestra el motivo | **shipped 2026-08-05** |
| E26 | Restringir la entrada: `min=1`, `step=1`, validar `finish >= start`, unificar duración mínima | #30 | 3 | 9 | 10 | 9 | **9,3** | Imposible introducir duración negativa o fin anterior al inicio | **shipped 2026-08-05** |
| E27 | Marcar en solo lectura lo que calcula el motor (`finish`, filas resumen) usando el `readOnly` existente | #31 | 3 | 8 | 9 | 8 | **8,3** | 0 celdas derivadas editables | **shipped 2026-08-08** — filas resumen en solo lectura y en gris; el fin pasa a editar la duración |
| E28 | Validar en el campo y explicar el rechazo; no convertir texto en `0` ni borrar dependencias en silencio | #29 | 3 | 9 | 9 | 6 | **8,0** | 0 descartes mudos en los 6 campos editables | **shipped 2026-08-08** — predecesoras mal escritas explican el formato; los campos MPP dejan de convertir en `0` |
| E29 | Handles de resize visibles y pista permanente de conexión de dependencias | #32 | 3 | 8 | 8 | 7 | **7,7** | Usuarios nuevos descubren arrastre y enlace sin ayuda (prueba con 5) | **shipped 2026-08-08** — los tiradores se pintan al pasar por la barra o al seleccionarla |
| E30 | Snapear el fantasma de arrastre y mostrar la fecha destino durante el gesto | #33 | 3 | 8 | 9 | 7 | **8,0** | El preview coincide con el resultado; 0 «saltos» al soltar | **shipped 2026-08-08** — la sombra dice la fecha destino durante el gesto |
| E31 | Resumen de impacto tras editar: resaltar afectadas usando el `changedTaskIds` que ya se calcula | #35 | 3 | 9 | 8 | 6 | **7,7** | El usuario identifica qué se movió sin comparar de memoria | **shipped 2026-08-08** — `lastChange` sale del contexto: recuento y resaltado, más avisos de fin de obra y ruta crítica |
| E32 | Resumen post-importación (N tareas, dependencias, recursos) | #36 | 3 | 8 | 9 | 7 | **8,0** | El usuario ve qué se importó al aterrizar en el proyecto | **shipped 2026-08-06** |
| E33 | Canal de advertencias del parseo (empezando por las columnas descartadas sobre 120) | #37 | 3 | 7 | 9 | 6 | **7,3** | Las pérdidas silenciosas se anuncian; `WarningList` vivo o borrado | **shipped 2026-08-08** — `WarningList` conectado al resumen; solo se listan las que caen por el tope de 120 |
| E34 | Separar lo destructivo de lo frecuente: divisor + etiqueta de texto en toolbar y matriz | #38 | 3 | 8 | 9 | 9 | **8,7** | «Eliminar» nunca es adyacente a «Agregar» sin separación | **shipped 2026-08-08** — separador entre Agregar y Eliminar, con etiqueta de texto en el destructivo |
| E35 | Anunciar el tipo de dependencia durante el arrastre y permitir corregirlo al soltar | #34 | 3 | 7 | 8 | 6 | **7,0** | 0 dependencias creadas con un tipo que el usuario no eligió | **shipped 2026-08-08** — el arrastre anuncia el tipo real; **FF y SF pasan de inalcanzables a creables** |
| E36 | Modo Simple/Avanzado: que haga lo que promete, o eliminarlo | #39 | 2 | 6 | 8 | 7 | **7,0** | El modo cambia algo perceptible además de un desplegable | **shipped 2026-08-08** — Simple esconde las columnas MPP; por defecto solo en la primera visita |
| E37 | Significante visual de celda editable + entrada en edición por teclado (Enter/F2), sin tooltip en inglés | #40 | 2 | 6 | 9 | 8 | **7,7** | La tabla es editable con teclado; 0 textos en inglés en UI española | **shipped 2026-08-08** — señal al pasar por encima y entrada en edición con Enter o F2 |
| E38 | Etiquetas completas en la barra de vistas y encabezados de tabla | #41 | 2 | 6 | 9 | 8 | **7,7** | 0 etiquetas truncadas a 1280 px de ancho | **shipped 2026-08-08** — barra hecha (E38a); los encabezados eran **truncamiento CSS** (`ellipsis`) más un mapa parcial de 8 abreviaturas que se activaba por ancho de panel, no por columna. R2 lo cierra: cada columna declara su forma corta y se elige por su propio ancho |

**Orden recomendado de ejecución:** ~~E1, E2, E3~~ → ~~E23, E25, E26~~ (hechos) →
E5, E6, E7, E11, E34 (alto ICE, baratos) → E24, E27, E28, E30, E32 → el resto.

## Experiment Cards

### P2 · Cerrar el backlog de UX — shipped 2026-08-08

**Hipótesis:** el problema dominante no era lo que faltaba, sino lo construido que nadie podía alcanzar y los
controles que no hacían lo que decía su nombre. Cerrar los 27 pendientes en cuatro entregas desplegables.

**Qué cambió, por entrega:**
- **A · La entrada.** El error del login viaja como código —`?error=credenciales`— y ya no como texto
  falsificable; el correo sobrevive al intento fallido; guard en `/project/[id]` con motivo y retorno;
  límite de 50 MB anunciado antes de elegir archivo; errores del analizador traducidos con el detalle
  técnico solo en el registro; `WarningList` conectado al resumen de importación.
- **B · Tabla y Gantt.** Filas resumen en solo lectura; **editar el fin cambia la duración** (el motor lo
  soportó limpiamente: no hizo falta la salida degradada); nada se descarta en silencio; celda editable
  reconocible y abrible con Enter o F2; tiradores visibles y fecha destino durante el arrastre; recuento y
  resaltado de lo que se movió, más avisos de fin de obra y ruta crítica; modo Simple que esconde de verdad.
- **C · Pulido.** Menú agrupado con la Matriz de vuelta; paleta tolerante a erratas con `⌘K` visible; barra
  que no se reordena; chip de filtro que dice cuántas esconde; «L1» que aplica el nivel 1; esqueleto de
  carga; barrido de tildes vigilado por un test.
- **D · Lo inalcanzable.** CSV real con las observaciones dentro; **la API de Last Planner tiene por fin
  quien la llame**, con vista propia; Observaciones con vista de proyecto y responsable opcional; la matriz
  avisa antes de perder el borrador; el tablero ejecutivo dice «aún no hay datos» en vez de verde, muestra la
  fecha de corte y lleva a su detalle; alta y baja de asignaciones con aviso de sobrecarga.

**Cuatro defectos encontrados leyendo o verificando, no diseñando:**
1. **FF y SF eran inalcanzables**: `onDepEnd` se llamaba siempre con `"left"`, así que el gesto solo podía
   crear FS y SS. Ahora los puntos del destino cierran el vínculo con su propio borde.
2. **Un resumen colapsado dentro de otro colapsado seguía mostrándose**: en `getVisibleTasks`, la rama de
   «es un resumen cerrado» iba antes que la de «está dentro de algo cerrado».
3. **Las etiquetas de grupo de la cinta estaban escritas pero ocultas por CSS** desde siempre.
4. **La primera versión de «columnas descartadas» mentía**: listaba campos que sí se importan (nombre,
   inicio, fin). Solo son descartadas las que caen por el tope de 120.

**Dos cambios de comportamiento visibles, dichos aquí para que no sorprendan:**
- **Uso de Recursos marca más celdas sobreasignadas que antes.** Al unificar la definición gana el umbral
  diario, el que ya usaba Problemas y tiene tests. Es más estricto, y es el resultado correcto: dos pestañas
  que se contradicen es peor que una que avisa de más.
- **Un `/login?error=<texto>` guardado en un marcador deja de pintar nada.** Es el punto del arreglo.

**Verificado contra `main` en `f62e050`** (P3, el motor de detección del carril B, ya fusionado): la rama
se puso al día con `git merge main` antes de entregar. `TypicalUnitView.tsx` es el único archivo de
producción que tocaron los dos carriles y git lo unió sin conflicto de texto, que es el caso peligroso: se
revisó a mano y el resultado es coherente —su etiqueta de nivel ya formateada («Piso 01», «Sótano 1») con
nuestro renombrado a «Ritmo (1/día)»—. Comprobado también en navegador.

**Evidencia:** 1.105 tests unitarios en verde (710 de partida; 941 del carril A más los del motor de
detección), **50 E2E en Chromium** (1 saltado por diseño:
el de producción exige `PRODUCTION_SSH_HOST`), `eslint` sin errores, `tsc --noEmit` filtrado vacío,
`next build` correcto. **Verificado en navegador** con base de datos y microservicio reales: menú agrupado,
Compromiso semanal llamando a la API, Observaciones, tablero con fecha de corte y señales que navegan a
Problemas, y el login conservando el correo con el error bajo el campo.

**Decisiones tomadas sobre la marcha, que no estaban en las 103 del grilleo:**

| Decisión | Por qué | ¿Reversible? |
|---|---|---|
| **Gana el umbral diario** al unificar «sobreasignado» (el grilleo decidió unificar, no cuál) | Es el que ya alimenta Problemas y tiene tests, y en obra el problema es el día concreto en que faltan manos, no el promedio de la semana. **Consecuencia visible: Uso de Recursos marca más celdas en rojo que antes** | Sí: es una llamada a `detectOverallocation` |
| **Los cuatro tipos de vínculo pasan a ser alcanzables** (FF y SF no se podían crear) | El gesto prometía elegir borde y siempre cerraba igual; anunciar el tipo durante el arrastre presupone que hay tipos que elegir | Sí |
| **TSV para copiar, CSV para descargar** | El tabulador gana en el portapapeles (se pega sin diálogo) y el `;` gana en el archivo (doble clic abre bien en configuración regional colombiana) | Sí |
| **Sin tope de líneas base** | Con nombre al guardar y opción de borrar, la gestión ya está cubierta | Sí |
| **`devIndicators: false`** en `next.config.ts` | El distintivo de desarrollo se sitúa donde termina el menú y bloqueaba el clic en «Configuración» en los E2E. Es chrome de desarrollo, no del producto | Sí |
| **El menú queda en 11 entradas** | Decisión del usuario del 2026-08-08: el compromiso semanal vive **dentro** de Observaciones, porque una restricción de Last Planner es una observación con responsable y fecha. Verificado contando en navegador | Sí |

**Sobre el test inestable:** `HomeMppUploadAction › rejects oversized files inline` fallaba 2 de cada 3
corridas **en paralelo** (nunca en `--runInBand` ni en aislamiento). Es el conocido, no uno nuevo:
materializaba 50 MB reales en memoria y agotaba el timeout de 5 s bajo carga. El componente solo lee
`file.size`, así que el tamaño se declara. Cuatro corridas en paralelo seguidas, 941 en verde.

**Anotado, no hecho:** M10 (corregir clasificaciones ambiguas de la Línea de Balance) y la productividad real
de Unidad Típica dependen del carril B (motor de detección y cantidades de la matriz). La Tarea 27 hace solo
el renombrado a «Ritmo (1/día)», que es lo que decidió el grilleo.


### P1 · No perder trabajo — shipped 2026-08-07

**Hipótesis:** los dos bugs de pérdida de datos del inventario (M24 observaciones, M13 líneas base) no son
pulido: son la razón por la que alguien deja de confiar en la app. Cerrarlos antes que nada.

**Qué cambió:**
- **M24 · Observaciones al instante.** Efecto propio, separado del temporizado: anotar, atender o borrar
  cancela el temporizador y guarda ya. Antes `observations` no estaba en las dependencias del efecto
  (`GanttView.tsx:1202-1216`) y solo persistía si otra cosa disparaba el guardado.
- **M13 · Un solo sistema de líneas base.** `TrackingGanttView` deja de tener `useState` propio y pasa a
  componente controlado. `GanttChart` gana `showBaseline` y dibuja la barra fantasma, así que la comparación
  se ve donde se pulsa el botón. Nuevo `BaselineMenu`: nombre al guardar, y borrar deshacible con `Ctrl+Z`.
- **M33 · Aviso al cerrar** solo si hay algo pendiente, decidido por `shouldWarnBeforeUnload`.
- **«Reintentar»** pasa de ser parte del texto del indicador a un botón de verdad.

**Dos defectos encontrados durante la verificación en navegador, no en el diseño:**
1. **El grupo de línea base estaba en `display: none`** sin ninguna regla que lo reactivara: el control que el
   inventario llamó «el más visible» no se veía en ninguna anchura. Ahora aparece desde 64rem.
2. **Un guardado fallido dejaba `isDirtyRef` limpio**, así que el aviso al cerrar dejaba pasar trabajo que se
   iba a perder. Corregido con un test que reproduce el caso a los 4 s, cuando el indicador ya volvió a su
   estado normal.

**Evidencia:** 743 tests en verde (710 de partida, 33 nuevos), `eslint` limpio,
`tsc --noEmit` filtrado vacío, `next build` correcto. **Verificado en navegador** (`/gantt-demo`): anotar una
observación dispara el guardado a los **60 ms** —no a los 750— y pinta el badge; guardar «Antes de la lluvia»
dibuja **8 barras fantasma** en el Gantt principal; borrarla las quita y `Ctrl+Z` las devuelve; cerrar sin
cambios no pregunta y con trabajo pendiente sí.

**Pendiente anotado:** no se impone tope de líneas base (MS Project permite 11). Se decide si el uso lo pide.


### E43 · Momento firma: el estado de la obra, encima del plan — shipped 2026-08-05

**Hipótesis:** lo que hacía volver a diario al visor 1.0 no era una vista, era el loop de anotar sobre la
barra y despachar pendientes. Traerlo convierte el cronograma en el tablero de seguimiento de la obra.

**Qué se construyó** (feature completa, no pulido visual):
- Modelo puro en `src/lib/observations/observations.ts`: crear (rechaza texto vacío), alternar
  Pendiente/Atendida, estado del badge y export a CSV y **CSV Last Planner**. 12 tests.
- `ObservationBadge`: círculo ámbar `!` mientras quede algo pendiente, verde ✓ cuando todo está atendido,
  anclado al extremo de la barra en el Gantt y en Seguimiento. **Una sola pendiente manda** sobre el resto.
- `ObservationPanel`: anotar sin salir del cronograma, lista con estado, borrar (deshacible), y export
  CSV/LPS junto a la lista — el registro existe para compartirse.
- Botón **«Observaciones»** en la toolbar **con etiqueta de texto** y contador de pendientes (de paso,
  rompe la racha de botones solo-icono del grupo).
- Persistencia: `observations` viaja en `ProjectData` y en el autosave, igual que `planningAuditEvents`.

**Evidencia — loop completo verificado en navegador:** seleccionar tarea → anotar «Falta acero de refuerzo
en el eje 3» → aparece badge `pending` sobre la barra y contador «1» en la toolbar → marcar Atendida →
el badge pasa a `done` (✓ verde) y el contador desaparece. 649 tests en verde (16 nuevos), lint limpio,
`next build` correcto.

**Pendiente:** el click directo sobre la barra aún no abre el panel (hoy se abre desde la toolbar con la
tarea seleccionada); y la vista «Observaciones» como pestaña central del proyecto no existe todavía.

### E24 · Lo destructivo que vivía fuera del historial ya se puede deshacer — shipped 2026-08-05

**Hipótesis:** el arreglo de E1 solo cubrió las tareas; borrar un recurso o una partida seguía siendo
irreversible. Una primitiva genérica evita tener que mudar todo el estado al contexto.

**Qué cambió:** nueva primitiva `runUndoable({description, execute, undo})` en `ProjectContext`, que registra
en el **mismo historial** que las tareas cualquier acción cuyo estado viva fuera. Ahora son deshacibles y
anuncian «Deshacer»: borrar recurso, borrar partida de presupuesto (con sus vínculos), importar CSV de
presupuesto, quitar un vínculo presupuesto↔tarea y **aplicar el plan matricial**.

**Bug encontrado en la propia implementación y corregido antes de cerrar:** la primera versión revertía
restaurando un *snapshot* completo de la lista. Eso rompe el flujo «borro uno, agrego otro, deshago»: al
deshacer, la foto vieja **borraba en silencio lo recién agregado**, porque agregar y editar no pasan por el
historial. Se reescribió con operaciones inversas quirúrgicas (`insertAt`/`removeWhere` en
`src/lib/state/undoableCollections.ts`), que respetan los cambios intermedios. Hay un test que reproduce
exactamente ese escenario.

**Evidencia:** 630 tests (5 nuevos de los helpers + 2 de la primitiva), lint limpio, `next build` correcto.

**Cobertura declarada — corregida el 2026-08-08.** El párrafo original quedó congelado el 2026-08-05 y
declaraba cinco casos sin cubrir; **cuatro ya estaban resueltos** vía `runUndoable` cuando se escribió, y se
ha comprobado en el código antes de corregirlo: editar recurso y editar partida (`GanttView.tsx:748`, `:785`),
`handleSyncMatrixFromGantt` (`:1069`) y el reset de columnas en las tres tablas (`:1082`, `:1096`, `:1151`).

Queda **un** caso realmente abierto: los borrados de `MatrixEditorView`, que piden confirmación y no eran
deshacibles — **cerrado por R1**, que le da al borrador su propia pila.
Y el borrado de proyecto (permanente en servidor), que es **irreversible por diseño** y no cuenta como deuda.

### E23 + E25 + E26 · El usuario ya sabe por qué no se aplicó su cambio — shipped 2026-08-05

**Hipótesis:** el rechazo mudo era el peor resultado posible — el usuario no distinguía «lo hice mal» de
«la app está rota». Dar un motivo en la misma pantalla convierte un misterio en una corrección.

**Qué cambió:**
- Nuevo `src/lib/gantt/editValidation.ts`: funciones puras que devuelven `{ok:false, reason}` con el motivo
  en lenguaje de usuario. Unifica la duración mínima en **un solo sitio** (`MIN_TASK_DURATION = 1`), que
  antes valía 0 en la tabla y 1 en el redimensionado.
- El contexto publica `lastRejection` y `reportInvalidEdit`; los tres `return` mudos (`setTasks`,
  `commitTaskChange`, `updateCalendar`) ahora explican el rechazo.
- Nuevo `RejectionToast` (`role="alert"`) montado en el Gantt, y los `calendarIssues` se renderizan por fin
  junto al editor de calendario — no tenían **ningún** consumidor en toda la app.
- Duración, inicio, fin y avance validan de verdad: `min=1 step=1`, y el fin ya no puede ser anterior al inicio.

**Evidencia:** 623 tests (22 nuevos), lint limpio, `next build` correcto, y **verificado en el navegador**:
repetir la prueba que antes fallaba en silencio (duración −10) ahora muestra «El cambio no se aplicó — La
duración mínima es 1 día. Marca la tarea como hito si dura cero.»

**Hallazgo de paso:** `parseDateInput` con `new Date("2026-03-10")` leía la fecha como UTC y en Colombia
(GMT-5) caía en el día anterior; se corrigió usando `createProjectDate`. También quedó documentado que
`normalizeProjectCalendar` rellena en silencio un `workDays` vacío con los días por defecto.

**Pendiente:** el resto de campos MPP sigue usando el parseo antiguo que convierte texto en `0` (E28).

### E1 · Alta y baja de tareas deshacibles — shipped 2026-08-05

**Hipótesis:** borrar sin red de seguridad es la causa de pérdida de trabajo silenciosa; enrutar la acción
por el historial y anunciarla con «Deshacer» la elimina sin añadir una confirmación que nadie lee.

**Qué cambió:** `addTask` y `deleteTasks` viven ahora en `ProjectContext` y pasan por `commitTaskChange`
(historial), retirando de paso las dependencias que apuntaban a una tarea borrada para no dejar enlaces
colgantes. `GanttView` los consume en lugar de `setTasks`. Nuevo `UndoToast` (`role="status"`,
`aria-live="polite"`) anuncia la acción y ofrece deshacer durante 8 s.

**Evidencia:** 9 tests nuevos (4 en `ProjectContext.test.tsx`, 5 en `UndoToast.test.tsx`); suite completa
601/601 en verde, lint limpio y `next build` correcto.

**Pendiente de medir:** confirmación en uso real de que no vuelven reportes de pérdida de trabajo.

### E2 · Error de carga distinto del estado vacío — shipped 2026-08-05

**Hipótesis:** mostrar «No hay proyectos guardados» ante un fallo de datos hace creer al usuario que perdió
su trabajo; separar los dos estados elimina el susto y da una salida.

**Qué cambió:** `src/app/page.tsx` distingue `loadFailed` del vacío real. El error muestra «No pudimos
cargar tus cronogramas», aclara que los proyectos siguen guardados y ofrece «Reintentar». El estado vacío
se reescribió a «Todavía no tienes cronogramas».

**Límite conocido:** si el usuario carece del permiso `project:read`, `listProjects` sigue devolviendo `[]`
en silencio y se ve el estado vacío. Queda como hallazgo abierto (#3 en DESIGN.md).

### E3 · La importación exige sesión antes de aceptar el archivo — shipped 2026-08-05

**Hipótesis:** hacer esperar toda la subida y el parseo para devolver «No autenticado» es la peor variante
posible; comprobar la sesión primero convierte un error tardío e incomprensible en un desvío inmediato.

**Qué cambió:** nuevo `src/app/upload/layout.tsx` con guard que redirige a `/login?next=/upload`.
`POST /api/import-mpp` comprueba la sesión **antes de leer el cuerpo** y responde 401 con
`loginUrl`; el cliente redirige en vez de pintar el error. El login respeta `?next=` mediante
`safeNextPath`, que rechaza destinos externos para no convertirlo en un redirector abierto.

**Decisión de producto pendiente:** se eligió *exigir sesión* en lugar de construir un modo demo real sin
cuenta. El modo demo —que es lo que hace fuerte al visor 1.0— queda como decisión para la Fase 9.

**Evidencia:** test de ruta que verifica 401 sin llamar al parser ni guardar, y 3 tests de `safeNextPath`.

## Pendientes que esperan un dato (R6)

No están bloqueados por falta de trabajo, sino por falta de un dato que hoy no existe. Subirlos como tareas
normales produciría trabajo imposible el primer día. Tienen dueño: el dato que les falta.

| Pendiente | Qué falta | Qué ya se hizo | Disparador |
|---|---|---|---|
| Ritmo, no productividad (P3+P4) | Cantidad de obra ejecutada por actividad | El indicador se llama **Ritmo (1/día)** en toda la interfaz, y un test prohíbe el nombre anterior en todo `v2/src` (`copyProductividad.test.ts`) | Que la matriz aporte cantidades de obra ejecutada, no solo previstas |
| Abscisas `K12+340` (P3b) | Un `.mpp` real de túnel o de vía | El caso de prueba está escrito y desactivado en `location.test.ts`, con los dos escenarios: punto y tramo | Llega un `.mpp` de túnel o vía: se sustituyen los nombres por los reales, se quita el `.skip` y se implementa hasta que pase |
| RUM en obra (E47) | Usuarios reales usando la app en campo | Nada de código, a propósito: es una **medición pendiente**, no deuda técnica | Que haya obra usando el visor a diario con red de campo |
| Presupuesto desde PDC | Es integración entre dos aplicaciones, no una función del visor | **Fuera de alcance del goal maestro.** El punto de entrada es la carga manual de partidas, que se deja funcionando y sin pulir | Que exista una decisión de producto sobre integrar PDC y el visor |

## Decisiones diferidas (R7)

Cuatro decisiones tomadas con motivo, no trabajo sin hacer. Se resuelven **cuando aparezca el caso que las
obliga**, y hasta entonces se quedan escritas aquí para que ninguna auditoría futura las cuente como deuda.

- **Cómo dibujar un tramo en la Línea de Balance.** Hoy cada unidad es una fila y un tramo ocupa varias. El
  motor ya tiene el dato tras R5 (`LocationMatch.span`); la vista decidirá cuando se aborde la Línea de
  Balance de obra lineal. *Caso que la obliga:* un cronograma de obra lineal con tramos en la Línea de Balance.
- **El orden entre familias de eje** (letras, números, series como `DB`). Se resolvió por familia y luego por
  índice — «lo único defendible» sin conocer la geometría real del proyecto. Queda como **supuesto declarado,
  no verificado**. *Caso que la obliga:* un plano de ejes real que contradiga el orden supuesto.
- **Deshacer granular más allá de R1.** R1 cubre las operaciones del borrador del editor. El deshacer paso a
  paso dentro de la matriz **ya construida y persistida** sigue siendo proyecto propio. *Caso que la obliga:*
  que alguien pierda trabajo en la matriz aplicada, no en el borrador.
- **«Fin cambia la duración».** Si el motor no lo soporta limpiamente, el campo queda en **solo lectura** y se
  informa. Es un límite aceptado con salida honesta, no una implementación a medias. *Caso que la obliga:* que
  el motor de cálculo pase a soportar el modo de tarea que lo hace posible.
