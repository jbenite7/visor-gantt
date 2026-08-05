# Destilación — Visor de Cronogramas V-0.012 (project-viewer-501614.web.app)

Fecha: 2026-08-05. Método: recorrido en vivo con navegador usando `aia-ms-project/20260312 DA PORTO TORRE 3.mpp` (630 KB → parsea en ~4 s, 239 tareas, 212 links, 195 tareas con nivel/sistema detectado), prueba directa del API con el .mpp de 11 MB (`POST /api/parse`, 200 en ~36 s) y lectura del bundle JS (dhtmlxGantt + React, Firebase Hosting).

Verificado en vivo: las pestañas reales son **7** (Gantt, Tabla, Líneas de Balance, Unidad Típica, Conflictos, Calendario, Observaciones) + botón «Exportar CSV (LPS)» y «?» de ayuda contextual en la toolbar; franja de metadatos del proyecto (nombre · inicio · fin · nº tareas · nº dependencias) siempre visible. El loop de observaciones se probó completo: click en barra → panel con fechas, % completado, marca «Ruta crítica» y **tabla de predecesoras con tipo (FS) y diferencia en días calendario y laborales** → guardar observación → aparece en el registro como Pendiente con fecha, contador «1 observación», y botones Exportar/**Importar** CSV (round-trip). El toggle «Solo ruta crítica» atenúa correctamente las barras no críticas. Líneas de Balance declara la cobertura de su detección: «195 de 239 tareas tienen ubicación detectada (44 sin ubicación no se muestran aquí)». Unidad Típica: modos «Por Nivel» y «Consolidado», con hover que resalta la secuencia de un nivel y distingue enlace real (línea sólida) de orden cronológico sin enlace (punteada).

## Qué es

Visor liviano de `.mpp`: sin login, un solo botón «Subir archivo .mpp», parseo server-side y cinco pestañas. Es el antecesor («visor 1.0») del v2 de este repo — el goal `paridad-visor-10` ya portó varias de sus vistas.

## Pestañas y funciones observadas

| Superficie | Qué hace |
|---|---|
| Gantt | dhtmlxGantt; escala Semanas/Meses/Trimestres; expandir/colapsar por nivel WBS (botones «Nivel 1..N») o por fila; toggle **«Solo ruta crítica»** que atenúa lo no crítico; popup de tarea **redimensionable** con datos + guardar observación; badge en la barra: `!` amarillo = observación pendiente, verde = todas atendidas |
| Tabla | Listado completo (WBS, nivel, sistema, fechas, duración laboral y calendario, %, recursos, crítica); Predecesoras/Sucesoras con tipo y lag (`FS+10d`); orden por click en encabezado; misma jerarquía colapsable |
| Líneas de Balance | Una línea por sistema (detección automática por reglas del nombre de tarea, «sin IA»); eje Y = niveles, X = tiempo; checkboxes de leyenda + Todos/Ninguno |
| Unidad Típica | Secuencia constructiva típica de un nivel/piso; modo «Por Nivel» y «Consolidado» (mediana estadística de todos los niveles) |
| Observaciones | Registro de las observaciones guardadas desde el Gantt; estado **Pendiente/Atendida** con un click; **Exportar CSV** y **Exportar CSV (LPS)** (formato Last Planner) |

Transversal: **«Ayuda de esta pestaña»** — ayuda contextual por vista, escrita en lenguaje llano; footer con versión.

## Las mejores características (lo que vale la pena traer a v2)

1. **Cero fricción de entrada**: upload → ver, sin cuenta ni proyecto previo. v2 exige login/proyecto para casi todo.
2. **Flujo de observaciones en campo**: anotar desde la barra del Gantt, badge visual de estado en la propia barra, registro central Pendiente/Atendida, export CSV/LPS para compartir. Es un loop de trabajo real (revisión de cronograma en obra), no una feature suelta.
3. **Ayuda contextual por pestaña** en lenguaje simple — onboarding sin tour.
4. **«Solo ruta crítica» como modo de foco** (atenuar, no ocultar).
5. **Colapso por nivel WBS con botones numerados** — control de densidad en un click.
6. **Popup de tarea redimensionable** con acción útil (guardar observación) en lugar de solo lectura.

## Debilidades vistas (no copiar)

- Un fallo de red muestra «Failed to fetch» crudo, sin reintento ni mensaje humano; la carga de 11 MB tarda ~36 s con un botón «Procesando…» sin progreso ni skeleton.
- Estado vacío plano; sin persistencia (recargar pierde todo); versión «V-0.012» como único footer.
