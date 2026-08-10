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

---

# Design Review: Visor Gantt v2 — revisión en frío final

Ejecutada el **2026-08-08** sobre el **build de producción** (`next start`), recorriendo la app en frío como
un cliente, igual que la del 2026-08-05. Cierra la condición 4 del goal maestro `evolucion-visor-v2`.

**Verdict:** NOT DONE (score **7/10**) — *sube desde el 6/10 del 2026-08-05*

**The One Thing:** *Abrir el `.mpp` de la obra y ver, sin MS Project, qué está en riesgo — para anotarlo y
repartirlo al equipo.* (Sin cambios: sigue siendo la promesa correcta.)

**Keeps its promise?** **Sí, y ahora se nota.** La app ya no se presenta con 14 puertas sin señalizar: son
**11, agrupadas en TRABAJO / ANÁLISIS / AJUSTES**, y las que antes daban a una habitación vacía ahora
explican por qué están vacías. El núcleo —abrir, ver la ruta crítica, anotar, exportar en Last Planner—
funciona y está conectado. Lo que impide el 10 es una sola puerta, y es la peor posible: la del módulo en
el que más se invirtió.

## Las 7 filas del diagnóstico

| # | Fila | Veredicto | Evidencia |
|---|---|---|---|
| 1 | ¿Se puede decir la Única Cosa en una frase? | ✅ | Escrita arriba, sin cambios desde agosto |
| 2 | ¿Un usuario nuevo llega al valor en ≤3 pasos? | ❌ | Siguen **6**: login → correo → contraseña → Entrar → Subir → elegir archivo. **Es una decisión, no un descuido**: el usuario descartó E51 en firme el 2026-08-06. La fila falla igual, porque mide lo que vive el cliente, no nuestros motivos |
| 3 | ¿El revisor la usó en frío, como cliente? | ✅ | Recorrido completo sobre build de producción, sin guion previo |
| 4 | ¿Hay una demo funcionando en el dispositivo real? | ✅ | `next start`, rutas reales, 8 tareas de ejemplo |
| 5 | ¿Se quitó algo este ciclo? | ✅ | **De 14 vistas a 11.** «Seguimiento» y «Hoja de Tareas» plegadas en Gantt (C1); «Conflictos» fundida en «Problemas» (C2); «Diagrama de Red» fuera de la barra (C3); `/gantt-demo` ya no se enlaza desde la puerta (C6); y una caché que no cacheaba, retirada |
| 6 | ¿Los estados vacíos y de error están a la altura de la pantalla principal? | ❌ | **Dos de once siguen siendo contrachapado.** Ver abajo |
| 7 | ¿El equipo la usaría a diario con orgullo y la firmaría? | ✅ | El bucle central funciona, no pierde trabajo y no promete lo que no da. Con una reserva, escrita abajo |

**5 de 7 → 7/10.** Banda 5-8: hacen falta cortes y arreglos reales. **No es «bastante bien»**: es mejor que
antes y sigue sin estar terminado.

## La medición, vista contra la del 2026-08-05

Caracteres de contenido propio de cada vista, descontada la cabecera común (493 car.), en `/gantt-demo`:

| Vista | 2026-08-05 | 2026-08-08 | Lectura |
|---|---|---|---|
| Calendario | 1356 | **1359** | Útil, sin cambios |
| Ejecutivo | 889 | **996** | Útil |
| **Problemas** | Cuellos 509 + Conflictos 227 | **759** | **Dos vistas fundidas en una** (C2) |
| Unidad Típica | 157 · *vacía y muda* | **536** | **Ahora explica qué es un sistema repetido y por qué este proyecto no tiene** (F3) |
| Curva S | 351 | **356** | Sin cambios |
| Línea Balance | 349 | **352** | Sin cambios |
| Observaciones | — | **315** | **Entrada nueva**, con Last Planner dentro |
| Configuración | 234 | **237** | Necesaria |
| Gantt | 623 | **789** | Núcleo; absorbió Seguimiento y Hoja de Tareas (C1) |
| **Recursos** | 216 · *vacía* | **217** | **Sin tocar.** Sigue en «0 / 0 recursos» y sigue escondiendo 5 sub-pestañas |
| **Matriz** | **12** · *«Crear matriz»* | **12** | **Idéntica. Ni un carácter** |
| ~~Seguimiento~~ | 794 | — | Plegada en Gantt |
| ~~Hoja Tareas~~ | 752 | — | Plegada en Gantt |
| ~~Diagrama Red~~ | 207 | — | Fuera de la barra |

**De cuatro vistas vacías a dos.** Y las dos que quedan son las mismas que ya estaban señaladas.

## El hallazgo que decide la nota

**«Matriz» sigue siendo un botón de 12 caracteres disfrazado de sección.** Es literalmente lo único que
renderiza la vista: `Crear matriz`. Sin una frase de qué es, para qué sirve, ni qué va a pasar si se pulsa.

Lo que lo vuelve grave no es el tamaño: es **lo que hay detrás**. P4 invirtió 26 tareas en construir un
editor de recetas, plantillas de fábrica y propias, un generador de matrices desde un `.mpp` cargado,
dependencias reales piso a piso, calendario del proyecto, panel de rendimientos observados, conflictos con
elección y borrado deshacible. **Nada de eso se intuye desde la puerta.**

El goal de P4 se abría diciendo que la matriz era «el módulo más potente y el peor conectado». Hoy es más
potente y **sí está conectado al menú** —M27 cerrado—, pero **su puerta sigue sin decir nada**. El corte C5
de la revisión anterior pedía exactamente esto —«o se convierte en una acción dentro de Nuevo Proyecto, o
muestra para qué sirve antes de pedir crearla»— y es el único de los seis que no se hizo.

Es el patrón que este supergoal existía para eliminar —función construida que nadie puede alcanzar—
sobreviviendo en el único sitio donde más caro sale.

## Cut list

| # | Corte | Estado |
|---|---|---|
| C1 · Fundir Seguimiento y Hoja de Tareas en Gantt | ✅ hecho |
| C2 · Fundir Conflictos en Cuellos → «Problemas» | ✅ hecho |
| C3 · Sacar Diagrama de Red de la barra | ✅ hecho |
| C4 · Vistas vacías: o se llenan o se ocultan | ⚠️ **a medias** — Unidad Típica sí; **Recursos no** |
| C5 · «Matriz» con 12 caracteres no es una vista | ❌ **sin hacer** |
| C6 · `/gantt-demo` enlazado desde la home | ✅ hecho |

**Nada nuevo que cortar.** Las 11 vistas se ganan su sitio; el problema ya no es cuántas puertas hay, es que
dos no dicen qué hay detrás.

## Fix list — ranked

| # | Fix | Dirección |
|---|---|---|
| **F6** | **La puerta de la Matriz tiene que enseñar el cuarto** | Antes de pedir «Crear matriz», mostrar en una pantalla qué es y qué se obtiene: alcances × ubicaciones × recetas → cronograma. Con las plantillas de fábrica visibles como atajo —ya existen tres— y el generador desde `.mpp` como segunda entrada. **Todo el material está construido; falta enseñarlo** |
| **F7** | **«Recursos» o se llena o se esconde** | 217 caracteres, «0 / 0 recursos» y cinco sub-pestañas detrás. Es la última vista muda. O explica qué es una hoja de recursos y de dónde salen, o sale de la barra hasta que el proyecto tenga alguno |
| F2 | Cada vista dice para qué sirve | Parcialmente hecho: Unidad Típica y Línea de Balance ya lo hacen. Falta extenderlo |
| ~~F5~~ | ~~404 con marca, en español y con salida~~ | ✅ **hecho** — ver abajo |
| ~~F1~~ | ~~Bajar de 6 pasos a 2~~ | Descartado por el usuario, en firme |

## Back of the fence — reauditado el 2026-08-08

| Superficie | 2026-08-05 | 2026-08-08 | Evidencia |
|---|---|---|---|
| **404** | ❌ Plywood puro | ✅ | «No encontramos esta página · Puede que el enlace esté mal escrito o que el cronograma que buscas se haya eliminado · **Volver a mis cronogramas**». En español, explica y ofrece salida |
| **Login** | — | ✅ | Dice que Microsoft 365 **no está disponible todavía** en vez de fingir el botón, explica a quién pedir la contraseña, y avisa de que la primera persona queda como administradora |
| Estados vacíos de vistas | ❌ | ⚠️ | Unidad Típica y Línea de Balance enseñan; **Matriz y Recursos siguen mudas** |
| Copy sin tildes | ❌ (9 cadenas) | ✅ | Detector automático ampliado a plantillas con backticks; **falla la suite si alguien lo devuelve a mirar solo comillas dobles** |
| Errores de edición | ✅ | ✅ | Sin cambios |
| Observaciones vacías | ✅ | ✅ | Sin cambios |

**El reverso de la valla mejoró de verdad**, y el detector de copy es el mejor ejemplo: dejó de ser una
limpieza puntual para convertirse en una defensa que se rompe sola si alguien la debilita.

## La reserva sobre la fila 7

La firmaría, con una condición dicha en voz alta: **el motor es firmable porque está medido**, no porque
parezca bueno. Se contrastó contra dos archivos reales —212 y 301 tareas—, sus límites están escritos con
las cifras delante, y las tres cifras que resultaron falsas se corrigieron **a la vista**, no por lo bajo.
Esa es la parte del producto de la que no hay que avergonzarse.

Lo que no firmaría es la puerta de la Matriz. Invertir 26 tareas en un cuarto y no poner un cartel es
justo el error que este supergoal se propuso erradicar.

## Camino al 10/10

Dos filas separan el 7 del 9:

- **Fila 6** (estados vacíos a la altura) → **F6 y F7**. Las dos son trabajo de una sesión y no requieren
  construir nada nuevo: el material ya existe, hay que enseñarlo.
- **Fila 2** (≤3 pasos) → **cerrada por decisión del usuario.** Con E51 descartado en firme, el techo real
  de esta app es **9/10**, no 10. Conviene decirlo en vez de perseguir un número inalcanzable.

**Con F6 y F7 hechos, esta app llega a 9/10**, que es su máximo posible mientras la cuenta siga siendo
obligatoria.
