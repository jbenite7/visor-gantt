# Supergoal «Cerrar el backlog de UX» — diseño

> **BORRADOR.** Las secciones marcadas 🔎 esperan el inventario de módulos en curso, y las marcadas ❓
> esperan una decisión del usuario. No es ejecutable hasta que ambas se cierren.

Fecha: 2026-08-06. Origen: los 27 experimentos que quedaron vivos en [EXPERIMENTS.md](../../EXPERIMENTS.md)
tras entregar el plan anterior, más el inventario funcional completo que el usuario pidió añadir.

## Problema

El plan anterior entregó 27 mejoras y cerró los seis hallazgos de severidad 4. Pero la auditoría de nueve
fases encontró más de lo que decidimos ejecutar: **quedan 27 experimentos vivos**, y hay módulos enteros de
la app que ninguna fase revisó a fondo (Curva S, Línea de Balance, Recursos y sus sub-pestañas, Presupuesto,
Líneas base, Exportaciones).

La revisión en frío dio **NOT DONE (6/10)**. Bajó de 14 a 9 vistas, pero su diagnóstico de fondo sigue en
pie: la app tiene músculo y lo esconde.

## Alcance

**Dentro:** los 27 experimentos vivos, agrupados en tres bloques, más lo que salga del inventario funcional.

**Fuera, y por qué:**
- **E51** (abrir un `.mpp` sin cuenta) — descartado en firme por el usuario el 2026-08-06. No reabrir.
- **E47** (medición de campo) — necesita usuarios reales, no código.

## Estructura

Un objetivo paraguas en `goals/cerrar-backlog-ux/goal.md`, siguiendo la convención del repo, y **tres
bloques** con spec y plan propios, diseñados cuando les toca — para que lo aprendido en uno mejore el
siguiente. Orden decidido: **Entrada → Tabla → Pulido**.

Cada bloque termina desplegable: si se para entre bloques, la app queda coherente.

## Bloque 0 — Poner el backlog al día (previo, corto)

Tres experimentos están hechos a medias sin que nadie los marcara. Antes de planificar sobre el backlog hay
que verificar qué falta de cada uno y cerrarlos:

| # | Estado real | Qué falta |
|---|---|---|
| E17 | `ViewSwitcher` borrado | `MPPUploader` sigue muerto y sin borrar |
| E14 | «Cuellos» → «Problemas» hecho | Agrupar las vistas (pasa al Bloque C) |
| E21 | Tildes unificadas en parte | Barrido completo (pasa al cierre) |

## Bloque A — La entrada

Decisiones tomadas en el grilleo (34 preguntas, 2026-08-06):

| Qué | Decisión |
|---|---|
| Error de login | Conservar el correo escrito y mostrar el error **bajo el campo**, no como cartel. Se retira de paso el mensaje por URL, que hoy es falsificable |
| Contraseña olvidada | Texto que dirige al administrador del proyecto. No se monta recuperación por correo: sería un proyecto propio |
| Sesión expirada | Volver al proyecto que se iba a abrir **y** explicar por qué se salió |
| Errores del analizador | Mensaje humano con causa probable; el detalle técnico solo al registro del servidor |
| Límite de 50 MB | Anunciado junto al botón, con el formato aceptado |
| Pérdidas en la importación | Avisar en el resumen **y** poder ver qué columnas se descartaron |

## Bloque B — Tabla y Gantt

| Qué | Decisión |
|---|---|
| Fecha de fin | Editarla **cambia la duración**, como MS Project ❓ (ver Riesgos) |
| Filas de resumen | Solo lectura, en gris |
| Texto en campo numérico | Rechazar explicando; nunca convertir a `0` en silencio |
| Celda editable | Señal al pasar por encima **y** entrada en edición con teclado (Enter/F2) |
| Columna Predecesoras | Mostrar el dato; el control aparece al interactuar |
| Tiradores de las barras | Visibles al pasar por la barra o al seleccionarla |
| Arrastre | La sombra salta por días igual que el resultado, **y muestra la fecha destino** |
| Tipo de vínculo | Anunciado durante el arrastre |
| Impacto de una edición | Resaltar las afectadas **y** dar el recuento |
| Cambios de calado | Avisar cuando cambia el fin de obra **y** cuando cambia la ruta crítica |
| Edición rechazada | Marcar las tareas en conflicto **y** enlazar a la vista Problemas |
| Modo Simple/Avanzado | Que cumpla lo que promete; Simple por defecto ❓ (ver Riesgos) |

## Bloque C — Pulido

| Qué | Decisión |
|---|---|
| Menú de vistas | Agrupado en **Trabajo · Análisis · Ajustes**, con títulos |
| Paleta de comandos | El atajo `⌘K` visible en el botón |
| Cinta de iconos | Agrupada con separadores y etiquetas al pasar |
| Filtro activo | Chip removible **con contador de tareas ocultas** |
| Filtro sin resultados | Mensaje con botón para quitar el filtro |
| Dependencias filtradas | La tarea oculta se muestra atenuada si algo visible depende de ella |
| Agregar / Eliminar | Separador entre ambos y etiqueta de texto en el destructivo |
| Deshacer / Rehacer | Siempre visibles; apagados cuando no aplican |
| Borrado en la matriz | Separado de los de crear **y deshacible** |
| Abrir un proyecto | Esqueleto de tabla y gantt mientras carga |
| Edición aceptada | Destello sutil en la celda |
| Niveles WBS | Corregir el desfase de la etiqueta y usar siempre botones |

## Bloque D — Módulos sin auditar

Tres exploraciones inventarían ~16 módulos que ninguna fase revisó a fondo. **Análisis: recibido.**
Recursos/costos y transversales: 🔎 en curso.

### D1 · Análisis (recibido 2026-08-06)

Lo bueno primero, porque condiciona las decisiones: **Curva S, Línea de Balance y Unidad Típica tienen
estados vacíos ejemplares** —explican qué falta y dan un ejemplo concreto— y su lógica vive separada del
componente y con tests. No son islas mal hechas; son módulos sólidos con remates pendientes.

Hallazgos que sí merecen decisión:

| # | Módulo | Hallazgo | Gravedad |
|---|---|---|---|
| M1 | Ejecutivo | Con **cero tareas** el semáforo marca «Controlado» en verde: SPI y CPI valen 1 por defecto. Un directivo puede leer «todo bien» de un proyecto vacío | **Alta** — informa mal en la pantalla que más se mira |
| M2 | Unidad Típica | «Productividad» es literalmente `1 / duración`, etiquetado **«unidades/día»** sin que exista ninguna cantidad de obra. La etiqueta promete algo que el número no es | **Alta** — dato engañoso |
| M3 | Ejecutivo | No muestra **fecha de corte**: no se sabe a qué día corresponden el SPI y el CPI | Media |
| M4 | Diagrama de Red | **Sin leyenda**: rojo, rombo y borde grueso no se explican en ninguna parte | Media |
| M5 | Diagrama de Red | Las **dependencias circulares se descartan en silencio**, solo con un aviso en la consola del navegador | Media |
| M6 | Curva S · LOB · Unidad Típica · Red | **Sin exportar ni imprimir**, mientras el Ejecutivo sí tiene Copiar/CSV/PDF. Incoherente dentro del mismo producto | Media |
| M7 | LOB | El contador de cuellos existe pero **arranca apagado**: quien no pulse el botón nunca sabe que hay cuellos detectados | Media |
| M8 | Ejecutivo | El semáforo de avance nunca llega a «crítico», aunque cronograma y costo sí | Baja |
| M9 | LOB | El umbral de desviación crítica (20%) no se explica ni se puede ajustar | Baja |
| M10 | LOB | Avisa de clasificaciones ambiguas pero **no deja corregirlas** desde la interfaz | Baja |
| M11 | Unidad Típica | El mínimo de «3 niveles» no se explica ni se configura: dos torres de 2 niveles nunca aparecen | Baja |
| M12 | Curva S | Los props `xLabel`/`yLabel` existen pero **nunca se pintan**: los ejes no dicen sus unidades | Baja |

### D2 · Recursos y costos (recibido 2026-08-06)

La pestaña «Recursos» esconde **cinco sub-pestañas** (Hoja, Uso, Asignaciones, Presupuesto, Mapeo). Las
líneas base no están ahí: viven en la barra principal **y**, duplicadas, dentro de Seguimiento.

| # | Módulo | Hallazgo | Gravedad |
|---|---|---|---|
| M13 | Líneas base | **Dos sistemas desconectados.** El botón «Línea base» de la barra principal guarda y selecciona, pero **nunca dibuja la comparación en el Gantt**: solo cambia una etiqueta del desplegable. La comparación real (barras fantasma, variaciones) existe únicamente dentro de Seguimiento, con su **propio estado local que no se guarda ni se comparte**: se pierde al cambiar de vista o recargar | **Crítica** — el control más visible no hace lo que promete, y el que funciona pierde el trabajo |
| M14 | Asignaciones | **Sin crear, editar ni borrar.** Solo llegan importadas de un `.mpp`. Quien arme un proyecto desde cero en la app tendrá esta pestaña vacía para siempre, aunque tenga tareas y recursos | **Alta** — bloquea el caso «armar el proyecto en la app» |
| M15 | Presupuesto | Es una **isla salvo que uses Mapeo**: la curva S de valor ganado y el dashboard ejecutivo leen los mapeos, no las partidas. Sin mapear, cargar presupuesto no afecta a nada, y el nombre sugiere lo contrario | **Alta** |
| M16 | Presupuesto | **Exportar CSV está implementado pero sin botón**: `budgetToCSV` existe y nadie lo llama. Arreglo de una línea | Media |
| M17 | Presupuesto | El import de CSV **normaliza categorías desconocidas a «Otro» y descarta filas inválidas en silencio**; la función de validación existe pero no se usa en ese flujo | Media |
| M18 | Uso de Recursos | **Dos definiciones de «sobreasignado»**: esta vista usa un umbral semanal propio; Problemas usa uno diario distinto. Dos pestañas pueden contradecirse | Media |
| M19 | Asignaciones | La lógica de sobreasignación existe, pero **no se ve aquí**: hay que ir a Problemas para enterarse | Media |
| M20 | Mapeo | **No se puede editar el monto** de un mapeo: hay que borrarlo y rehacerlo | Baja |
| M21 | Mapeo | Nada impide que lo mapeado **supere el presupuesto** de la partida, inflando en silencio el costo que ven la curva S y el dashboard | Media |
| M22 | Líneas base | El import de `.mpp` **nunca trae las líneas base** que el archivo ya tenía en MS Project | Media |
| M23 | Hoja de Recursos | Borrar un recurso **no avisa si tiene asignaciones activas**; sin export propio | Baja |

### D3 · Transversales (recibido 2026-08-06)

| # | Módulo | Hallazgo | Gravedad |
|---|---|---|---|
| M24 | Observaciones | **No disparan el autoguardado.** `observations` falta en las dependencias del efecto temporizado (`GanttView.tsx:1199-1210`). Anotar, atender o borrar una observación no guarda por sí solo: solo persiste si el usuario pulsa «Guardar ahora», toca otra cosa que sí dispare el temporizador, o abandona la vista de forma limpia. Un cierre de pestaña o recarga dura **pierde lo anotado** — y es el loop que el propio código documenta como «lo que hacía valioso al visor 1.0» | **Crítica** — pérdida de datos |
| M25 | Exportaciones | **«Copiar Excel» copia un CSV** al portapapeles, y **«PDF» es el diálogo de impresión** del navegador. No hay ninguna librería de Excel ni de PDF en el proyecto. Quien espere un `.xlsx` o un PDF con membrete no lo obtiene | **Alta** — los botones prometen lo que no dan |
| M26 | Last Planner | La **API de integración está completa y probada** (`api/integrations/last-planner/preview`), genera compromisos semanales con restricciones… y **ningún componente la llama**. Construida e inalcanzable desde el producto | **Alta** |
| M27 | Matriz | **No está en el menú lateral**: solo se llega por `⌘K`. Quien no conozca el atajo no sabe que el módulo existe | **Alta** |
| M28 | Matriz | Cambios del borrador **se pierden sin aviso** al cambiar de pestaña o recargar; «Deshacer» descarta todo el borrador sin decir cuánto | Media |
| M29 | What-If | Se llama «Escenario» pero **solo simula la duración de una tarea**: sin escenarios múltiples, sin guardar, sin nombrar. El nombre promete mucho más | Media |
| M30 | Asistente y What-If | Escondidos en un desplegable de la barra, sin acceso desde el menú ni la paleta | Media |
| M31 | Exportaciones | El export del cronograma **no incluye las observaciones**, y estas solo se exportan desde el panel de una tarea | Media |
| M32 | Observaciones | El CSV de Last Planner tiene columna **«Responsable» que siempre sale vacía**: no se pide al crear la observación | Media |
| M33 | Autoguardado | **Sin aviso al cerrar** con cambios pendientes: el guardado es por temporizador, así que un cierre rápido tras editar pierde lo último | Media |
| M34 | Calendario | Ver y editar están en **dos pestañas distintas**: no se puede marcar un festivo desde el calendario | Baja |
| M35 | Calendario | La vista muestra **máximo 3 tareas por día** sin forma de ver el resto | Baja |
| M36 | Paleta de comandos | Sin coincidencia difusa: un error de tecleo y no encuentra nada. Faltan comandos de exportación y de Configuración | Baja |

### Decisión sobre los bugs de pérdida de datos (2026-08-06)

M24 (observaciones sin autoguardado) y M13 (líneas base desconectadas) **entran en el plan como primeras
tareas, con máxima prioridad**, en vez de parchearse aparte. Decisión del usuario.

**Riesgo asumido, dicho una vez:** hasta que esas tareas se ejecuten, anotar una observación y cerrar la
pestaña puede perder lo escrito. Si alguien va a usar la app en obra antes de entonces, conviene avisarle de
que pulse «Guardar ahora» tras anotar.

### Decisión sobre el presupuesto (2026-08-06)

Se planteó deprecarlo por estar «cubierto en el PDC V2 de lps-aia». **Validado: la premisa era falsa.**
PDC V2 existe y está activo, pero es un módulo de **plan de compras**: importa un presupuesto de SINCO y lo
lee (importar, ver en árbol, comparar versiones), sin crear ni editar, y **sin comparación de presupuestado
contra ejecutado, sin valor ganado y sin curva S de costo real**. Su única curva es de desembolsos futuros
de contratación. El propio glosario del repo separa los roles: PDC es suministros; control de costos es
Oficina Técnica.

**Decisión: el presupuesto se mantiene en visor-gantt y pasará a alimentarse del presupuesto que PDC ya
importa de SINCO**, en vez de cargarse a mano aquí.

**Consecuencia, dicha una vez:** eso es una **integración entre dos aplicaciones**, no un arreglo de UX.
Necesita su propio diseño (qué canal, quién manda sobre los datos, qué pasa al reimportar en PDC). Por
tanto:

- Sale del alcance de este supergoal y queda anotado como **el proyecto siguiente**.
- Mientras tanto, **no se invierte en pulir la carga manual** (M16 exportar sin botón, M17 import CSV
  silencioso, M20 editar mapeo): se rehará cuando cambie la fuente. Congelados, no descartados.
- **Sí se mantiene M15** (avisar de cuánto presupuesto está sin vincular) y **M21** (avisar cuando lo
  vinculado supera la partida): valen igual venga el dato de donde venga, y evitan cifras infladas en el
  tablero ejecutivo.

## Panorama del inventario

**36 hallazgos en 16 módulos.** Dos de pérdida o corrupción de datos (M24 observaciones, M13 líneas base),
y un patrón que se repite: **funciones construidas que nadie puede alcanzar o que no hacen lo que su nombre
dice.** La API de Last Planner, el export de presupuesto, la comparación con línea base, la Matriz fuera del
menú, «Excel» que es CSV, «PDF» que es imprimir, «Escenario» que es un campo de duración, «Productividad»
que es el inverso de la duración.

Eso cambia la naturaleza del supergoal: no es solo pulir 27 pendientes, es **decidir qué de lo ya construido
se conecta, se renombra o se retira**.

## Cierre

1. **Barrido único de limpieza**: tildes, código muerto (`MPPUploader`), roles ARIA. Agrupado al final para
   que no ensucie los diffs de los bloques de fondo.
2. **Revisión en frío** de toda la app, como la que dio 6/10, para saber si mejoró de verdad y no solo si
   se acabó la lista.

## Cómo se construye

- **TDD estricto**: test primero, verlo fallar, código mínimo.
- **Ayudantes por tarea con revisión independiente**, más una revisión final del conjunto — el método que
  en el plan anterior cazó un test borrado en silencio, una vista huérfana y tres fallos que solo existían
  en la unión de piezas.
- Verificación por bloque: suite completa, lint, tipos, build y comprobación en navegador.

## Riesgos ❓ (pendientes de decisión del usuario)

**1. «Editar el fin cambia la duración» toca el motor de cálculo, no la interfaz.** Es la decisión de más
riesgo del grilleo. En MS Project esa regla convive con restricciones y calendarios; aquí hay que definir
qué pasa si el fin cae en día no laboral o si una dependencia lo impide. Propuesta: tarea propia con tests
exhaustivos y **salida degradada** a solo lectura si el motor no lo soporta limpiamente.

**2. «Simple por defecto» cambia la app a quien ya la usa.** Un planificador que hoy tiene todo a la vista
abriría mañana una app recortada. Propuesta: **Simple solo en la primera visita**, y después la app recuerda
la elección.

## Criterio de hecho

Los 27 experimentos **cerrados o descartados con un motivo escrito** — nada en el limbo — más lo que el
inventario añada, y la revisión en frío final ejecutada con su veredicto registrado.
