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
| E4 | Progreso por fases en la importación (subiendo → analizando → guardando) + timeout + cancelar | #4 | 3 | 9 | 8 | 5 | **7,3** | % de importaciones abandonadas durante la espera; tiempo percibido en prueba con 5 usuarios | backlog |
| E5 | Mapear errores del parser a mensajes qué/por qué/cómo; detalle técnico solo a logs | #5, #23 | 3 | 8 | 9 | 7 | **8,0** | 0 stack traces visibles en la UI; los 6 errores del flujo pasan el checklist qué/por qué/cómo | backlog |
| E6 | Estados vacíos en tabla y Gantt con acción de salida | #9 | 3 | 8 | 9 | 8 | **8,3** | 0 pantallas en blanco: proyecto vacío y filtro sin resultados muestran mensaje + acción | backlog |
| E7 | Chip de filtro activo siempre visible y removible («Solo ruta crítica ×») | #10 | 3 | 8 | 8 | 8 | **8,0** | Al aplicar el preset «Dirección», el chip aparece; 0 casos de tareas ocultas sin indicador | backlog |
| E8 | Panel «Ayuda de esta vista» por pantalla, reutilizando los `hint` ya escritos | #12 | 3 | 8 | 8 | 6 | **7,3** | Las 14 vistas tienen texto de ayuda accesible sin `Cmd+K` ni hover | backlog |
| E9 | Login: conservar el correo al fallar, validar en el campo, códigos de error en vez de texto en la URL | #6, #8 | 3 | 7 | 9 | 7 | **7,7** | El correo sobrevive a un intento fallido; `/login?error=<texto>` ya no pinta texto arbitrario | backlog |
| E10 | Salida para usuario bloqueado (recuperación o contacto de admin) y mensajes sin jerga de `.env` | #7 | 3 | 7 | 8 | 6 | **7,0** | Existe una ruta de recuperación desde `/login`; 0 menciones de `.env` en pantallas de usuario | backlog |
| E11 | Anunciar formato y límite de 50 MB junto al botón de subida | #13 | 3 | 6 | 9 | 9 | **8,0** | Caída de los rechazos por tamaño (medido en logs de `import-mpp`) | backlog |
| E12 | Feedback de undo («Deshecho: <acción>») y aviso al llegar al tope de 50 | #11 | 3 | 7 | 8 | 7 | **7,3** | Existe región `aria-live`; el mensaje aparece en cada undo (test E2E) | backlog |
| E13 | Indicador de guardado permanente con hora del último guardado y reintento en error | #20 | 2 | 6 | 8 | 7 | **7,0** | El indicador es visible al abrir un proyecto, no solo al guardar | backlog |
| E14 | Agrupar las 14 vistas por intención y renombrar «Cuellos» → «Cuellos de botella»; icono propio | #16 | 2 | 7 | 7 | 6 | **6,7** | Tiempo para encontrar una vista concreta en prueba con 5 usuarios | backlog |
| E15 | Etiquetas de texto en acciones destructivas; deshabilitar undo/redo en vez de desmontarlos | #15 | 2 | 6 | 8 | 8 | **7,3** | 0 controles destructivos solo-icono; la barra no se reordena | backlog |
| E16 | Skeleton al abrir un proyecto | #14 | 2 | 5 | 8 | 8 | **7,0** | LCP percibido en `/project/[id]` (se cierra con Fase 8) | backlog |
| E17 | Borrar los componentes muertos (`MPPUploader`, `ViewSwitcher`) o adoptarlos; una sola lista de vistas | #21 | 2 | 5 | 9 | 8 | **7,3** | 0 componentes de UI sin importador; la lista de vistas vive en un solo archivo | backlog |
| E18 | Retorno al destino original tras login (`?next=`) y aviso de sesión expirada | #18 | 2 | 6 | 8 | 7 | **7,0** | Un enlace directo a `/project/<id>` sin sesión vuelve a ese proyecto tras entrar | backlog |
| E19 | Alinear etiqueta y semántica de los botones de nivel WBS; un solo tipo de control | #17 | 2 | 5 | 8 | 7 | **6,7** | «L1» aplica nivel 1; el control no cambia de tipo según el proyecto | backlog |
| E20 | Documentar atajos (`Cmd+K` en el botón) y hoja de atajos | #19 | 2 | 5 | 8 | 8 | **7,0** | Uso de la paleta de comandos por sesión | backlog |
| E21 | Normalizar tildes y unificar cadenas duplicadas entre capas | #23 | 1 | 3 | 9 | 9 | **7,0** | 0 cadenas de UI sin tildes | backlog |
| E22 | «Nuevo Proyecto» como `<Link>`; roles ARIA de la barra de vistas | #24, #25 | 1 | 3 | 9 | 9 | **7,0** | Auditoría de accesibilidad sin errores de rol en esa barra | backlog |

### Añadidos en Fase 5 (microinteractions)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E43 | **Momento firma**: loop de observaciones con badge sobre la barra (`!` pendiente / ✓ atendida) + registro + export CSV/LPS | CUSTOMER.md, DESTILACION §2 | 3 | 10 | 8 | 4 | **7,3** | Nº de observaciones creadas/atendidas por semana | **shipped 2026-08-05** |
| E44 | Micro-confirmación al aplicar una edición válida (flash sutil en la celda/barra afectada) | inventario F5 | 2 | 6 | 8 | 8 | **7,3** | Toda edición aceptada tiene feedback <100 ms sobre el elemento tocado | backlog |

### Añadidos en Fase 4 (refactoring-ui)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E39 | Señal no cromática de ruta crítica (trama+borde en barra, ▲ en tabla) | #42 | 3 | 8 | 9 | 7 | **8,0** | La criticidad se distingue en escala de grises — **verificado en navegador** | **shipped 2026-08-05** |
| E40 | Columna Pred. como dato («2FS+4d»), editar solo al interactuar | #43 | 2 | 7 | 8 | 7 | **7,3** | El blur test lo gana el dato, no el botón | backlog |
| E41 | Encabezados claros (small-caps gris); el oscuro solo en una franja | #44 | 2 | 6 | 8 | 8 | **7,3** | Blur test: los datos pesan más que los encabezados | backlog |
| E42 | Cinta de iconos agrupada con etiquetas de grupo y overflow «⋯» | #45 | 2 | 7 | 8 | 6 | **7,0** | 0 botones sin agrupar; tiempo-a-encontrar en prueba con 5 usuarios | backlog |
| E38a | ✅ Barra de vistas legible: 10 px, 2 líneas, 4.5 rem | #41/#46 | 2 | — | — | — | — | 0 etiquetas truncadas (verificado en navegador) | **shipped 2026-08-05** |

### Añadidos en Fase 3 (design-everyday-things)

| # | Cambio | Origen | Sev | I | C | E | ICE | Métrica pre-comprometida | Estado |
|---|---|---|---|---|---|---|---|---|---|
| E23 | Mostrar el issue donde ocurre la edición (toast + inline), no solo en la pestaña «Cuellos» | #26 | 4 | 10 | 10 | 7 | **9,0** | 0 ediciones rechazadas sin mensaje | **shipped 2026-08-05** |
| E24 | Llevar al historial (o al aviso «Deshacer») recursos, presupuesto, mapeos y plan matricial | #27 | 4 | 9 | 9 | 5 | **7,7** | Toda acción destructiva es deshacible o confirmada | **shipped 2026-08-05** (parcial: quedan sobrescrituras, ver ficha) |
| E25 | Renderizar `calendarIssues` junto al editor de calendario | #28 | 4 | 8 | 10 | 8 | **8,7** | Un calendario inválido muestra el motivo | **shipped 2026-08-05** |
| E26 | Restringir la entrada: `min=1`, `step=1`, validar `finish >= start`, unificar duración mínima | #30 | 3 | 9 | 10 | 9 | **9,3** | Imposible introducir duración negativa o fin anterior al inicio | **shipped 2026-08-05** |
| E27 | Marcar en solo lectura lo que calcula el motor (`finish`, filas resumen) usando el `readOnly` existente | #31 | 3 | 8 | 9 | 8 | **8,3** | 0 celdas derivadas editables | backlog |
| E28 | Validar en el campo y explicar el rechazo; no convertir texto en `0` ni borrar dependencias en silencio | #29 | 3 | 9 | 9 | 6 | **8,0** | 0 descartes mudos en los 6 campos editables | backlog |
| E29 | Handles de resize visibles y pista permanente de conexión de dependencias | #32 | 3 | 8 | 8 | 7 | **7,7** | Usuarios nuevos descubren arrastre y enlace sin ayuda (prueba con 5) | backlog |
| E30 | Snapear el fantasma de arrastre y mostrar la fecha destino durante el gesto | #33 | 3 | 8 | 9 | 7 | **8,0** | El preview coincide con el resultado; 0 «saltos» al soltar | backlog |
| E31 | Resumen de impacto tras editar: resaltar afectadas usando el `changedTaskIds` que ya se calcula | #35 | 3 | 9 | 8 | 6 | **7,7** | El usuario identifica qué se movió sin comparar de memoria | backlog |
| E32 | Resumen post-importación (N tareas, dependencias, recursos) y aviso de lo que hace (proyecto nuevo, festivos, matriz) | #36 | 3 | 8 | 9 | 7 | **8,0** | 0 importaciones que terminan sin decir qué se importó | backlog |
| E33 | Canal de advertencias del parseo (empezando por las columnas descartadas sobre 120) | #37 | 3 | 7 | 9 | 6 | **7,3** | Las pérdidas silenciosas se anuncian; `WarningList` vivo o borrado | backlog |
| E34 | Separar lo destructivo de lo frecuente: divisor + etiqueta de texto en toolbar y matriz | #38 | 3 | 8 | 9 | 9 | **8,7** | «Eliminar» nunca es adyacente a «Agregar» sin separación | backlog |
| E35 | Anunciar el tipo de dependencia durante el arrastre y permitir corregirlo al soltar | #34 | 3 | 7 | 8 | 6 | **7,0** | 0 dependencias creadas con un tipo que el usuario no eligió | backlog |
| E36 | Modo Simple/Avanzado: que haga lo que promete, o eliminarlo | #39 | 2 | 6 | 8 | 7 | **7,0** | El modo cambia algo perceptible además de un desplegable | backlog |
| E37 | Significante visual de celda editable + entrada en edición por teclado (Enter/F2), sin tooltip en inglés | #40 | 2 | 6 | 9 | 8 | **7,7** | La tabla es editable con teclado; 0 textos en inglés en UI española | backlog |
| E38 | Etiquetas completas en la barra de vistas y encabezados de tabla | #41 | 2 | 6 | 9 | 8 | **7,7** | 0 etiquetas truncadas a 1280 px de ancho | **parcial** — barra hecha (E38a); encabezados comprimidos de la tabla siguen open (tienen sistema responsivo propio con abreviaturas) |

**Orden recomendado de ejecución:** ~~E1, E2, E3~~ → ~~E23, E25, E26~~ (hechos) →
E5, E6, E7, E11, E34 (alto ICE, baratos) → E24, E27, E28, E30, E32 → el resto.

## Experiment Cards

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

**Cobertura declarada — lo que NO cubre (queda abierto):** editar un recurso o una partida (sobrescriben sin
copia de seguridad), `handleSyncMatrixFromGantt`, el reset de columnas en las tres tablas, los borrados de
`MatrixEditorView` (piden confirmación pero no son deshacibles) y el borrado de proyecto (permanente en
servidor). Por eso el hallazgo #27 queda como **parcial**, no resuelto.

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
