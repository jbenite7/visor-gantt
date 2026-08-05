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

**Orden recomendado de ejecución:** E1, E2, E3 (severidad 4) → E5, E6, E7, E11 (alto ICE, baratos) →
E4, E9, E12 → el resto.

## Experiment Cards

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
