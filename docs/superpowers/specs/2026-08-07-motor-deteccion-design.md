# P3 · Motor de detección — diseño

Fecha: 2026-08-07 · Carril **B** · Goal: [`goals/motor-deteccion/goal.md`](../../../goals/motor-deteccion/goal.md)
Requisitos: **Bloque F** de [la spec del grilleo del 2026-08-06](2026-08-06-supergoal-backlog-ux-design.md)
(2 decisiones, ya tomadas — este documento no las reabre, las traduce a código).

---

## 1. Problema, con la evidencia delante

El visor reconoce el piso y el sistema de una tarea leyendo su nombre y su WBS. En un archivo real de obra
—`aia-ms-project/20260312 DA PORTO TORRE 3.mpp`, 239 tareas— **resolvió 195 y falló en 44**.

No es un fallo repartido al azar. Extraídos los nombres reales del archivo, el patrón es evidente:

| Nombre real en el archivo | ¿Lo resuelve hoy? | Por qué |
|---|---|---|
| `LOSA AÉREA PISO 5` | Sí | `piso` + número |
| `COLUMNAS SÓTANO 1` | **No** | **no existe ningún patrón para `sótano`** |
| `LOSA DE CIMENTACIÓN SÓTANO 3` | **No** | ídem |
| `SOTANO 2` (sin tilde, como tarea padre de MAMPOSTERÍA › INTERNA) | **No** | ídem, y además la ubicación está en el padre |
| `PISO CUBIERTA` | **No** | `piso` seguido de palabra, no de número |
| `LOSA AÉREA CUBIERTA` | **No** | ni palabra clave ni número |
| `EXCAVACIÓN A COTA 2110` | No, y está bien | no tiene ubicación por piso |
| `VÍAS INTERNAS`, `SKATE PARK`, `RED DE GAS` | No, y está bien | urbanismo: es obra general |

El patrón actual (`v2/src/lib/scheduling/unitPatterns.ts:19`) es
`\b(?:piso|nivel|planta|n)\s*[-#:]?\s*([a-z]?\d+)\b`. **`sótano` no aparece en ninguna de las siete
entradas de `UNIT_PATTERNS`.** El archivo DA PORTO tiene tres sótanos con losa, columnas, mampostería,
redes y aseo cada uno: ahí están la mayoría de las 44.

Y hay un segundo fallo, más callado: aunque se detectara `SÓTANO 3`, hoy la etiqueta se guarda como texto
(`match[1].toUpperCase()`) y se ordena con `localeCompare(..., { numeric: true })`
(`typicalUnit.ts:125`). Con eso `SÓTANO 3` va **después** de `PISO 12` y la Línea de Balance dibuja la obra
al revés. Un sótano no es «el piso 3», es **el piso −3**.

## 2. De dónde se porta, y qué se porta exactamente

El usuario tiene en `lps-aia` (PDC V2) dos piezas medidas que resuelven esto. Se leyeron ambas antes de
diseñar.

### 2.1 `ActivityMatcherService::extractLocationValue` (líneas 562-637)

Devuelve **un número ordenable**, no una etiqueta. Prueba patrones en orden de prioridad y gana el primero:
`Piso`, `Nivel`, `Etapa`, `Sótano` (**negado**), `Torre <letra>` (A=1…Z=26), `Zona`, `Sector`, `Tramo`,
`Area <letra>-<n>`, `mezanine` → `0.5`, código `P\d{2,}`, código `S\d{1,2}` (**negado**).

Las dos ideas que valen y que hoy faltan en visor-gantt:
- **el sótano es negativo** — así el orden natural del número es el orden físico de la obra;
- **`\b` en los códigos de una letra** — `P01` sí, pero una `p` suelta no, para no cazar dentro de
  «pintura». Esa cautela ya existe en visor-gantt (está documentada en el comentario de `unitPatterns.ts`)
  y se conserva.

### 2.2 `AmarreCronogramaService` (476 líneas, con su porqué escrito)

Su documentación es la justificación del diseño, no un adorno: sobre 820 filas reales, **el emparejamiento
ingenuo por nombre acierta 1**. Su solución es una cascada, de lo específico a lo general:

1. **regla sembrada (diccionario)** sobre el nivel más específico,
2. **nombre exacto** normalizado,
3. **similitud de palabras** (Jaccard sobre tokens, umbral `0.33`),
4. si nada acierta, **`sin_resolver` con la evidencia** de qué se probó.

Y explica por qué el diccionario va **primero** y no de último recurso: «CARPINTERIA METALICA» se parece a
«CARPINTERIA EN MADERA» (Jaccard 0,33) **y no son lo mismo**. El texto acierta por accidente y falla por
accidente; una corrección humana no. El archivo DA PORTO contiene exactamente ese par:
`CARPINTERIA EN MADERA` y `VENTANERÍA` conviven en el mismo capítulo de acabados.

El umbral `0.33` no es redondo por casualidad: es el caso límite que tiene que dejar pasar —
«URBANISMO Y OBRAS EXTERIORES» (3 palabras) contra «URBANISMO» (1 palabra) = 1/3. Se copia el valor tal
cual, y también su lista de palabras vacías (`DEL LOS LAS CON PARA POR SIN SUS QUE`) más el filtro de
palabras de ≤2 letras que absorbe «Y», «DE», «EN».

**Lo que NO se porta:** todo lo que es de PDC y no del visor — subir por la rama de códigos del
presupuesto (`1.2.3` → `1.2`), la distinción título/hoja del cronograma de PDC, el acceso a base de datos.
El visor no tiene presupuesto con códigos jerárquicos; tiene WBS y tareas resumen, que es su equivalente y
ya está resuelto por `buildWbsBreadcrumb`.

## 3. Decisiones de diseño

### D1 · Un número, no una etiqueta

`extractLocation` devuelve `{ label, raw, value }`: la etiqueta para agrupar y mostrar (`"Sótano"`), el
texto tal cual salió (`"3"`), y **el número para ordenar** (`-3`). Hoy solo hay etiqueta y texto; el
número es lo que arregla el orden en Unidad Típica y Línea de Balance.

Escala acordada:

| Caso | `value` |
|---|---|
| `SÓTANO 3` | `-3` |
| `SÓTANO 1` | `-1` |
| `MEZANINE` | `0.5` |
| `PISO 1` | `1` |
| `PISO 12` | `12` |
| `CUBIERTA`, `AZOTEA`, `TERRAZA` | `900` |
| Sin ubicación | `null` (no `0`: `0` es un piso posible) |

`900` es un centinela documentado: la cubierta va por encima de cualquier piso realista y por debajo de
nada. No se usa `Infinity` porque tiene que poder serializarse a JSON.

### D2 · `Nivel`, `Planta` y `Piso` se funden en una sola etiqueta

Hoy ya comparten patrón. Se mantiene: una obra que escribe «Nivel 3» en estructura y «Piso 3» en acabados
está hablando del mismo sitio, y separarlos partiría en dos la Línea de Balance de la misma torre. `Torre`,
`Zona`, `Sector`, `Tramo`, `Etapa`, `Apartamento` y `Lote` sí conservan etiqueta propia.

### D3 · La ubicación se busca en tres sitios, en este orden

1. **el nombre de la tarea** (`LOSA AÉREA SÓTANO 1`),
2. **el breadcrumb de tareas resumen** (`MAMPOSTERÍA › INTERNA › SÓTANO 2` → la tarea hoja hereda `-2`),
3. **el WBS**.

El orden importa: el nombre propio manda sobre el heredado. `buildWbsBreadcrumb` ya existe y ya se usa
para clasificar familia; aquí se reutiliza para ubicación.

**Corrección medida (2026-08-08).** Una versión anterior de esta spec afirmaba que la herencia recuperaba
«toda la mampostería y todo el aseo» del archivo real. **Es falso, y conviene decirlo.** Al medirlo sobre
el `.mpp` parseado, la mampostería y el aseo de DA PORTO son hojas que **se llaman `SÓTANO 3` o `PISO 1`
ellas mismas** (`1.4.5.1 PISO 1`, `1.4.1.1 INTERNA › SÓTANO 3`), así que resuelven por nombre propio: la
herencia da `0` casos en ese archivo. Sigue siendo correcta y necesaria —hay cronogramas que sí cuelgan la
hoja de un padre con la ubicación— pero **no es lo que arregla las 44 de este archivo**. Lo que las arregla
es el patrón de `Sótano`, que sencillamente no existía.

Y hay un peligro asociado que la medición destapó: el nivel raíz de ese archivo se llama
`DAPORTO TORRE 3`, que caza el patrón `Torre`. Heredar sin tope ubicaba **toda la obra** —vías internas y
skate park incluidos— en «Torre 3», y la cobertura cantaba 100 %. Por eso la herencia **se detiene antes
del nivel raíz**: una ubicación que comparten todas las tareas no distingue nada.

### D4 · «Sin ubicación» es un resultado, no un fallo

Las tareas de urbanismo (`VÍAS INTERNAS`, `SKATE PARK`, `REDES EXTERNAS`, `ENGRAMADO Y ADECUACIÓN ZONA
VERDE`) **no tienen piso, y está bien**. Hoy se descartan en silencio y el usuario solo ve un número
menor en el contador. Pasan a resolverse como `{ scope: "obraGeneral" }`, con evidencia
«no menciona piso, sótano ni zona: se trata como obra general». Es la diferencia entre «no lo sé» y «no
aplica», y el usuario merece verla.

### D5 · La cascada resuelve **sistema**, no ubicación

Ubicación es un problema de patrones (D1). **Sistema** —a qué oficio pertenece la tarea— es un problema
de emparejamiento contra un vocabulario, y ahí es donde vale la cascada de PDC. Se aplica sobre la
clasificación de familia que ya existe (`activityFamily.ts`), que hoy es solo regex:

```
diccionario (correcciones del usuario) → nombre exacto normalizado → Jaccard ≥ 0,33 → sin resolver
```

`classifyActivityFamily` se conserva **tal cual** como el paso automático de la cascada; no se reescribe.
La cascada la envuelve. Los tests existentes de `activityFamily.test.ts` deben seguir pasando sin tocarse:
si alguno se rompe, es que se cambió lo que no tocaba.

### D6 · El diccionario es un dato del proyecto, no un fichero global

`DetectionDictionary` es una estructura serializable que viaja con el proyecto. El motor **no sabe dónde
se guarda**: recibe el diccionario como argumento y devuelve uno nuevo al aprender. Esa es la única forma
de que la persistencia viva en `ProjectContext.tsx`, que es **del carril A y no se toca en este proyecto**.

Cada corrección guarda el porqué (`nota`), como las reglas sembradas de PDC. Sin eso, en seis meses nadie
sabe si una regla sigue haciendo falta.

### D7 · La frontera de proveedor se deja puesta, el cliente HTTP no

La decisión del grilleo dice «dejando preparada la opción de llamarlo por API más adelante». Se traduce en
una interfaz `DetectionProvider` con una implementación local síncrona. **No se escribe cliente HTTP
alguno**: sin servicio desplegado sería código muerto que nadie puede probar. Lo que se garantiza es que
el día que exista, ningún consumidor cambia.

## 4. Arquitectura

Todo lo nuevo vive en `v2/src/lib/scheduling/detection/`. Los archivos existentes se **cablean**, no se
reescriben.

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `detection/normalize.ts` | `normalizeName`, `significantTokens`, `STOPWORDS` | nuevo |
| `detection/location.ts` | `extractLocation`, `LOCATION_PATTERNS`, `compareLocationValue` | nuevo |
| `detection/similarity.ts` | `jaccardSimilarity`, `bestMatchByTokens`, `SIMILARITY_THRESHOLD` | nuevo |
| `detection/dictionary.ts` | `DetectionDictionary`, `lookupCorrection`, `rememberCorrection` | nuevo |
| `detection/cascade.ts` | `resolveSystem` con origen y evidencia | nuevo |
| `detection/taskLocation.ts` | `resolveTaskLocation` (nombre → breadcrumb → WBS → obra general) | nuevo |
| `detection/provider.ts` | `DetectionProvider`, `localDetectionProvider` | nuevo |
| `detection/coverage.ts` | `summarizeDetection` — el «195 de 239» como dato | nuevo |
| `detection/fixtures/daPorto.ts` | Vocabulario real del archivo de obra + esperados | nuevo (test) |
| `detection/index.ts` | Reexporta la superficie pública | nuevo |
| `scheduling/unitPatterns.ts` | `extractUnitLabel` delega en `extractLocation`; conserva firma | se cablea |
| `scheduling/typicalUnit.ts` | Ordena por `value`; deja de perder sótanos | se cablea |
| `scheduling/lob.ts` | `detectUnit` delega; `index` pasa a ser el `value` | se cablea |
| `scheduling/activityFamily.ts` | Sin cambios — es el paso automático de la cascada | intacto |

**Nadie más se toca.** `GanttView.tsx` y `ProjectContext.tsx` quedan fuera por la regla de carriles.

## 5. Cómo se prueba que funciona de verdad

El riesgo de un motor de reconocimiento es escribir tests que pasarían igual con el motor roto: tests con
nombres inventados que casan con el patrón que acabas de escribir.

**Contramedida: el fixture son los nombres reales del archivo de obra.** Se extrajeron del propio `.mpp`
(`aia-ms-project/20260312 DA PORTO TORRE 3.mpp`) y se fijan en `detection/fixtures/daPorto.ts` con su
ubicación esperada, incluidos **los que hoy fallan**:

```
LOSA AÉREA SÓTANO 1 · COLUMNAS SÓTANO 3 · LOSA DE CIMENTACIÓN SÓTANO 3 · SOTANO 2 · PISO CUBIERTA ·
LOSA AÉREA CUBIERTA · MAMPOSTERÍA › INTERNA › SÓTANO 2 · ASEO DE APARTAMENTOS › SOTANO 1
```

Y los que **deben seguir sin resolver**, para que nadie «arregle» la cobertura inventando ubicaciones:
`VÍAS INTERNAS`, `SKATE PARK`, `REDES EXTERNAS`, `EXCAVACIÓN A COTA 2110`, `DESCABECE DE PILOTES`.

Un test de cobertura sobre ese fixture cierra el círculo: si alguien afloja un patrón para cazar un caso,
otro se rompe.

### Limitación conocida: esto es un motor de **obra vertical**

El otro archivo de obra del repositorio, `test_data/20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp` (una
estación de metro), habla otro idioma. Contado sobre sus **300 tareas / 104 nombres únicos**:

| Palabra de ubicación | En tareas |
|---|---|
| `Eje` | 56 |
| `Módulo` | 21 |
| `Piso` | 15 |
| `Edificio` | 7 |
| `Torre` | 5 — **y las cinco son «torregrúa»**, la máquina |
| `Nivel` | 4 |
| `Sótano`, `Cubierta`, abscisa | 0 |

Sus tareas se llaman `Módulo 1.1 (Ejes A-D)`, `Edificio 1 (Sur)`, `Construcción Losa Aérea (Eje D-H)`,
`Lucarnas (Ejes DB4-DB8)`.

Qué significa exactamente, sin exagerar en ninguna dirección:

- **El motor sí resuelve algo ahí**: los 15 `Piso N` y los 4 `Nivel N` caen dentro de los patrones. No es
  un archivo donde detecte cero.
- **Pero pierde el eje principal**: `Eje`, `Módulo` y `Edificio` suman **84 menciones frente a 15 de
  `Piso`**, y no están cubiertos. En esa obra la unidad de producción es el módulo entre ejes, no el piso.
- **Ninguna de las cinco «torres» es una torre.** Son `Montaje torregrúa`, `Dado para torregrua`,
  `Pilotaje para torregruas`… El patrón las rechaza gracias al `\b` que cierra `TORRE\s*([A-Z])\b`:
  «torregrua» no tiene límite de palabra tras la `g`. Comprobado con el patrón real, y fijado con tests
  negativos —incluida la grafía separada, «torre grúa»— para que nadie afloje ese `\b` sin romper algo.
- **Y hay un caso que resuelve a medias sin decirlo**: `Piso 1 (eje B a 2)` y `Piso 1 a 2 (eje A)` son
  tareas de transición entre dos niveles, con el eje dentro. El extractor devuelve el primer número y
  descarta el resto en silencio.

**No se amplía el alcance aquí.** Nada de esto está en las 103 decisiones del grilleo, y añadir a ciegas una
segunda gramática —módulo, edificio, eje, abscisa— sería inventar requisitos. Lo que sí se hace es dejarlo
escrito: quien ejecute este plan debe saber que «el motor funciona» significa **«funciona en obra
vertical»**, y el usuario puede decidir después si quiere una segunda familia de patrones para
infraestructura. Una limitación escrita vale más que una sorpresa en obra.

**Sobre cómo se midió, porque importa.** Estas cifras salen del parser, sobre nombres de tarea. Una primera
medición contó cadenas extraídas del binario del `.mpp` y dio números inflados (1.668 «nombres», 28 pisos):
un `.mpp` guarda además recursos, calendarios, campos personalizados y texto interno de MS Project. La
conclusión de fondo no cambia —el eje principal se pierde igual—, pero las proporciones sí, y son estas.
(Detectado en el ida y vuelta con la sesión «Plan de mejora para app web» el 2026-08-08: su primera
medición decía «cero pisos», la mía decía 28, y ninguna de las dos era la buena.)

### Limitación, dicha una vez

El fixture contiene el **vocabulario único** del archivo (los ~110 nombres distintos que se pudieron
extraer directamente del binario), **no las 239 filas con su WBS y su jerarquía**. Para eso haría falta
correr el servicio `mpp-parser`, que necesita Java y no está instalado en esta máquina. Por tanto el plan
**no promete «44 → 0» como número medido**: promete que cada familia de nombre que hoy falla resuelve, y
mide la cobertura sobre el vocabulario real. Verificar el 44 → 0 sobre el archivo entero es un paso de
comprobación manual en el navegador, anotado como tal en la tarea final del plan.

## 6. Riesgos

**R1 · Aflojar un patrón rompe otro.** `\bS(\d{1,2})\b` caza `S1` pero también podría cazar el `S 1` de
un código de plano. Mitigación: el orden de patrones es explícito y probado, los códigos de una letra van
**los últimos** (tras `Sótano`, `Piso`, `Zona`…), y el fixture incluye los negativos.

**R2 · Cambiar el orden de niveles cambia gráficos que hoy alguien ya lee.** Con sótanos negativos, una
Línea de Balance existente se redibuja de otra manera — la correcta. Es un cambio visible y deseado; se
menciona en el commit y se comprueba en navegador.

**R3 · El diccionario puede envenenarse.** Una corrección equivocada gana siempre, por diseño. Mitigación:
cada corrección lleva `nota` y `recordedAt`, y `summarizeDetection` reporta cuántas resoluciones vinieron
del diccionario, para poder auditarlo.

## 7. Preguntas abiertas

Ninguna bloquea la ejecución; se anotan porque la spec del grilleo no las resuelve y **no se inventó una
respuesta silenciosa**.

1. **Ordinales escritos con letra** (`PRIMER PISO`, `SEGUNDO NIVEL`). No aparecen en el archivo DA PORTO y
   ninguna decisión los menciona. **Se dejan fuera**: añadirlos sin un caso real que los justifique es
   añadir superficie de falso positivo. Si aparecen en otro archivo, es una entrada más en
   `LOCATION_PATTERNS`, no un rediseño.
2. **`CUBIERTA` = 900.** Es un centinela elegido aquí, no una decisión del usuario. Funciona para ordenar;
   si algún día se quiere «cubierta = último piso + 1», hay que conocer el número de pisos del proyecto, y
   eso el extractor —que solo mira un nombre— no lo sabe. Anotado para quien construya la vista.
3. **Torre como ubicación y como agrupador.** `Torre A` da `1` y `Piso 1` da `1`: el mismo número con
   distinta etiqueta. Ordenar mezclando etiquetas no tiene sentido y el motor no lo hace (compara dentro de
   la misma etiqueta). Si una vista necesita ordenar «Torre A Piso 3» como par, necesitará **dos**
   ubicaciones por tarea, no una. Está fuera del alcance de P3 y se anota para P4, que sí tiene alcance ×
   ubicación en dos ejes.
