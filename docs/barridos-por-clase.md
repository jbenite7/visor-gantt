# Barridos por clase de defecto

*2026-08-11. Escrito porque trabajé sin la lista de hallazgos de la auditoría y tuve que
encontrarlos yo. Esto es el mapa que me habría ahorrado el día.*

## Por qué existe este documento

La sesión que coordinaba me pasó cuatro hallazgos concretos y dijo que quedaban 18 más. Esa
lista no estaba en el repositorio y la sesión dejó de ser alcanzable. En vez de parar, barrí
**por clases de defecto**: en lugar de buscar «el hallazgo número 7», busqué «todos los sitios
donde puede repetirse este tipo de error».

Funcionó mejor de lo esperado —doce hallazgos— y produjo algo que una lista no da: **guardianes
que cierran la clase entera**, no el caso concreto.

Y produjo algo igual de útil: **doce clases que salen limpias**, medidas y anotadas. Saber dónde
*no* está el problema vale tanto como saber dónde está, y evita que la siguiente sesión repita el
barrido. Cuatro de esas doce se cerraron midiendo la base entera —297 proyectos— en vez de leer
código: sin ids repetidos, sin dependencias huérfanas, sin cronogramas que desborden la pila.

## El método, y la lección que costó tres vueltas

**Medir los datos, no razonar sobre el código.**

Perdí dos intentos con el eje de la Línea de Balance. El primero afirmó un desfase con una
«prueba» que usaba una fecha que ese código nunca produce. El segundo se retractó por completo,
basándose en cómo se construyen las marcas. **Los dos estaban mal.** El tercero acertó porque
consultó la base: 66.550 fechas revisadas, 2.432 en la franja peligrosa, 1.185 de ellas del
`.mpp` real de obra.

Un razonamiento sobre el código describe lo que el código *debería* hacer. Los datos dicen lo
que *hay*.

## Clases barridas

| Clase | Resultado |
|---|---|
| Errores descartados (`if (!result.success) return`) | limpio |
| Manejadores vacíos (`onClick={() => {}}`) | limpio |
| Resultados de acciones que nadie mira | limpio |
| `console.log` en producción | limpio |
| Botones desactivados para siempre | limpio |
| Botones sin nombre accesible | limpio *(tras afinar la heurística: la primera versión daba 23 falsos positivos)* |
| Props recibidas y nunca usadas | limpio |
| `new Date("AAAA-MM-DD")` en producción | limpio |
| **Componentes que nadie importa** | 1 — `ErrorDisplay`, retirado |
| **Acciones de servidor sin llamador** | 1 — plantillas de matriz, guardaban solo en memoria |
| **Promesas que el código no cumple** | 2 — foto de importación, portada de Recursos |
| **Constantes duplicadas** | 2 — tope de subida (×5), plazo de caducidad (×2) |
| **Formateadores duplicados** | 5 copias de fechas, en 2 grupos incompatibles |
| **Lógica que depende de leer un texto** | 2 — botón de recargar, línea real vs planificada |
| **Tokens de color inexistentes** | 2 — uno con reserva, otro sin ella |
| **Cálculos con la fuente equivocada** | 2 — diagnóstico de curva S, eje de Línea de Balance |
| Ordenaciones inestables | limpio — el único `.sort()` sin comparador es una clave de comparación, y es determinista |
| Desbordamiento de pila en `Math.max(...)` | limpio — el cronograma mayor tiene **494 tareas**; el spread revienta a las 125.000 |
| Identificadores de tarea repetidos | limpio — 297 proyectos, ninguno |
| Dependencias huérfanas | limpio — 297 proyectos, ninguna |
| **Escuchas de eventos sin retirar** | 1 — `SplitPane` dejaba dos por cada arrastre, para siempre |
| Claves de lista por índice | limpio — las siete son texto sin estado propio y sin reordenarse |
| Escuchas sobre `AbortSignal` | limpio — el `signal` muere con su petición; no hay nada que retirar |
| Enlaces externos sin `rel="noopener"` | limpio |
| **Campos de formulario sin nombre accesible** | 16 arreglados en las dos tablas editables; 9 quedan en otros seis ficheros |

## Guardianes que quedan puestos

Todos probados **rompiéndolos a propósito**; ninguno se dio por bueno naciendo verde.

| Guardián | Qué impide |
|---|---|
| `componentesAlcanzables` | que se construya un componente que nadie puede usar |
| `enlacesInternos` | que un enlace apunte a una ruta que no existe |
| `todasLasAccionesAutorizan` | que una acción toque la base sin comprobar sesión |
| `limitesUnaSolaVez` | que un número que el usuario ve se escriba dos veces |
| `clienteSinServidor` | que una pantalla arrastre `node:crypto` al navegador |
| `coloresDelSistema` | colores a mano, y tokens que no existen |
| `fechaDeCorteLlega` | que un eslabón deje de pasar la fecha de corte |
| `projectViewWiring` | que un dato de `ProjectData` no llegue a la pantalla |
| `check-empty-suites` | que un `describe.skip` apague un fichero en silencio |

**Cómo se encontró la fuga de escuchas, porque el método sirve para más cosas:** contar
`addEventListener` frente a `removeEventListener` por fichero y por tipo de evento. Salieron 27
contra 24, y las tres de diferencia con nombre. Dos resultaron correctas —viven en un
`AbortSignal` que muere con su petición— y una era real. **Contar antes de leer** acota la
búsqueda a tres sitios en vez de veintisiete.

## Preguntas abiertas, medibles, que no pude cerrar

**1. Los recursos del `.mpp` real.** El archivo de obra produce 240 tareas, **0 recursos y 213
asignaciones**, todas con `resourceId: 0`. 88 de 297 proyectos están igual. El `.mpp` trae
`ASSIGNMENT_RESOURCE_GUID` pero ningún identificador numérico, y el importador solo busca cuatro
nombres de campo.

No toqué el importador: para saber si el archivo trae recursos **sin nombre** —que el importador
descarta— o no trae ninguno, hay que correr el analizador contra el archivo. Arreglarlo a ciegas
sería inventarse datos de una obra real. **Quien tenga el `.mpp` delante puede cerrarlo en diez
minutos.**

**2. Las vistas autenticadas, sin revisar en navegador.** Los mejores hallazgos de esta semana
salieron de mirar la app funcionando. No pude: la cookie de sesión es `httpOnly` y no se inyecta
desde JS, y no escribo contraseñas en formularios. Hace falta otra vía —una sesión ya abierta, o
un modo de prueba— para revisar Gantt, Matriz, Ejecutivo y Cortes con datos reales.

*Cerrada a medias, y dio fruto enseguida.* La ruta pública `/ver/<token>` monta **el mismo Gantt
sin pedir sesión**, así que sirve de mirador: se le pone un `share_token` a una copia del
cronograma de obra real y se navega como visitante. Con eso salieron los dos hallazgos de la
sección siguiente. No cubre lo que solo existe con cuenta —guardar, adoptar, listar—, pero sí las
once vistas de análisis.

**3. Nueve campos sin nombre accesible**, repartidos en `MatrixEditorView`, `GanttTable`,
`DependencyPopover`, `DependencyPanel`, `SnapshotsBoardView` y `EditableCell`. Arreglé los 16 de
las dos tablas editables —donde estaban concentrados— y dejé estos porque cada uno necesita mirar
su contexto para darle un nombre que signifique algo, y ponerle una etiqueta genérica sería
cambiar «campo mudo» por «campo que miente».

**Aviso sobre la medición:** la heurística que los cuenta es frágil. Con una ventana de 400
caracteres decía 33 e incluía la página de login, cuyos campos **sí** están dentro de un
`<label>`; con 2.500 dijo 25. Verifiqué a ojo antes de tocar. Quien siga: comprobar la muestra
antes de arreglar en bloque.

**4. Dos rarezas del `.mpp` real, de una tarea cada una:** un resumen sin hijos y un hito con
duración mayor que cero. Poco alcance; sin comprobar cómo los dibuja el Gantt.

**5. Las migraciones no levantan una base nueva.** El migrador está bien montado —una transacción
por migración con `ROLLBACK`, `pg_advisory_lock` para que dos instancias no la apliquen a la vez,
y las seis son idempotentes, comprobado ejecutándolas dos veces—. Pero **cuatro de las seis fallan
en una base virgen**: 002, 003, 005 y 006 dan `relation "projects" does not exist`, porque las
tablas base no las crea ninguna migración. La función que las crearía, `ensureProjectsTable`, **no
la llama nadie**, y además crearía `projects` con `id UUID` cuando la real es `integer`.

*Medido, no leído:* base virgen, las seis migraciones una a una.

**No afecta al despliegue sobre la base actual**, que ya tiene las seis aplicadas y las cuatro
tablas base. Afecta a una instalación nueva, que hoy no arranca sola. No lo arreglé porque decidir
cómo se crea el esquema base —y con qué tipo de `id`— es un contrato, no un detalle: queda
consultado.

## Lo que se vio al mirar la app funcionando

Dos hallazgos, los dos de la clase «la app promete algo que no cumple», los dos **invisibles
leyendo el código** porque cada pieza por separado estaba bien.

**1. El enlace público entregaba media app.** `/ver/<token>` monta el Gantt entero, con su barra
lateral: Recursos, Matriz, Presupuesto, Curva S. Pero la página solo le pasaba **las tareas y el
calendario**. El visitante abría esas pantallas, las veía vacías y concluía que el cronograma
venía sin esos datos. La base los tenía: el proyecto de obra trae 213 asignaciones y su
presupuesto. Arreglado entregando **el proyecto entero** en vez de elegir campos — no es solo un
arreglo, es quitar el sitio donde olvidarse.

El guardián `projectViewWiring` no lo vio porque **solo miraba la página con sesión**. Ahora cubre
las dos puertas. Lección: un guardián que comprueba «el camino» tiene que saber cuántos caminos
hay.

**2. El 404 del enlace hablaba con otra persona.** Ofrecía «Volver a mis cronogramas», que lleva
al listado y por tanto al login. Quien abre un enlace compartido no tiene cuenta ni la pidió. Y la
causa probable ahí no es un enlace mal escrito sino que **caducó a los siete días**; no decirlo
hace pensar que le borraron el cronograma.

## Dos errores míos de este día, para que no se repitan

**Rompí el build y lo fusioné.** Encadené `build && merge` en un solo comando y no leí la salida.
`main` estuvo sin compilar unos minutos. La suite no lo cazaba porque Jest corre en Node, donde
`node:crypto` existe. Desde entonces: verificación y fusión, en comandos separados.

**Deshice una mutación con `git checkout --`** y me llevé por delante un arreglo sin commitear.
Las mutaciones se deshacen con la copia del fichero, nunca con git.

**Revisé un rato la app equivocada.** El servidor de vista previa corre con `cwd` en el
**worktree**, y yo editaba y construía en el repo principal. Durante varias vueltas leí en
pantalla un build anterior a mis cambios y estuve a punto de declarar roto un arreglo que
funcionaba. Lo cazó una instrumentación: puse un atributo nuevo en el componente, no apareció en
el DOM, y el chunk que pedía el navegador tenía otro hash que el del disco. **Antes de acusar al
código, comprobar que la pantalla es la del código.** El comando que lo dice en un segundo:
`lsof -p <pid> -a -d cwd`.
