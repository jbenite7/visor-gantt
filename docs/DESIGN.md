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
| 9 | B | **No hay estado vacío** en la tabla ni en el Gantt: un proyecto sin tareas —o un filtro sin resultados— deja una cuadrícula en blanco, sin mensaje ni salida (`GanttTable.tsx`, sin rama para `visibleTasks.length === 0`) | 1 Visibilidad · 3 Control | **3** | Estados vacíos con acción: «Crear la primera tarea» / «Ningún resultado — limpiar filtro» | open |
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
| 22 | A | Jerga de infraestructura en pantallas de usuario: chip «Conectado/Desconectado/Error» (`page.tsx:19,26,33,59`), «En una base limpia, el primer correo que entra se crea como administrador» (`login/page.tsx:102`), «Usa la opción heredada» (`upload/page.tsx:95`) | 2 Lenguaje real | **2** | Reescribir en lenguaje de obra (Fase 6) | open |
| 23 | A | Textos sin tildes e inconsistentes entre capas: «extension», «maximo», «importacion», «No se proporciono un archivo .mpp valido» (`import-mpp/route.ts:34`) frente a «No se proporcionó un archivo .mpp válido» (`parse-mpp/route.ts:11`) | 4 Consistencia | **1** | Normalizar ortografía y unificar cadenas | open |
| 24 | A | «Nuevo Proyecto» es un `<form method="get">` con botón, no un enlace: no se puede abrir en pestaña nueva ni ver la URL (`app/page.tsx:78-86`) | 4 Consistencia | **1** | Usar `<Link>` | open |
| 25 | B | `role="tab"` dentro de `role="navigation"` sin `tablist`, y sin `aria-current` (`ViewSidebar.tsx:53-56,66,69`) | Accesibilidad | **1** | Corregir roles ARIA | open |

**Resumen:** 3 issues de severidad 4 (**2 resueltos + 1 parcial el 2026-08-05**, ver EXPERIMENTS.md E1-E3),
10 de severidad 3, 9 de severidad 2, 3 de severidad 1.
Puntuación heurística actual estimada: **4/10** — hay issues catastróficos (pérdida de datos sin undo, error
indistinguible de vacío, flujo público roto) y varias filas del diagnóstico rápido fallan: no hay estados
vacíos, los mensajes de error no dicen cómo salir, y no hay ayuda accesible.

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

_Pendiente — Fase 4 (refactoring-ui)._

## Components

_Pendiente — Fase 4._

## Microinteraction Inventory

_Pendiente — Fase 5 (microinteractions)._
