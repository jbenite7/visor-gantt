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
| C3 | **Sacar «Diagrama Red» de la barra principal** | 207 caracteres de contenido y ningún job de CUSTOMER.md lo pide; es paridad con MS Project, no valor de obra | **Revertido 2026-08-08** — P5 le da un editor de dependencias: deja de ser paridad vacía y pasa a ser el sitio donde se dibujan las relaciones entre tareas. El motivo original —«ningún contenido»— dejó de ser cierto |
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
| De 14 vistas a 11 (C1, C2; C3 revertido) | Emocional — sobrecarga | **3** | **hecho 2026-08-08** — el menú quedó en 11 entradas; el Diagrama de Red vuelve a la barra con el editor de dependencias de P5 |
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
| C3 · Sacar Diagrama de Red de la barra | ↩️ revertido — P5 le da contenido real (editor de dependencias) |
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

### La medición que decide F7 — hecha el 2026-08-08

La pregunta era: ¿«Recursos» se **llena** con un estado vacío que enseña, o se **esconde** de la barra como
se hizo con el Diagrama de Red? Dependía de un dato que nadie tenía: si los `.mpp` reales traen recursos.
Se parsearon los tres archivos de obra del repositorio con el `mpp-parser`:

| Archivo | Tareas | Recursos **con nombre** | Asignaciones |
|---|---|---|---|
| `20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp` | 301 | **17** — «Ayudante armado», «Oficial acero»… | 449 |
| `20260530 cronograma plan de acción v1.mpp` | 1.891 | **1** — «ENCOFRADO MURO-LOSA» | 1.475 |
| `20260312 DA PORTO TORRE 3.mpp` | 240 | **0** | 213 |

**Veredicto: se llena, no se esconde.** Un tercio de los archivos reales usa la hoja de recursos en serio —17
cuadrillas y 449 asignaciones—, así que esconderla escondería una vista con contenido. Pero dos de tres
llegan vacíos, así que el estado vacío tiene que enseñar: es el caso mayoritario, no el borde.

**Cuidado con los conteos crudos:** los tres archivos traen además el **recurso nulo de MS Project** (UID 0,
nombre vacío), y DA PORTO tiene 213 asignaciones apuntando a él. Contar `resources.length` da 18, 2 y 1;
contar los que tienen nombre da 17, 1 y 0. La diferencia decide si la vista se ve vacía o con una fila en
blanco, así que la cifra que vale es la segunda.

- **Fila 6** (estados vacíos a la altura) → **F6 y F7**. Las dos son trabajo de una sesión y no requieren
  construir nada nuevo: el material ya existe, hay que enseñarlo.
- **Fila 2** (≤3 pasos) → **cerrada por decisión del usuario.** Con E51 descartado en firme, el techo real
  de esta app es **9/10**, no 10. Conviene decirlo en vez de perseguir un número inalcanzable.

**Con F6 y F7 hechos, esta app llega a 9/10**, que es su máximo posible mientras la cuenta siga siendo
obligatoria.

---

## Segunda pasada independiente — 2026-08-08

Dos revisiones en frío se hicieron el mismo día **sin conocerse**, con métodos distintos —esta segunda sobre
el `.mpp` de obra **DA PORTO TORRE 3 (240 tareas, 212 dependencias)**, no la demo— y **las dos llegaron a
7/10**. Que dos lecturas independientes converjan en la nota es mejor señal que cualquiera de las dos por
separado.

Lo que la primera no vio, porque no se puede ver sin abrir la app y tirar del hilo:

## Lo que esta revisión encontró, y nadie había visto

Cuatro defectos **vivos en producción** el día que se declaró el trabajo terminado:

1. **El aviso de columnas descartadas al importar estaba muerto por una línea.** La ruta mandaba
   `?descartadas=…` y `app/project/[id]/page.tsx` no lo leía, así que `discardedColumns` llegaba siempre
   vacío y el botón nunca se pintaba. **Las dos piezas tenían test y las dos pasaban; lo que no tenía test
   era la costura.** Corregido, con un test que ahora falla si alguien añade un parámetro y olvida leerlo.
2. **La Matriz destruía el borrador al cambiar de vista, y había un test defendiéndolo.** El editor se
   desmonta, su borrador vive en estado local, y el `cleanup` apagaba el único aviso que existía. El aviso
   cubría cerrar la pestaña —lo raro— y no cambiar de vista —lo frecuente—. Peor: un test afirmaba que eso
   estaba bien («el borrador se pierde, así que ya no hay nada pendiente»). Corregido: salir pregunta antes,
   y el test reescrito exige lo contrario de lo que defendía.
3. **Copy sin tildes y en inglés en pantallas visibles.** «Triple restriccion» en el tablero ejecutivo —la
   pantalla que más se mira— y «No hay recursos. **Click** "Agregar Recurso"». El detector de tildes no los
   veía: solo miraba literales entre comillas y plantillas, y **el texto JSX suelto no es ninguna de las
   dos**. Tercer punto ciego del mismo detector en tres revisiones distintas.
4. **`console.log("Clicked:", task.name)` en producción**, en inglés, en la página del proyecto.

Los cuatro corregidos, cada uno con un test que impide la regresión.

## Lo que sigue mal, y por qué no da más de 7

- **«De 14 vistas a 9» es contabilidad, no recorte.** El menú tiene 11 entradas, pero `tracking`, `taskSheet`
  y `network` siguen vivas tras presets y ⌘K, Recursos esconde **5 sub-pestañas** y Observaciones ganó una
  sexta. Superficies reales: **~19**, más que las ~18 que denunció la revisión anterior. La agrupación por
  intención ayuda de verdad —«Análisis» concentra lo que antes era lista plana—, pero el diagnóstico de fondo
  no está cerrado: hoy es «once puertas, tres puertas secretas, y la señal solo si pides ayuda».
- **Los estados vacíos siguen diciendo «0» en vez de enseñar.** Unidad Típica y el Ejecutivo sin datos sí
  explican; Recursos, Problemas, Curva S, Línea de Balance y Diagrama de Red no. Lo irónico: **el texto que
  lo explicaría ya está escrito** en `src/lib/gantt/viewHelp.ts`, con un campo `needs` que dice literalmente
  «Si el .mpp no traía recursos, esta vista sale vacía». Está a un `?` de distancia, en vez de en el hueco.
- **Quedan tests que pasarían con el código roto.** `src/__tests__/integration/mpp-import.test.ts:790` hace
  `currentState = "idle"; expect(currentState).toBe("idle")` —tautología pura, pasa con el parser borrado—,
  y `e2e/final-visual-audit.spec.ts:421` comprueba `expect(page.locator("body")).toBeVisible()`, que pasa con
  una pantalla en blanco o un 500.
- **La entrada sigue siendo el punto débil**, por decisión firme del usuario: 6 pasos hasta el valor frente a
  los 2 del visor 1.0. No se reabre. Pero en esa pantalla, «Entrar con Microsoft 365 no está disponible
  todavía» ocupa el mismo peso visual que el botón que sí funciona.

## Hallazgos del revisor independiente que **no** se confirmaron

Se comprueban y se descartan, para que nadie los persiga otra vez:

- **«Un proyecto guardado con la vista `conflictos` abre en blanco».** No hay camino: `UISettings` no guarda
  la vista activa, solo el preset de rol, y ningún preset apunta a `conflictos`. Se dejó `normalizeViewType`
  como red —con su test— por si algún día se persiste la vista activa, que es el cambio que lo reabriría.
- **«`ResourceAssignmentInspector.test.tsx` prueba un componente que no existe».** El nombre engaña, pero el
  archivo prueba `AssignmentSheetView` y `ResourceSheetView`, que existen y funcionan.
- **«`budgetToCSV` sigue sin botón».** Cierto, y **deliberado**: M16 está congelado por decisión del
  2026-08-06 hasta que el presupuesto venga de PDC. No es un olvido.

## Nota del revisor

La revisión anterior decía que las ocho fases habían arreglado lo que **estaba roto** y no podían arreglar lo
que **sobra**. Un año de trabajo después, en escala de días: lo roto está mucho mejor —nada se pierde en
silencio, ningún botón miente— y lo que sobra sigue sobrando, solo que ahora está mejor ordenado.

Lo que este recorrido enseña, y vale más que el número: **cuatro defectos vivos sobrevivieron a 1.400 tests
en verde, a un lint limpio y a un build correcto.** Ninguno era difícil. Todos eran invisibles desde dentro:
una costura sin probar, un test defendiendo una pérdida de datos, y copy que ningún barrido miraba. La lección
no es que falten pruebas — es que **las pruebas prueban lo que se les ocurrió a quien las escribió**, y hace
falta alguien que use el producto sin saber cómo se construyó.

**7/10.** Se pasa de «esto esconde su músculo» a «esto ya no engaña, pero todavía cansa».
