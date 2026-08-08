# Supergoal «Cerrar el backlog de UX» — diseño

> **103 decisiones de grilleo (2026-08-06).** Inventario de 16 módulos completo.
> ⚠️ **El alcance resultante excede con mucho el de un supergoal de UX** — ver «Magnitud real» al final.

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
| Fecha de fin | Editarla **cambia la duración**, como MS Project. Tarea propia con tests; si el motor no lo soporta limpiamente, degrada a solo lectura y se informa |
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
| Modo Simple/Avanzado | Que cumpla lo que promete. **Simple por defecto solo en la primera visita**; después la app recuerda la elección |

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

Tres exploraciones inventariaron **16 módulos** que ninguna fase había revisado a fondo, con **36 hallazgos**
(M1-M36). Los tres informes están incorporados abajo.

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

### Decisiones del Bloque D (grilleo del 2026-08-06)

**Observaciones** — el flujo diferencial del producto:
- Se guardan **al instante**, sin esperar al temporizador: una anotación es un acto único, no hay nada que agrupar.
- Se pide **responsable** al anotar, opcional: sin él, el CSV de Last Planner exporta una columna vacía y una restricción sin responsable no compromete a nadie.
- **Vista propia en el menú** con todas las observaciones del proyecto y su exportación, como tenía el visor 1.0.

**Líneas base** — un solo sistema:
- Las del proyecto son las únicas; Seguimiento deja de tener las suyas. **Y el Gantt principal también dibuja** la comparación, para que el botón haga lo que promete donde se pulsa.
- Se pueden **nombrar al guardar y borrar**.
- No se importan las del `.mpp`: se empieza en limpio.

**Exportaciones**:
- «Copiar Excel» y «PDF» **se renombran a lo que son** ahora; generar `.xlsx` y PDF reales queda anotado como mejora futura con diseño propio.
- La **API de Last Planner se conecta a la app**: está construida y probada, y hoy no le sirve a nadie.
- El export del cronograma pasa a ser **CSV de verdad**, con el separador correcto para configuración regional española.

**Tablero ejecutivo**:
- Con cero tareas muestra **«aún no hay datos»**, no un semáforo verde.
- Muestra la **fecha de corte**.
- Cada indicador **lleva a su detalle** (los cuellos abren Problemas, el avance abre el Gantt).

**Asignaciones y recursos**:
- Se pueden **crear y borrar asignaciones**, y además **asignar desde la propia tarea** en el Gantt.
- La **sobreasignación se ve en la tabla** y se avisa **al crear** una que sobrecargue.
- **Una sola definición** de «sobreasignado» compartida por todas las vistas.

**Matriz**:
- **Vuelve al menú**, dentro de «Trabajo».
- **Avisa antes de salir** con cambios sin aplicar.
- «Deshacer» se renombra a **«Descartar cambios» con confirmación** ahora, y se convierte en un deshacer paso a paso como objetivo.

**Guardado**:
- **Aviso al cerrar** solo si hay algo pendiente.
- «Reintentar» pasa a ser **un botón de verdad**.

**What-If**: se amplía a **escenarios reales** (varios cambios, con nombre y guardado). Ver Riesgos.

**Análisis**:
- **Imprimir en los cuatro** módulos (Curva S, Línea de Balance, Unidad Típica, Diagrama de Red), uniforme con el ejecutivo.
- «Productividad» se renombra a **«Ritmo (1/día)»**; se calculará productividad real **cuando haya cantidades de obra**.
- Diagrama de Red: **leyenda visible** y los **ciclos de dependencias se avisan en pantalla**, no solo en la consola.

**Menores cerrados con criterio del asistente** (aprobado en bloque): cuellos de LOB encendidos por defecto;
semáforo de avance que llega a crítico; umbral del 20% explicado en la leyenda; clasificación ambigua
corregible; mínimo de 3 niveles explicado; ejes de la Curva S con unidades; aviso al borrar un recurso con
asignaciones más export de la hoja; festivos marcables desde el calendario; días del calendario desplegables;
paleta con búsqueda tolerante a erratas y comandos de exportación y configuración.

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

## Bloque E — Programación matricial (10 decisiones)

El módulo más potente y el peor conectado. Decisiones:

| Qué | Decisión |
|---|---|
| Ritmo piso a piso | Generar **dependencias reales** entre ubicaciones, **configurable por alcance** (estructura encadena; acabados de torres distintas pueden ir en paralelo). Hoy es un desfase fijo: si el piso 1 se atrasa, el 2 no se mueve |
| Calendario | La matriz usa el **calendario del proyecto** (festivos, jornada), no su propio «salta domingos». Y avisa si al aplicarlo las fechas se desplazan mucho |
| Plantillas | Plantillas de fábrica por tipo de obra **y** poder guardar la tuya. Además, **generador de plantillas a partir de un `.mpp` cargado**: propone alcances, ubicaciones, recetas y rendimientos, y tú revisas antes de aceptar |
| Recetas | **Editor completo**: añadir, quitar y reordenar actividades, y definir cómo se encadenan |
| Rendimiento observado | **Panel para aprobar** los rendimientos reales que la app ya calcula y hoy nadie ve. Cierra el ciclo: la próxima torre se programa con los datos de la anterior |
| Conflictos al aplicar | **Mostrarlos y elegir cuál gana**, tarea por tarea. Hoy se detectan, se descartan y se resuelve en silencio con «gana el más reciente» |
| Duplicar | Duplicar ubicación o alcance con sus celdas **y crear N ubicaciones de golpe** («pisos 1 a 20») |
| Edición en lote | **Seleccionar varias celdas** (o fila/columna) y aplicarles receta, cantidad o activación |
| Escala | Debe aguantar **más de 1000 celdas**: dejar de recalcular en cada tecla y dibujar solo lo visible |

## Bloque F — Motor de detección (2 decisiones)

El motor que reconoce piso y sistema en los nombres de tarea falló en **44 de 239 tareas** de un archivo real.
PDC V2 tiene dos piezas mejores, medidas: 820 filas, 2 sin resolver.

- **Portar ambas ideas a visor-gantt**, dejando preparada la opción de llamarlo por API más adelante: su
  extractor de ubicación (cubre `Etapa`, `Zona`, `Sector`, `Tramo`, `mezanine`, códigos `P01`/`S1` y
  **sótanos como negativos** para poder ordenarlos) y su **cascada**: diccionario → nombre exacto → similitud.
- **Diccionario que se llena con las correcciones del usuario**, probado antes que el automático. Su código
  documenta por qué: el emparejamiento ingenuo por nombre acierta **1 de 820** en este dominio, y el texto
  engaña («carpintería metálica» se parece a «carpintería en madera» y no son lo mismo).

## Bloque G — Módulos analíticos (25 decisiones)

**Tablero ejecutivo**: capas desplegables en la misma pantalla con enfoque de *data storytelling*; titular en
lenguaje llano **y** el índice técnico debajo; flecha de tendencia **y** minigráfica de evolución; al ponerse
en rojo, explica la causa, enlaza al detalle **y** avisa del cambio de estado.

**Curva S**: las tres pestañas importan por igual; el avance real sale de lo reportado **y** se admiten curvas
por tipo de actividad; **fecha de corte seleccionable con los cortes marcados** en el gráfico; **proyección
con escenarios optimista y pesimista**; detalle por punto **y** comparación contra línea base.

**Línea de Balance**: mejorar la detección **y** poder asignar ubicación a mano; la línea real sale del avance
reportado; **avisar de choques y esperas, y proponer cómo resolverlos**; umbral del 20% explicado y ajustable;
las correcciones de clasificación **se recuerdan**.

**Unidad Típica**: sirve para las tres cosas (comparar rendimiento, validar coherencia y fijar ritmo objetivo);
**destacar el piso anómalo y ofrecer gráfico por sistema**; mínimo de niveles explicado y bajable a 2; saltar
al Gantt **y** ver el detalle sin salir; cantidades desde la matriz **y** capturables sin ella.

**Diagrama de Red**: inversión alta — leyenda, aviso de ciclos en pantalla, filtro de ruta crítica, búsqueda,
**minimapa**, panel de detalle **y creación de dependencias arrastrando**. Sin reorganización manual: la
posición automática significa el orden lógico y moverla lo rompería.

## Magnitud real ⚠️

Este documento empezó como «cerrar 27 pendientes de UX». Tras 103 decisiones contiene, entre otras cosas:
un editor de recetas, un generador de matrices desde `.mpp`, un motor de detección nuevo con diccionario que
aprende, escenarios What-If reales, proyección con escenarios en la Curva S, un tablero por capas con
historial de cortes, virtualización para 1000+ celdas, dependencias reales piso a piso, un editor de
dependencias en el diagrama de red, alta de asignaciones con avisos de sobrecarga, una vista de observaciones
y la unificación de líneas base.

**Eso no es un supergoal de UX: es la hoja de ruta de un producto.** Intentarlo como un solo plan produciría
un documento irrevisable y un frente de trabajo que tardaría meses en dar algo desplegable.

La estructura por bloques desplegables sigue siendo válida, pero el número de bloques y su tamaño deben
decidirse antes de escribir plan alguno. Ver la propuesta de partición presentada al usuario el 2026-08-06.

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

## Riesgos

**1. «Editar el fin cambia la duración» toca el motor de cálculo.** Es lo de más riesgo del supergoal. Va
como tarea propia con tests exhaustivos y **salida degradada**: si el motor no lo soporta limpiamente
(restricciones, días no laborales, dependencias que lo impiden), se deja en solo lectura y se informa en vez
de forzarlo.

**2. Ampliar What-If a escenarios reales es una función nueva, no un arreglo.** Varios cambios a la vez, con
nombre y guardado. Se diseña dentro del Bloque D con su propio alcance; si crece demasiado, se parte.

**3. Alimentar el presupuesto desde PDC es una integración entre aplicaciones.** Fuera de este supergoal,
anotado como el proyecto siguiente (ver decisión sobre el presupuesto).

## Criterio de hecho

Los 27 experimentos **cerrados o descartados con un motivo escrito** — nada en el limbo — más lo que el
inventario añada, y la revisión en frío final ejecutada con su veredicto registrado.
