# PRODUCT — visor-gantt (v2)

Creado 2026-08-05 en Fase 9 de `improve-app` (steve-jobs-design-review).

# Design Review: Visor Gantt v2

**Verdict:** NOT DONE (score **6/10**)

**The One Thing:** *Abrir el `.mpp` de la obra y ver, sin MS Project, qué está en riesgo — para anotarlo y
repartirlo al equipo.*

**Keeps its promise?** **A medias.** Cuando hay datos, los cumple bien: la ruta crítica se ve (incluso en
blanco y negro), las observaciones quedan sobre la barra y se exportan en formato Last Planner. Pero el
producto **se presenta con 14 puertas y no dice cuál abrir**, y con un cronograma normal varias de esas
puertas dan a una habitación vacía.

## Evidencia del recorrido en frío (2026-08-05, `/gantt-demo`, build de producción)

Recorrí las 14 vistas midiendo cuánto contenido real muestra cada una:

| Vista | Contenido | Veredicto |
|---|---|---|
| Calendario | 1356 car. | Útil |
| Ejecutivo | 889 | Útil |
| Seguimiento | 794 | **Solapa con Gantt** |
| Hoja Tareas | 752 | **Solapa con Gantt** |
| Gantt | 623 | Núcleo |
| Cuellos | 509 | Útil |
| Curva S | 351 | Útil |
| Línea Balance | 349 | Diferencial |
| Conflictos | 227 | **Vacía**: «0 violaciones · 0 desviaciones» |
| Recursos | 216 | **Vacía** (y contiene 5 sub-pestañas dentro) |
| Diagrama Red | 207 | Marginal |
| Unidad Típica | 157 | **Vacía**: «0 sistemas repetidos detectados» |
| Configuración | 234 | Necesaria |
| **Matriz** | **12** | **Solo dice «Crear matriz»** |

**Cuatro de catorce vistas están vacías** con un cronograma corriente, y ninguna explica qué hacer para
llenarlas. Además, «Recursos» esconde 5 sub-pestañas: la app no tiene 14 superficies, tiene ~18.

**Pasos hasta el valor: 6** (login → correo → contraseña → Entrar → Subir → elegir archivo → esperar).
El objetivo de la revisión es ≤3. El visor 1.0 lo hacía en **2**.

## Cut list — lo que hay que quitar

Ordenado por convicción. Cada corte es un «no» que concentra el producto.

| # | Corte | Por qué | Disposición |
|---|---|---|---|
| C1 | **Fundir «Seguimiento» y «Hoja Tareas» dentro de Gantt** | Son la misma tabla con variantes; el usuario no debería elegir entre tres versiones de lo mismo. Pasan a ser modos del Gantt (o presets de rol, que ya existen) | Propuesto |
| C2 | **Fundir «Conflictos» dentro de «Cuellos»** | Ambas responden «¿qué está mal en el plan?»; comparten hasta el icono `AlertTriangle`. Una sola vista «Problemas» con dos secciones | Propuesto |
| C3 | **Sacar «Diagrama Red» de la barra principal** | 207 caracteres de contenido y ningún job de CUSTOMER.md lo pide; es paridad con MS Project, no valor de obra | Propuesto |
| C4 | **Vistas vacías: o se llenan o se ocultan** | «Unidad Típica», «Conflictos» y «Recursos» aparecen vacías sin decir por qué. Si el proyecto no tiene esos datos, la vista no debería ocupar un lugar en la barra | Propuesto |
| C5 | **«Matriz» con 12 caracteres no es una vista** | Es un botón «Crear matriz» disfrazado de sección. O se convierte en una acción dentro de Nuevo Proyecto, o muestra para qué sirve antes de pedir crearla | Propuesto |
| C6 | **`/gantt-demo` enlazado desde la home** | Es una demo de desarrollo (8 tareas de ejemplo) enlazada como «Ver Demo Gantt» junto a los proyectos reales del usuario | Propuesto |

**De 14 vistas a 9.** Ninguno de estos cortes elimina una capacidad: reagrupan o esconden lo que hoy compite
por atención sin ganársela.

## Fix list — ranked

| # | Fix | Dirección |
|---|---|---|
| ~~F1~~ | ~~Bajar de 6 pasos a 2 hasta el valor~~ | **Descartado.** El usuario decidió dos veces —en el grilleo del plan y de forma definitiva el 2026-08-06— que la cuenta se queda. La consecuencia asumida: se mantienen 6 pasos hasta el valor y la distancia frente al visor 1.0 en la primera impresión. No volver a proponerlo |
| F2 | **Cada vista dice para qué sirve** | E8: la ayuda ya está escrita dentro de `Cmd+K`; sacarla a la vista. Sin esto, 9 vistas siguen siendo 9 incógnitas |
| F3 | **Estados vacíos que enseñan** | «0 sistemas repetidos detectados» debe decir *qué es* un sistema repetido y *por qué* este proyecto no tiene |
| F4 | **La espera de 36 s se hace legible** | E4: progreso por fases, timeout y cancelar |
| F5 | **404 con marca, en español y con salida** | Ver «reverso de la valla» |

## Back of the fence — dónde usamos madera contrachapada

Auditado el 2026-08-05:

| Superficie | Estado | Evidencia |
|---|---|---|
| **404** | ❌ **Plywood puro** | Página de fábrica de Next.js: «404 — This page could not be found», **en inglés**, sin marca, sin enlace de vuelta. Nadie la diseñó |
| Estados vacíos de vistas | ❌ | «0 sistemas repetidos detectados» no explica nada ni ofrece salida |
| Tabla vacía / filtro sin resultados | ❌ | Cuadrícula en blanco (#9, E6) |
| Errores de importación | ⚠️ | Se reenvía texto crudo del microservicio (#5, E5) |
| Salir de la cuenta | ⚠️ | «Salir» sin confirmación ni despedida |
| Estados vacíos de la home | ✅ | Reescritos en Fase 6 |
| Errores de edición | ✅ | Explican qué pasó y cómo arreglarlo (E23/E26) |
| Observaciones vacías | ✅ | Enseña qué anotar (E43) |

## Outcome Roadmap

| Resultado / problema | Job que sirve | Prioridad | Estado |
|---|---|---|---|
| ~~Ver el cronograma sin cuenta (2 pasos, no 6)~~ | Big Hire — funcional | — | **descartado por el usuario (2026-08-06)** |
| Cada vista explica su propósito | Emocional — control | **2** | backlog (E8/F2) |
| De 14 vistas a 9 (C1, C2, C3) | Emocional — sobrecarga | **3** | propuesto |
| Estados vacíos que enseñan | Emocional | **4** | backlog (F3/E6) |
| Importación legible (progreso, cancelar) | Funcional | **5** | backlog (E4) |
| 404 y salir con dignidad | Confianza | **6** | backlog (F5) |
| Terminar el deshacer (editar recurso, columnas) | Funcional | 7 | backlog (E24 parcial) |
| Medición de campo real (RUM) | — | 8 | backlog (E47) |

## Decisión firme: la cuenta se queda

El visor 1.0 llega al valor en 2 pasos porque no pide cuenta; v2 pide 6. La revisión lo señaló como el
mayor hueco y propuso un modo de lectura sin cuenta (F1 / E51). **El usuario lo descartó en el grilleo del
plan de mejora y lo confirmó como definitivo el 2026-08-06.**

Queda cerrado, no aplazado: no debe reaparecer como pendiente en revisiones futuras. Lo que sí sigue siendo
cierto —y conviene recordar si algún día cambia la prioridad— es que la entrada es la superficie donde v2
pierde contra su antecesor, no las capacidades.

## Nota del revisor

Las ocho fases anteriores arreglaron lo que **estaba roto**: pérdida de datos sin deshacer, errores mudos,
criticidad invisible, respuesta lenta. Eso era necesario y está hecho. Pero ninguna fase podía arreglar lo
que sobra — y lo que sobra es la primera impresión del producto: **catorce puertas y ninguna señal**.

El visor 1.0 gana en una sola cosa, y es la que más importa: llega al valor en 2 pasos con 7 pestañas.
v2 tiene mucho más músculo y lo esconde detrás de una cuenta y de una barra que no se puede leer de un
vistazo. Eso es lo que separa este producto de «insanely great».
