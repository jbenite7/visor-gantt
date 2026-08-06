# DESIGN — visor-gantt (v2)

Documento vivo del journey `improve-app`. Creado 2026-08-05 en Fase 2 (ux-heuristics).

## UX Audit Findings

Evaluación heurística Nielsen sobre `v2/`, 2026-08-05. Método: auditoría de código con cita `archivo:línea`
(el stack Docker no terminó de construir a tiempo; la **verificación visual en navegador queda pendiente** y
se hará al abrir la Fase 4). Severidad 0-4, ordenada por severidad × frecuencia. Job de referencia:
[CUSTOMER.md](CUSTOMER.md). Flujos auditados: **A = Big Hire** (entrada/importación), **B = Little Hire**
(navegación y uso diario).

| # | Flujo | Issue | Heurística | Sev | Fix | Estado |
|---|---|---|---|---|---|---|
| 1 | A | ✅ **Resuelto (E3)** — `/upload` no tenía guard de sesión, pero `POST /api/import-mpp` sí exige permisos: un anónimo sube el .mpp, espera todo el parseo y recibe **«No autenticado»** como HTTP 500, sin enlace al login (`src/app/upload/page.tsx:1`, `src/app/api/import-mpp/route.ts:27,73-78`, `src/app/actions/project.ts:265-270`) | 1 Visibilidad · 9 Errores | **4** | Decidir: o `/upload` funciona de verdad sin cuenta (modo demo de solo lectura), o exige sesión **antes** de aceptar el archivo | **done** — guard en layout + 401 previo al parseo |
| 2 | B | ✅ **Resuelto (E1)** — borrar tarea era **irreversible y sin confirmación**: `handleDeleteTask` usa `setTasks`, que no pasa por `history.push`, así que Ctrl+Z no lo recupera; borra todas las seleccionadas al instante (`src/components/views/GanttView.tsx:522-527`, `src/lib/state/ProjectContext.tsx:252-269`) | 3 Control y libertad · 5 Prevención | **4** | Enrutar alta/baja de tareas por el historial y ofrecer undo con aviso («3 tareas eliminadas · Deshacer») en vez de confirmación | **done** — `addTask`/`deleteTasks` por historial + `UndoToast` |
| 3 | A | ⚠️ **Parcial (E2)** — un fallo de base de datos mostraba **el mismo estado vacío** que un usuario nuevo: «No hay proyectos guardados». El error solo va a `console.error`; la única pista es un chip «Error/Desconectado» (`src/app/page.tsx:32-35,98`). Idéntico si falta el permiso `project:read` (`actions/project.ts:567-568`) | 1 Visibilidad · 9 Errores | **4** | Estado de error propio y distinto del vacío, con causa y acción («No pudimos cargar tus proyectos. Reintentar») | **parcial** — hecho para fallo de DB; el caso «sin permiso `project:read`» sigue mostrando el vacío |
| 4 | A | Importación **sin progreso, sin timeout y sin cancelar**: el único feedback es el botón cambiando a «Importando…». Si el parser cuelga, la espera es infinita (`HomeMppUploadAction.tsx:46-49,87,92`; sin `AbortController` en `import-mpp/route.ts:53`, `mpp-client.ts:34`) | 1 Visibilidad | **3** | Progreso real por fases (subiendo → analizando → guardando), timeout con mensaje y botón cancelar | open |
| 5 | A | Los errores del microservicio se reenvían **crudos** al usuario: puede ver un JSON o stack trace de FastAPI; si no hay cuerpo, se muestra «Sin detalles» (`import-mpp/route.ts:58-63`, `HomeMppUploadAction.tsx:57`) | 9 Errores | **3** | Mapear errores del parser a mensajes con qué/por qué/cómo; registrar el detalle técnico solo en logs | open |
| 6 | A | El login **pierde el correo escrito** al fallar: el error viaja por `redirect("/login?error=…")` y recarga la página sin `defaultValue` (`actions/auth.ts:6-17`, `login/page.tsx:38-56`) | 5 Prevención · 9 Errores | **3** | Conservar el input y validar en el campo, no en un banner | open |
| 7 | A | **No existe recuperación de contraseña ni registro**: un usuario bloqueado no tiene salida en la UI (grep sin resultados en `src/`). Los mensajes tampoco dicen qué hacer: «Usa las credenciales iniciales configuradas en .env» (`lib/auth/session.ts:85`) es jerga de desarrollador | 2 Lenguaje real · 3 Control | **3** | Añadir salida (recuperación o contacto de admin) y reescribir los mensajes en lenguaje de usuario | open |
| 8 | A | El parámetro `error` se pinta sin sanitizar (`login/page.tsx:40`), así que un enlace `/login?error=<texto>` muestra un **mensaje de sistema falsificado** — vector de phishing | 9 Errores (+ seguridad) | **3** | Usar códigos de error mapeados a textos fijos, nunca texto libre de la URL | open |
| 9 | B | ✅ **Resuelto (E6)** — no había estado vacío en la tabla ni en el Gantt: un proyecto sin tareas —o un filtro sin resultados— deja una cuadrícula en blanco, sin mensaje ni salida (`GanttTable.tsx`, sin rama para `visibleTasks.length === 0`) | 1 Visibilidad · 3 Control | **3** | Estados vacíos con acción: «Crear la primera tarea» / «Ningún resultado — limpiar filtro» | **done** — `gantt-table-empty`, conserva la búsqueda al quitar el filtro |
| 10 | B | El preset de rol «Dirección» aplica `taskFilter: critical` y **oculta tareas sin avisar**; el control de filtro puede no estar visible (`lib/gantt/roleViewPresets.ts:57`, `GanttTable.tsx:980`) | 1 Visibilidad | **3** | Avisar el filtro activo con un chip removible («Solo ruta crítica ×») siempre visible | open |
| 11 | B | **Undo sin feedback**: `Ctrl+Z` no dice qué se deshizo, aunque cada comando ya lleva `description`; el historial se corta a 50 en silencio (`useHistory.ts:25-37`, `ProjectContext.tsx:583,589,250`, `lib/state/history.ts:17,34-36`). No hay toast ni `aria-live` en todo v2 | 1 Visibilidad | **3** | Mostrar «Deshecho: <description>» y avisar al alcanzar el tope del historial | open |
| 12 | B | **Ayuda contextual inexistente**: el único mecanismo es el `title` nativo (no aparece en táctil, no es accesible por teclado). Los buenos textos explicativos existen pero están escondidos tras `Cmd+K` (`GanttView.tsx:773-880`) | 10 Ayuda | **3** | Portar el patrón «Ayuda de esta pestaña» del visor 1.0: panel por vista, en lenguaje llano, reutilizando los `hint` que ya están escritos | open |
| 13 | A | El límite de **50 MB nunca se anuncia** antes de fallar (`HomeMppUploadAction.tsx:7,92`). El componente que sí lo anunciaba (`MPPUploader.tsx:182`) está muerto | 5 Prevención | **3** | Anunciar formato y tamaño junto al botón | open |
| 14 | B | Al abrir un proyecto solo hay texto plano «Cargando cronograma…», sin skeleton (`ProjectView.tsx:216-219`) | 1 Visibilidad | **2** | Skeleton de tabla + gantt | open |
| 15 | B | 4 de 10 controles de la toolbar son **solo icono** (añadir, eliminar, deshacer, rehacer) y undo/redo **desaparecen del DOM** cuando no aplican, moviendo el resto de la barra (`ProjectToolbar.tsx:173-216,194`) | 4 Consistencia | **2** | Etiqueta de texto en las acciones destructivas y deshabilitar en vez de desmontar | open |
| 16 | B | **14 vistas planas**, sin agrupación ni jerarquía (edición/análisis/configuración mezcladas); «Cuellos» es opaco y comparte icono `AlertTriangle` con «Conflictos» (`ViewSidebar.tsx:28-43`) | 8 Minimalismo · 6 Reconocimiento | **2** | Agrupar por intención y renombrar «Cuellos»; icono propio por vista | open |
| 17 | B | Los botones de nivel WBS etiquetan `L1` pero aplican nivel 2 (`GanttTable.tsx:517-523`), y el control **cambia de botones a `<select>`** según el número de niveles (`:733-766`) | 4 Consistencia | **2** | Alinear etiqueta y semántica; un solo tipo de control | open |
| 18 | A | Redirect a login **silencioso y sin `?next=`**: no explica por qué, y tras autenticarse siempre vuelve a `/`, perdiendo el enlace directo a un proyecto (`page.tsx:14-17`, `actions/auth.ts:19`) | 3 Control | **2** | Mensaje de sesión expirada y retorno al destino original | open |
| 19 | B | Atajos no documentados: `Cmd+K` no aparece en la UI y `Ctrl+Y` no se documenta en ningún sitio; no existe pantalla de atajos (`GanttView.tsx:962-968,1151`) | 7 Flexibilidad | **2** | Mostrar el atajo en el botón y añadir una hoja de atajos | open |
| 20 | B | **Autosave invisible en reposo**: el indicador solo existe si `saveStatus !== "idle"`, es un `<span>` sin `role="status"`, y «Error al guardar» no ofrece reintento ni dice si se perdió trabajo. Textos hardcodeados pese a existir claves i18n (`GanttView.tsx:1068-1077`, `lib/i18n.ts:61-62,92-93`) | 1 Visibilidad | **2** | Indicador permanente con hora del último guardado y reintento en el error | open |
| 21 | A/B | **Dos componentes muertos** duplican la verdad: `MPPUploader.tsx` (el bueno: drag & drop, límite anunciado) no lo importa ninguna página, y `ViewSwitcher.tsx` está reemplazado por `ViewSidebar.tsx` con la lista de 14 vistas duplicada literalmente | 4 Consistencia | **2** | Borrar el muerto o adoptarlo; una sola fuente para la lista de vistas | open |
| 22 | A | ✅ **Resuelto (E45)** — jerga de infraestructura en pantallas de usuario: chip «Conectado/Desconectado/Error» (`page.tsx:19,26,33,59`), «En una base limpia, el primer correo que entra se crea como administrador» (`login/page.tsx:102`), «Usa la opción heredada» (`upload/page.tsx:95`) | 2 Lenguaje real | **2** | Reescribir en lenguaje de obra (Fase 6) | **done** — ver POSITIONING.md |
| 23 | A | Textos sin tildes e inconsistentes entre capas: «extension», «maximo», «importacion», «No se proporciono un archivo .mpp valido» (`import-mpp/route.ts:34`) frente a «No se proporcionó un archivo .mpp válido» (`parse-mpp/route.ts:11`) | 4 Consistencia | **1** | Normalizar ortografía y unificar cadenas | open |
| 24 | A | «Nuevo Proyecto» es un `<form method="get">` con botón, no un enlace: no se puede abrir en pestaña nueva ni ver la URL (`app/page.tsx:78-86`) | 4 Consistencia | **1** | Usar `<Link>` | open |
| 25 | B | `role="tab"` dentro de `role="navigation"` sin `tablist`, y sin `aria-current` (`ViewSidebar.tsx:53-56,66,69`) | Accesibilidad | **1** | Corregir roles ARIA | open |

**Resumen:** 3 issues de severidad 4 (**2 resueltos + 1 parcial el 2026-08-05**, ver EXPERIMENTS.md E1-E3),
10 de severidad 3, 9 de severidad 2, 3 de severidad 1.
Puntuación heurística actual estimada: **4/10** — hay issues catastróficos (pérdida de datos sin undo, error
indistinguible de vacío, flujo público roto) y varias filas del diagnóstico rápido fallan: no hay estados
vacíos, los mensajes de error no dicen cómo salir, y no hay ayuda accesible.

### Fase 3 — Las dos brechas de Norman (2026-08-05)

Auditoría de los flujos núcleo (importación, edición del cronograma, acciones destructivas) con el marco de
Don Norman. Esta vez **sí hubo verificación en vivo**: el stack Docker levantó y se recorrió `/gantt-demo`
(no requiere sesión). Lo verificado en navegador se marca 🔬.

**Puntuación Norman: 4/10** al auditar; **6/10** tras resolver E23, E25 y E26 el mismo día. E24 (parcial) cubrió después los borrados de recursos/presupuesto/matriz. Fallan 3 de las 5 filas del diagnóstico: los usuarios no entienden qué pasó
(evaluación), no pueden recuperarse de varios errores (destructivas fuera del historial) y faltan
restricciones que harían el error imposible. Mapeo y descubribilidad pasan a medias.

| # | Flujo | Issue | Principio | Sev | Fix | Estado |
|---|---|---|---|---|---|---|
| 26 | Editar | ✅ **Resuelto (E23)** — 🔬 **Rechazo mudo**: si una edición genera issues, `commitTaskChange` hace `return` temprano — sin `history.push`, sin mensaje, sin nada. `scheduleIssues` solo se renderiza dentro de `BottlenecksView`, que vive en **otra pestaña** («Cuellos»). Verificado en vivo: poner duración −10 devolvió la celda a 5 **sin ninguna alerta** (`ProjectContext.tsx:292-328`, `GanttView.tsx:1553`) | Brecha de evaluación · Feedback | **4** | Mostrar el issue donde ocurre la edición (toast o inline en la celda), nunca solo en otra vista | **done** — `RejectionToast` + `lastRejection` |
| 27 | Destructivas | ✅ **Resuelto (E24)** — **estado fuera del historial**: borrar recurso, borrar partida de presupuesto, quitar mapeos, importar CSV de presupuesto y **aplicar el plan matricial** no son deshacibles ni piden confirmación; viven en `useState` local de `GanttView` (`:584,597-604,622-644,647-658`) | Recuperación de errores | **4** | Llevar estas acciones al historial, o al menos darles el mismo aviso «Deshacer» que ya tienen las tareas | **done** — todo pasa por `runUndoable`: borrar y editar recurso/partida, import CSV, mapeos, aplicar y sincronizar matriz, y restablecer columnas en las tres tablas |
| 28 | Editar | ✅ **Resuelto (E25)** — **`calendarIssues` no tenía ningún consumidor** en todo `src/`: un calendario inválido se rechaza en silencio absoluto (`ProjectContext.tsx:260-262,335-338,707`) | Brecha de evaluación | **4** | Renderizar los issues de calendario junto al editor de calendario | **done** — prop `issues` en `CalendarSettingsView` |
| 29 | Editar | **Entradas inválidas se descartan sin avisar**: texto en un campo MPP se convierte en `0` (`GanttRow.tsx:204-209`); una predecesora mal escrita **borra la dependencia** (`:117-146`, `continue` mudo); duración o fecha no parseables revierten sin mensaje | Feedback · Prevención | **3** | Validar en el campo y explicar el rechazo; nunca convertir texto en 0 en silencio | open |
| 30 | Editar | ✅ **Resuelto (E26)** — **faltaban restricciones**: el input de duración es `type=number` 🔬 **sin `min`** y con `step="any"`; no se valida que `finish >= start`, lo que produce duraciones negativas; la tabla acepta duración 0 mientras el resize impone mínimo 1 — **dos reglas distintas para el mismo campo** (`EditableCell.tsx:81-89`, `GanttRow.tsx:334-337,352-374`, `useResizeBar.ts:6`) | Restricciones | **3** | `min=1 step=1`, validar `finish >= start` y unificar la regla de duración mínima | **done** — `editValidation.ts` |
| 31 | Editar | **Se pueden editar celdas derivadas**: `finish` es salida del CPM pero es editable y el valor se recalcula al instante; y **las filas resumen son editables** pese a que `EditableCell` tiene un prop `readOnly` que ningún llamador usa (`GanttRow.tsx:266,289,366-380`) | Restricciones · Modelo conceptual | **3** | Marcar en solo lectura lo que el motor calcula, usando el `readOnly` que ya existe | open |
| 32 | Editar | **Significantes invisibles**: los handles de redimensionado son rects `fill="transparent"` de 8 px sin ningún indicio visual, y los puntos para crear dependencias **solo existen en hover** — sin ratón encima, nada sugiere que las tareas se puedan enlazar (`TaskBar.tsx:41,79,155-184,228-259`) | Significantes · Descubribilidad | **3** | Handles visibles al enfocar/seleccionar la barra y una pista permanente de conexión | open |
| 33 | Editar | **El preview miente**: el fantasma de arrastre usa el píxel crudo (`ghostX: pixelDeltaX`) mientras el commit usa días redondeados — la barra «salta» al soltar. Y no dice a qué fecha va: el tooltip de resize solo muestra `5d`, sin fechas (`useDragBar.ts:14-17,59,72`) | Feedback · Mapeo | **3** | Snapear el fantasma igual que el commit y mostrar la fecha destino durante el gesto | open |
| 34 | Editar | **El tipo de dependencia se infiere del borde** que se arrastra (derecha→izquierda = FS, etc.) sin decírselo nunca al usuario: descubre que creó un SF al mirar la tabla (`useCreateDependency.ts:40-48`) | Modelo conceptual | **3** | Anunciar el tipo durante el arrastre y permitir cambiarlo al soltar | open |
| 35 | Editar | **Sin resumen de impacto**: al cambiar una duración que desplaza 50 sucesoras, las barras se mueven y ya. El sistema **ya calcula** `changedTaskIds` pero solo lo guarda en la auditoría, sin renderizarlo. El patrón correcto existe en `DependencyPanel` («Impacto previo», «Tareas afectadas») pero la ruta primaria de edición no lo usa (`ProjectContext.tsx:310`, `DependencyPanel.tsx:584-612`) | Brecha de evaluación | **3** | Resaltar las tareas afectadas y resumir el impacto tras cada edición | open |
| 36 | Importar | **La app no dice qué va a pasar**: no se advierte que **siempre crea un proyecto nuevo** (nunca sobrescribe), no hay preview y no hay resumen posterior — se pasa del selector de archivos al Gantt. Además inyecta **festivos de Colombia** y genera un plan matricial sin mencionarlo (`route.ts:80-93`, `mpp-project.ts:113-124`) | Modelo conceptual | **3** | Anunciar el resultado antes y resumir después (N tareas, N dependencias, N recursos) | open |
| 37 | Importar | **Pérdidas silenciosas**: las columnas por encima de **120 se descartan sin avisar** (`mpp-project.ts:22,138,149,160`), y no existe ningún canal de advertencias — `WarningList.tsx` **está muerto** y el pipeline no declara `warnings` | Feedback | **3** | Devolver advertencias del parseo y mostrarlas tras importar | open |
| 38 | Destructivas | 🔬 **Riesgo de slip**: «Agregar tarea» (x=314) y «Eliminar tarea(s)» (x=348) son botones contiguos de 32 px, **solo icono y sin etiqueta**, sin divisor entre ellos. Mismo patrón en la matriz: `[Agregar hijo][Agregar hermano][Eliminar]` con iconos de 14 px (`ProjectToolbar.tsx:172-192`, `MatrixEditorView.tsx:648-672`) | Prevención de slips | **3** | Separar lo destructivo de lo frecuente con divisor y etiqueta de texto | open |
| 39 | Editar | **Modo engañoso**: el toggle «Simple/Avanzado» promete «cambiar entre controles simples y avanzados» pero solo controla **un desplegable**; no afecta a la edición, el arrastre ni las dependencias. Por defecto arranca en «Avanzado» (`GanttView.tsx:242-243,1085-1137`) | Modelo conceptual · Mapeo | **2** | O el modo hace lo que promete, o se elimina | open |
| 40 | Editar | ⚠️ **Parcial (E45)** — el tooltip ya está en español; sigue faltando el significante visual y la entrada por teclado. Era `title="Double-click to edit"` — **en inglés dentro de una UI en español**, y no hay forma de entrar en edición con el teclado (`EditableCell.tsx:69,137-138`) | Significantes · Accesibilidad | **2** | Significante visual de celda editable y entrada en edición con Enter/F2 | open |
| 41 | Navegación | 🔬 **Etiquetas cortadas** en la barra de vistas: con 47 px de ancho se leen «Seguim…», «Diagra…», «Hoja Ta…», «Línea B…», «Conflict…», «Unidad …», «Calend…». Varios encabezados de tabla también se truncan («ID», «Dur.», «Crit.») | Significantes | **2** | Ensanchar la barra o mostrar el nombre completo al enfocar | open |

### Fase 8 — Rendimiento (2026-08-05)

Medido con `PerformanceObserver` en el navegador sobre `localhost:3000/gantt-demo` (build de producción en
Docker). **Salvedad honesta:** la demo tiene 8 tareas y corre en localhost, así que TTFB/LCP son
optimistas — el caso real es un `.mpp` de 300+ tareas sobre red. Aun así, el problema encontrado es
estructural y no depende del tamaño del proyecto.

| Métrica | Antes | Objetivo | Después | Estado |
|---|---|---|---|---|
| **INP** (cambiar de vista) | **584 ms** | < 200 ms | **184 ms** | ✅ |
| LCP | 348 ms | < 2,5 s | 380 ms | ✅ (localhost) |
| CLS | 0,013 | < 0,1 | 0,013 | ✅ |
| TTFB | 22 ms | < 800 ms | — | ✅ (localhost) |
| JS inicial | 237 KB / 9 chunks | — | **208 KB / 8 chunks** | mejorado |

| # | Issue | Heurística | Sev | Fix | Estado |
|---|---|---|---|---|---|
| 47 | 🔬 **INP de 584 ms al cambiar de vista**: las **17 vistas se importaban estáticamente** en `GanttView`, así que todas viajaban en el bundle inicial y montaban de golpe. El tiempo de *procesamiento* del handler era 1-8 ms: el coste estaba íntegro en montar y pintar | Rendimiento | **3** | Carga diferida por vista (`next/dynamic`) con estado de carga | **done** — INP 584 → 184 ms verificado |
| 48 | Importación de 11 MB tarda **~36 s** sin progreso, sin timeout y sin cancelar (mismo que #4) | Rendimiento · Visibilidad | **3** | Progreso por fases + `AbortController`; la latencia real no baja, se hace legible | open (E4) |
| 49 | Sin skeleton al abrir un proyecto: texto plano «Cargando cronograma…» (#14) | Rendimiento percibido | **2** | Skeleton de tabla + gantt | open (E16) |

**Nota de método:** el LCP de la demo (380 ms) no es representativo de producción. Para cerrar de verdad la
fase haría falta medición de campo (RUM) sobre proyectos reales; queda anotado como límite de esta auditoría.

### Trunk Test por pantalla clave

| Pantalla | ¿Qué app? | ¿Qué pantalla? | ¿Mis opciones? | ¿Dónde estoy? | ¿Buscador? | Veredicto |
|---|---|---|---|---|---|---|
| `/login` | Sí | Sí («Iniciar sesión») | Parcial: sin recuperación ni registro | n/a | n/a | **Falla** por falta de salida (#7) |
| `/` home | Sí | Sí | Sí (subir / nuevo) | Sí | No | Pasa, salvo la ambigüedad vacío-vs-error (#3) |
| `/upload` | Sí | Sí | Confusa: dos importadores conviviendo con estilos de error distintos | Sin retorno claro | No | **Falla** (#1, #21) |
| `/project/[id]` | Sí | Nombre del proyecto en la toolbar | 14 vistas planas | `aria-selected` en la vista activa | Sí (filtro por nombre) | Pasa a medias: sin migas ni agrupación (#16) |

### Reescrituras propuestas (labels y errores)

| Superficie | Hoy | Propuesta |
|---|---|---|
| Error de conexión al importar | «No se pudo conectar con el servidor de importacion» | «No pudimos analizar el archivo: el servicio no responde. Reintentar» |
| Error genérico de importación | «No se pudo importar el archivo .mpp» + texto crudo del parser | «No pudimos leer *<nombre>*. Suele pasar con archivos guardados en versiones muy antiguas de MS Project. Probar con otro archivo» |
| Login fallido | «Usa las credenciales iniciales configuradas en .env» | «No encontramos ninguna cuenta con ese correo. Pide acceso al administrador del proyecto.» |
| Home sin proyectos | «No hay proyectos guardados» | «Todavía no tienes cronogramas. Sube un `.mpp` para empezar.» (+ botón) |
| Home con error de datos | (mismo texto que el vacío) | «No pudimos cargar tus cronogramas. Reintentar» |
| Botón de subida | «Subir Archivo .mpp» | «Subir cronograma .mpp» + nota «Máx. 50 MB» |
| Vista «Cuellos» | «Cuellos» | «Cuellos de botella» |

## Tokens

Auditados en Fase 4 (2026-08-05) sobre `v2/src/app/globals.css` (2925 líneas). **Veredicto: el sistema de
tokens es sólido; el problema es cómo se usa.**

| Escala | Estado | Nota |
|---|---|---|
| Paleta | ✅ Buena | 6 matices AIA (corp/const/arch/proj/alert/warn) × 5 tonos en OKLCH, más grises 50-900 **tintados** (hue 280) — cumple el estándar de Refactoring UI |
| Radios | ✅ | `--radius-sm/md/lg/xl/pill` (7/10/14/20 px) |
| Sombras | ✅ | `--shadow-sm/md/lg/xl/focus`, con variante dark |
| Tipografía | ⚠️ | Dos familias (Montserrat/Inter vía system stack) bien; pero tamaños por componente (`--gantt-*-font-size`) en vez de una escala global, y había un **mínimo de 8 px** en la barra de vistas (corregido a 10 px) |
| Espaciado | ⚠️ | No existe `--space-*` global; cada componente define los suyos. Consistente en la práctica, pero sin escala declarada |

## Components

Hallazgos de la prueba de escala de grises (`filter: grayscale(1)` sobre `/gantt-demo`, 2026-08-05).
**Puntuación Refactoring UI: 5/10** — fallan blur test (los encabezados oscuros pesan más que los datos),
grayscale test (la criticidad desaparece), etiquetas compitiendo con datos y ancho sin restringir en la
columna Pred.

| # | Componente | Hallazgo | Sev | Fix | Estado |
|---|---|---|---|---|---|
| 42 | Barras del Gantt + tabla | ✅ **Resuelto (E39)** — 🔬 la ruta crítica dependía solo del color: en grises, una barra crítica (`--aia-alert-main`) y una normal son idénticas — misma forma, sin patrón, borde ni icono. Afecta a daltónicos (~8 % de hombres) e impresiones B/N, habituales en obra. El dato existe (columna «Crit.») | **3** | Señal no cromática: borde grueso, patrón o icono ▲ en barras críticas, y peso tipográfico (no color) en la tabla | **done** — `CriticalHatchDefs` (trama 45° + borde `alert-dark`) en GanttChart y TrackingGantt; ▲ en el nombre |
| 43 | Tabla | 🔬 Botón **«Editar» repetido en cada fila** de la columna Pred.: el elemento visualmente más pesado de la fila es un control secundario, no el dato. 8 filas = 8 botones idénticos | **2** | Mostrar el token de dependencia como dato («2FS+4d») y editar al hacer click/hover, sin botón permanente | open |
| 44 | Encabezados | 🔬 Los dos encabezados oscuros (tabla verde oscuro + escala temporal) son **lo más pesado de la pantalla**; en el blur test ganan a los datos. Refactoring UI: los encabezados sirven al dato, no compiten | **2** | Encabezado claro con texto small-caps gris; reservar el oscuro para una sola franja | open |
| 45 | Cinta de la tabla | 🔬 ~20 botones solo-icono de 14 px en la cinta («ribbon») sin etiqueta — mystery meat en cadena (relacionado con #15) | **2** | Agrupar con separadores + etiquetas en los grupos, overflow en «⋯» | open |
| 46 | Barra de vistas | ✅ **Resuelto** — etiquetas a 8 px con recorte («Seguim…», «Diagra…»); ahora 10 px, dos líneas permitidas, barra de 3.625 → 4.5 rem. 0 truncadas verificado en navegador | **2** | — | **done** (parte de #41/E38; los encabezados de tabla comprimidos siguen open) |

**Decisión de fase (regla grayscale-first):** no se añade color nuevo. Los fixes #42-45 se resuelven con
peso, tamaño y espaciado dentro de los tokens existentes.

## Microinteraction Inventory

Fase 5 (2026-08-05), marco Saffer: Trigger / Rules / Feedback / Loops. Auditadas las 7 interacciones más
usadas; los números #N remiten a `## UX Audit Findings`. **Puntuación: 5/10** — fallan feedback proporcional
(autosave invisible en reposo), triggers descubribles (celda editable, handles) y loops (nada evoluciona
con el uso; no hay long loops).

| Interacción | Trigger | Rules | Feedback | Loops/Modos | Fix | Estado |
|---|---|---|---|---|---|---|
| Editar celda | ⚠️ Doble click sin significante (tooltip en inglés, #40) | ✅ Validación con motivo (E26) | ✅ `RejectionToast` al rechazar (E23); ⚠️ sin confirmación visible al aceptar | Sin loop de aprendizaje | Significante visual + entrada por teclado (E37); micro-flash en la celda al aplicar | open |
| Arrastrar/redimensionar barra | ⚠️ Handles invisibles (#32) | ⚠️ Clamp silencioso a duración 1 (#33) | ⚠️ El fantasma no snapea y no dice fecha destino (#33) | — | E29 + E30 | open |
| Guardar (autosave) | Sistema (debounce 750 ms) | ✅ | ⚠️ **Invisible en reposo** (#20): el usuario no sabe que existe hasta que dispara; «Error al guardar» sin reintento | Loop abierto correcto | E13: indicador permanente con hora del último guardado | open |
| Deshacer | ✅ Ctrl+Z + botones | ✅ Historial 50 | ⚠️ `UndoToast` solo en alta/baja/`runUndoable`; editar/arrastrar entran al historial **sin aviso** (#11); tope de 50 silencioso | — | E12: anunciar «Deshecho: <acción>» usando la `description` que ya existe | open |
| Borrar | ✅ Botón (aunque solo-icono, #38) | ✅ Por historial (E1/E24) | ✅ `UndoToast` con «Deshacer» | — | E34 (separación/etiqueta) | parcial |
| Importar .mpp | ✅ Botón | ⚠️ Sin timeout (#4) | ⚠️ Solo «Importando…» (#4); sin resumen final (#36) | Primera vez = igual que la centésima | E4 + E32 | open |
| Cambiar de vista | ✅ Barra lateral, activo visible (aria-selected + fondo corp), transición 140 ms | ✅ | ✅ 🔬 verificado | Sin long loop (los `hint` de cada vista nunca se muestran fuera de Cmd+K → E8) | — | ok |

### Momento firma — badge de observaciones en la barra (E43)

**Qué es** (destilado del visor 1.0): anotar una observación desde la propia barra del Gantt deja un
distintivo visible sobre la barra — `!` ámbar mientras está *Pendiente*, ✓ verde al marcarla *Atendida* —
y el registro central permite exportarla al equipo (CSV/LPS). El cronograma se convierte en el tablero de
seguimiento de la obra: el estado del trabajo de campo se ve **encima del plan**.

**Removal test: pasa.** Sin el badge, las observaciones viven solo en una pestaña aparte y el Gantt vuelve a
ser un dibujo estático — se pierde la razón por la que los usuarios del visor 1.0 revisaban el cronograma a
diario. No es decoración: es el loop de trabajo (anotar → ver pendiente → atender → exportar) hecho visible.

**Cuatro partes:** Trigger = click en barra → panel con campo de observación (ya existe el patrón en v1).
Rules = una tarea con observaciones pendientes muestra `!`; todas atendidas → ✓; sin observaciones → nada.
Feedback = el badge aparece al guardar (<100 ms, sobre el elemento tocado, no un toast aparte — regla de
Saffer). Loops = el badge es persistente hasta atender; el registro exporta CSV/LPS.

**Estado: shipped 2026-08-05.** Construido con modelo propio (`lib/observations`), badge en barra, panel de
anotación, export CSV/LPS y persistencia. Verificado el loop entero en navegador. Pendiente: abrir el panel
con click directo en la barra y una pestaña «Observaciones» a nivel de proyecto.
