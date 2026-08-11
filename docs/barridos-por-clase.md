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
| **Campos de formulario sin nombre accesible** | 16 + 10 arreglados; **7 de los «pendientes» no lo estaban** (ver abajo) |

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

**1. ~~Los recursos del `.mpp` real~~ — cerrada: el archivo no los trae, y el importador está
bien.**

Se corrieron los tres `.mpp` del repositorio contra el analizador de verdad:

| Archivo | Recursos | Con nombre | Asignaciones | Al recurso nulo |
|---|---|---|---|---|
| DA PORTO TORRE 3 (obra) | 1 | **0** | 213 | 213 |
| Estación 16 | 18 | **17** | 449 | 18 |
| Plan de acción | 2 | **1** | 1.475 | — |

Los tres traen **exactamente uno** con el nombre vacío y `UID 0`. No es una cuadrilla a la que se
le olvidó el nombre: es el **recurso nulo** que Microsoft Project incluye siempre. El de obra no
trae ninguna otra; el de Estación 16 trae diecisiete de verdad —«Ayudante armado», «Oficial
acero»— y el importador **las conserva todas**.

Así que la respuesta a «¿descarta recursos sin nombre que deberíamos rescatar?» es **no hay nada
que rescatar**. El importador se queda como está.

Lo que sí queda, y es fiel al archivo: 213 asignaciones con trabajo real dentro —96 horas la
primera— apuntando al recurso nulo. **No se descartan a propósito**: tirarlas sería inventarse que
ese trabajo no existe para que un número cuadre. Quedan huérfanas, y quien abre Recursos ve el
aviso que lo explica. Fijado en `recursoNulo.test.ts` con los números de arriba.

*Y una vuelta de tuerca sobre el aviso:* decía «ninguna llegó con un recurso con nombre», lo cual
resultó **exacto** — pero se escribió antes de saber por qué. Ahora se sabe.

**2. Las vistas autenticadas, sin revisar en navegador.** Los mejores hallazgos de esta semana
salieron de mirar la app funcionando. No pude: la cookie de sesión es `httpOnly` y no se inyecta
desde JS, y no escribo contraseñas en formularios. Hace falta otra vía —una sesión ya abierta, o
un modo de prueba— para revisar Gantt, Matriz, Ejecutivo y Cortes con datos reales.

*Cerrada a medias, y dio fruto enseguida.* La ruta pública `/ver/<token>` monta **el mismo Gantt
sin pedir sesión**, así que sirve de mirador: se le pone un `share_token` a una copia del
cronograma de obra real y se navega como visitante. Con eso salieron los dos hallazgos de la
sección siguiente. No cubre lo que solo existe con cuenta —guardar, adoptar, listar—, pero sí las
once vistas de análisis.

*Y ahora cerrada del todo.* Existe un **modo de prueba** —`VISOR_TEST_MODE=1` y
`/api/modo-prueba`— que abre sesión en una cuenta de revisión propia sin escribir
ninguna contraseña, con una copia del cronograma de obra encima. Con él se
revisaron en navegador **Gantt con cuenta, Matriz, Ejecutivo, Cortes** y el
listado. Está apagado salvo que se encienda a propósito: apagado responde 404 y
no toca la base ni firma cookie, y eso está fijado en pruebas que en su mayoría
son del lado apagado. Cómo se usa y qué lo sostiene: `docs/modo-de-prueba.md`.

**3. ~~Nueve campos sin nombre accesible~~ — cerrada, y la cifra estaba mal por partida doble.**

Al mirarlos a ojo no eran nueve sino diecisiete, y **siete de ellos sí tenían nombre**: los de
`MatrixEditorView` viven dentro de un `<label>` que los envuelve —«Nombre», «Inicio»,
«Cantidad»—, y esa asociación implícita ya nombra el campo. La heurística solo buscaba
`aria-label`, `title` y `placeholder`, así que **no veía la forma más común y más correcta de
nombrar un campo**. Otro marcado era un comentario que mencionaba `<input type="date">`.

Los reales, arreglados:

- **La celda editable de la tabla**, que es la de más alcance: 240 tareas × 7 columnas editables
  son más de mil seiscientos campos. El nombre lo pone la fila —«Duración de MOVIMIENTO DE
  TIERRA»— porque la celda no sabe de qué columna ni de qué tarea es, y sale del **título de la
  columna** en vez de un texto aparte, para que no se separen al renombrarla. También la celda en
  reposo, que lleva `tabindex` y solo decía «Doble clic o Enter para editar»: una instrucción
  repetida en cientos de celdas, no un nombre.
- **Filtro por tipo** y **avance masivo** (su etiqueta visible era un «%»).
- **Los seis controles de dependencias**, donde el nombre dice además si es la predecesora o la
  sucesora: el panel dibuja dos bloques idénticos.

Donde no había contexto del que sacar un nombre, **no se inventó uno**, y hay una prueba de
control que fija esa decisión. Un campo que miente es peor que uno mudo.

Los siete falsos positivos quedan **probados por su nombre**, no anotados: «lo comprobé y estaba
bien» no impide que mañana alguien saque un campo de su `<label>` al recolocar el diseño.

**Aviso sobre la medición, ahora con dos pruebas detrás:** la heurística que los cuenta es frágil
en las dos direcciones. Con una ventana de 400 caracteres decía 33 e incluía la página de login,
cuyos campos **sí** están dentro de un `<label>`; con 2.500 dijo 25; y buscando solo atributos
marcó siete que estaban bien. **Mirar la muestra a ojo antes de tocar nada no es prudencia, es
parte del método.**

**4. ~~Dos rarezas del `.mpp` real~~ — cerrada: no eran rarezas, era mi medición.** Decía «un
resumen sin hijos y un hito con duración mayor que cero». Las dos se deshacen al medirlas bien:

- El «resumen sin hijos» lo conté buscando `parentId`, **campo que este modelo no tiene**: la
  jerarquía va por `wbs` y `outlineLevel`. Con el criterio bueno queda uno solo, y es **la fila
  raíz del proyecto** —la que Microsoft Project pone arriba—, no una tarea mal formada.
- El «hito con duración 1» tiene **inicio y fin el mismo día y a la misma hora**. Es la convención
  de Project de contar el día propio.

Comprobado además en pantalla por el mirador: la raíz se dibuja como barra de resumen abarcando
el proyecto entero, y el hito como rombo. Los dos, bien.

**Es el error del eje de la Línea de Balance otra vez, en otra forma:** deducir de un campo sin
comprobar antes qué campos existen de verdad. La diferencia es que esta vez lo cacé antes de
tocar código.

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

## Errores míos de este día, para que no se repitan

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

**El registro de sesiones pierde el frente en cada arranque, y el gate salta con el visto ya
dado.** Trabajando con varias sesiones sobre este repo, el hook de publicación me frenó dos veces
con «ejecutor sin frente declarado»: la segunda, cuando ya tenía el visto de la coordinadora. Mi
fila de `.claude/sesiones.md` había perdido el frente sin que nadie tocara el archivo.

*Leyendo el código:* `scripts/session-start.sh:23` llama a `cas_upsert` pasando **`-` como frente
y `-` como archivos, siempre**, y `cas_upsert` borra la fila y la reescribe entera.

*Y reproducido, que es lo que lo convierte en hecho:* declarar el frente, ejecutar ese script con
la entrada que le pasa el hook, y volver a leer la fila.

```
ANTES  : frente = a11y-campos
DESPUES: frente = -
```

Así que **cada `SessionStart` borra el frente declarado**. No es una limpieza periódica ni otra
sesión pisando el archivo. Se repone con `cas-frente.sh`, pero hay que acordarse, y el momento en
que se nota es el peor: al ir a publicar.

**El mismo fallo tiene un gemelo, y ese sí es silencioso: el visto no lleva escrito para qué es.**

`.claude/vistos/<frente>` es un archivo vacío que dice «hay un push autorizado», no «hay un push
autorizado *de este sha*». `consume-visto.sh` lo borra ante **cualquier** `git push` correcto del
ejecutor, sin mirar qué se publica. Así que un visto emitido para un sha lo gasta el push de otro.

*Reproducido sin querer, con las horas medidas:*

```
14:42:39  la coordinadora crea el visto, pensando en `b2fa250`
14:42:52  publico `2748dc9` (que también estaba aprobado) → el hook borra el visto
14:43:33  mido: el directorio está vacío
```

**Es de la misma familia que el del registro: los dos escriben sin leer antes.** `session-start.sh`
borra el frente sin mirar cuál era; `consume-visto.sh` borra el visto sin mirar para qué era.
Misma línea de código con dos nombres — quien arregle una debería arreglar la otra.

Y es **el más grave de los dos, justo por ser el que no molesta**. El del registro frena y se ve;
este **deja pasar un push que nadie autorizó** para ese contenido, y no deja rastro. La regla que
lo sostiene —«el visto es sobre un sha, no sobre un frente»— existe solo en la conversación entre
dos sesiones; el mecanismo no la conoce.

**Se destapó porque se hizo lo correcto, y eso importa para leer bien el episodio.** El visto ajeno
se gastó al publicar `2748dc9:main` —el sha exacto que estaba aprobado— en vez de la cabeza local,
que iba un commit por delante. Publicar de más habría sido lo cómodo, no habría producido ningún
síntoma, y el fallo seguiría oculto. **No es un error de la sesión: es el precio de aplicar la
regla, y ese precio fue lo que hizo visible que el mecanismo no la sostenía.**

Las dos sesiones llegamos a esta causa a la vez y por caminos distintos —una por las horas, la
otra por el archivo vacío—, que es la mejor confirmación que tuvimos en todo el día.

**La lectura del código sola no bastaba, y por poco la escribo como prueba.** Enseña el mecanismo,
no que sea la causa del síntoma. Dos minutos de reproducción cierran la diferencia — y en este
caso hacía falta doblemente, porque el plugin se sirve desde un directorio distinto del que
parece: `~/.claude/plugins/data/…` está **vacío**, y el código real vive donde apunta el
`marketplaces` de `settings.json`. Estuve a punto de leer una copia que no se ejecuta, que es el
error del preview por tercera vez en un día.

Vive en el plugin `coordinating-agent-sessions`, fuera de este repositorio, así que aquí solo
queda anotado.

**Falsa alarma que conviene contar, porque es el error del día en pequeño:** avisé de que
`.claude/vistos/` estaba vacío y que quizá el visto no se había escrito. Estaba vacío **porque
funcionó**: `consume-visto.sh` borra el visto tras un `git push` correcto del ejecutor. Es de un
solo uso, por diseño. Acusé antes de leer el script, que es exactamente lo que este documento
lleva media página pidiendo no hacer.

**Y repetí el error del preview el mismo día, con otra cara: verifiqué un árbol que no era el que
pedía publicar.**
Informé «214 suites, 1.924 pruebas» y en `main` había 213 y 1.921. La diferencia era un fichero
que seguía solo en mi rama: había hecho dos commits **después** de fusionar y medí sobre el
worktree. La coordinadora lo cazó porque los números no cuadraban por uno.

Los dos son el mismo fallo, y por eso la regla de arriba se quedaba corta. La buena:

> **Verificar sobre el mismo árbol que se publica, y decir cuál es.**

Cómo se comprueba, en dos órdenes que tardan un segundo y no dependen de que uno se acuerde:

```
git log --oneline main..<rama>            # tiene que dar vacío
git cat-file -e main:<archivo-nuevo>      # tiene que existir
```

Y la corrida de pruebas, en el checkout que está en `main`, no en el worktree.

**La detección se fía al comando, no a la aritmética.** Aquí lo delató un recuento que bailaba por
uno, pero eso fue suerte: si las dos cifras hubieran coincidido por casualidad, no habría habido
descuadre y el `git log main..<rama>` habría cantado igual. Fiarse del número enseña a no correr
el comando, que es justo lo contrario de lo que hay que aprender.

## Un script de borrado que llama «marcador» a una subcadena

Salió al decidir si la copia del modo de prueba debía entrar en la limpieza automática. La regla
era mirar primero qué borra ese script. Lo que borra, `clean-e2e-projects.ts:81`:

```sql
WHERE name LIKE '%run-%'
  AND created_at < NOW() - ($1 || ' days')::interval
```

Y cómo se describe a sí mismo, en su línea 47 y en otros dos mensajes que ve el operador:

> «Solo borra proyectos cuyo nombre **contenga el marcador `run-`** … Proyectos sin ese marcador
> nunca se listan ni se borran»

**No es un marcador: es una subcadena.** Un marcador identifica; `%run-%` solo dice «en algún sitio
del nombre aparecen esas cuatro letras». Un cronograma real llamado **«Torre run-off»** —o
«Prerun-2»— cae en el `DELETE` sin haber salido nunca de una corrida E2E. Basta con que tenga una
semana.

Lo interesante no es el patrón, que es defendible como heurística. Es **la palabra**: llamarlo
«marcador» es lo que haría que alguien lo ampliara con confianza —«ya filtra por marcador, meto
también el proyecto de prueba»— sin volver a mirar el `LIKE`. Es de la misma familia que todo lo
demás de este censo: **algo que promete más precisión de la que tiene**, y que por eso no se
comprueba.

Por eso la copia del modo de prueba **no** se metió ahí: habría obligado a ensanchar lo que ese
script borra. Un script de limpieza que se lleve por delante un proyecto real es un daño que no se
deshace, y queda un proyecto de más a cambio —que el `seed` reusa en vez de acumular.

Sin tocar: el arreglo honesto es un marcador de verdad —un prefijo propio, o una columna— y que los
mensajes digan lo que el `WHERE` hace. No se hizo aquí porque cambia lo que ese script borra, y eso
no se decide de paso.

## El gate que adivinó en silencio, y el `:` de un formato de hora

El push del frente `modo-de-prueba` fue denegado con este mensaje:

> El visto autoriza `790e22e`, pero este push publica **`d6329b6`**.

`d6329b6` era la punta de mi worktree. `main` —lo que el push publicaba— estaba en `790e22e`. Así
que el gate parecía estar mirando el `HEAD` del worktree en vez del ref que viaja, y **eso escribí
en mi informe. Era falso, y me lo hicieron medir antes de anotarlo.**

`cas_push_sha` (`lib.sh:60-72`) **sí** resuelve el ref cuando el comando lo nombra. Medido bajo
`bash`, que es como corre el hook:

| comando | `src` elegido | resuelve |
|---|---|---|
| el limpio, solo el push con `origin main` | `main` | `790e22e` — lo habría permitido |
| el mío, que terminaba en `date "+%H:%M:%S"` | `"+%H` | no resuelve → **cae al `HEAD` del worktree** |
| el mismo push con un simple `\| tail -3` detrás | `tail` | no resuelve → **cae al `HEAD` del worktree** |

En mi caso el culpable parecía ser el **formato de hora**: `date "+%H:%M:%S"` lleva dos puntos, la
rama `*:*` del `case` está para reconocer refspecs tipo `<sha>:main`, y se lo tragó dejando
`src='"+%H'`. Pero eso hace pensar que hace falta un comando rebuscado, y **no hace falta**: la
tercera fila es un `| tail -3` pelado, lo más común del mundo al publicar, y rompe igual.

Los dos detalles que lo explican: el bucle **se queda con el último token que encaje**, así que
cualquier cosa escrita *detrás* del push manda sobre el ref —no hacen falta dos puntos, basta una
palabra—; y cuando `src` no resuelve, la función **cae a `HEAD` sin decirlo**. El fallo no es de
comandos raros: es del caso normal.

Lo grave no es el fallo de parseo —un comando compuesto es difícil de leer—, es el **silencio**:
denegó presentando `d6329b6` como «lo que publica este push», que es una afirmación falsa dicha con
total aplomo. **Un fallback que adivina y no lo dice es peor que un error: un error se investiga,
una afirmación se cree.** Por eso me llevó a deducir una causa equivocada que estuvo a punto de
quedar escrita aquí como hallazgo.

La diferencia con las otras dos veces de hoy es que esta se midió a tiempo, y **no porque yo
dudara: porque me lo exigieron**. Conviene decir la otra mitad, o la lección sale al revés: **la
hipótesis alternativa de quien me frenó —«el comando no nombraba el ref»— también era falsa.** Sí
lo nombraba. Ninguno de los dos lo tenía. No acertó quien dudó: acertó **medir**.

Misma familia que las otras dos de este censo: **`%run-%` llamado «marcador»**, **`HEAD` presentado
como «lo que publica el push»**. Ninguna está rota. Las tres dicen medir algo más preciso de lo que
miden, y las tres solo se notan cuando alguien se sale del caso normal.

**Y una tercera, encontrada al escribir esto:** el gate también bloqueó el comando que *añadía este
texto al documento*, porque las palabras del push aparecían dentro de la prosa. **Detecta por el
texto del comando, no por lo que el comando hace**, así que **hablar de publicar cuenta como
publicar**. Inofensivo aquí —se escribe con el editor y ya—, y de la misma familia otra vez:
`%run-%` llamado marcador, `HEAD` llamado lo-que-publica, y ahora hablar de publicar contado como
publicar.

El arreglo natural no es solo resolver mejor el ref: es **negarse a adivinar**. Un push sin refspec
depende del upstream de la rama y el gate no puede saber qué viaja; y un token ambiguo no es un
refspec. Mejor denegar pidiendo que se nombre el ref, que resolver un `HEAD` cualquiera y llamarlo
«lo que publica el push».

**Arreglado el mismo día, y esta nota decía lo contrario.** Se escribió como «sin tocar: es
herramienta de la coordinadora», y **el usuario pidió arreglarlo** poco después. Una nota falsa en
el censo es peor que ninguna, así que aquí queda qué cambió y qué no.

El arreglo no es resolver mejor el ref: es **negarse a adivinar**. `cas_push_sha` ahora lee solo el
tramo del propio comando —cortando en el primer operador, para que lo escrito detrás no pueda
cambiar el veredicto—, y cuando el comando **no nombra ningún ref devuelve vacío**; entonces el gate
deniega admitiendo que no lo sabe y pidiendo que se nombre. **Coste aceptado:** un push sin refspec
deja de pasar. Dependía del upstream de la rama, que el hook no puede conocer, así que **denegar
diciendo «no lo sé» es mejor que permitir habiendo adivinado**.

Dos cosas del arreglo valen más que el parche, y las dos son sobre las pruebas:

- **Una trampa que no puede saltar no es una prueba.** Los tres primeros tests pasaban porque en el
  repositorio de prueba `HEAD` coincidía con `main`: el fallback **mentía acertando** y la prueba no
  veía nada. Hubo que montar `HEAD` en una rama distinta de todas las publicables.
- **Una mutación que no pone nada en rojo delata una defensa supuesta, no probada.** Al mutar el
  corte por operadores no falló ningún test: esa mitad del arreglo no estaba cubierta —protegía «el
  primer refspec manda»—. El caso que sí la distingue es `git ␟push␟ && echo main`, donde el único
  ref del comando está detrás.

**Lo que queda sin arreglar es la tercera grieta**, y se repitió en vivo mientras se arreglaba la
segunda: el gate bloqueó el `git commit` del propio arreglo **porque el mensaje del commit hablaba
de publicar**. Hubo que escribir el mensaje en un archivo. Sigue detectando por el texto del
comando, no por lo que el comando hace.

*Y un aviso que no es del censo pero conviene aquí: `~/.claude/cas` es un **symlink** al repositorio
del plugin, así que el arreglo está **vivo para todas las sesiones** desde que se guardó, pero
**sin publicar** — publicarlo es un acto aparte y en repositorio ajeno. Si alguien resetea ese
repositorio, el comportamiento del gate cambia bajo todas las sesiones sin aviso.*
