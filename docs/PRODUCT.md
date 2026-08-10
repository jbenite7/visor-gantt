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

# Revisión en frío final — 2026-08-08

**Veredicto: 7/10.** Supera el 6/10 del 2026-08-05, pero no por goleada, y el motivo de la subida no es el
recorte del menú: es que **los controles dejaron de mentir y el trabajo dejó de perderse**.

Método: build de producción en `localhost:3100`, con base de datos real y el `.mpp` de obra
**«20260312 DA PORTO TORRE 3» (240 tareas, 212 dependencias)** — no la demo de 8 tareas. Recorrido de las 11
vistas midiendo contenido, más un **revisor independiente** que auditó el código sin conocer la narrativa de
quien lo escribió. Sus hallazgos se verificaron uno a uno antes de aceptarlos: dos eran ciertos, dos no.

## Lo que mejoró, con evidencia

| Lo que decía la revisión de 2026-08-05 | Hoy |
|---|---|
| «404: plywood puro, en inglés, sin marca» | Página propia en español, con marca y salida a los cronogramas |
| «Unidad Típica: 0 sistemas repetidos» | **3 sistemas, 15 niveles** ordenados desde sótano 3, con el motor de detección de P3 |
| «Conflictos: 0 violaciones · 0 desviaciones» | **1 violación de restricción y 2 desviaciones atípicas** reales, con tabla |
| «Copiar Excel copia un CSV» | «Copiar para Excel» copia TSV —que Excel pega sin diálogo— y hay «Descargar CSV» con `;` |
| «PDF es el diálogo de impresión» | «Imprimir o PDF», y el `title` lo explica |
| «Productividad es 1/duración» | «Ritmo (1/día)», con nota de qué es y qué falta para tener productividad real |
| «La Matriz solo se llega por ⌘K» | En el menú, grupo «Trabajo» |
| «La API de Last Planner no la llama nadie» | Pestaña «Compromiso semanal» dentro de Observaciones |
| «Catorce puertas y ninguna señal» | Once, agrupadas en Trabajo · Análisis · Ajustes, con títulos de intención |

Y la paleta tolera erratas: teclear `diagrma` encuentra «Abrir Diagrama de Red».

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
