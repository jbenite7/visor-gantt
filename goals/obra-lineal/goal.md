---
tipo: goal
estado: cerrado
fecha: 2026-08-08
areas: [cronograma, deteccion, obra-lineal]
carril: B
fuente: docs/superpowers/specs/2026-08-08-obra-lineal-design.md
plan: docs/superpowers/plans/2026-08-08-obra-lineal.md
padre: goals/evolucion-visor-v2/goal.md
depende_de: goals/motor-deteccion/goal.md
resumen: "P3b: que el motor entienda la obra lineal, donde la ubicación es un tramo entre ejes y no un piso"
---

# P3b · La obra lineal

## Objetivo

Que el visor entienda los cronogramas de **obra lineal** —estaciones, tramos, infraestructura—, donde la
ubicación no es un piso sino **un tramo entre dos ejes**.

P3 dejó el motor funcionando para obra vertical y **anotó esta limitación con la medición delante**. El
usuario confirmó el 2026-08-08 que la infraestructura es una línea real de trabajo, así que deja de ser un
límite conocido y pasa a ser un proyecto.

## De dónde sale

- **Límite conocido de P3**, escrito en su spec y su goal con los números medidos.
- El archivo real `test_data/20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp`, una estación de metro de
  **300 tareas**, parseado con el servicio `mpp-parser`:

| Palabra | En tareas | ¿La entiende el motor hoy? |
|---|---|---|
| `Eje` | 56 | **No** |
| `Módulo` | 21 | **No** |
| `Piso` | 15 | Sí |
| `Edificio` | 7 | **No** |
| `Torre` | 5 | Correctamente **no**: las cinco son «torregrúa», la máquina |
| `Nivel` | 4 | Correctamente **no**: las cuatro son «nivelación hasta nivel superior», no una ubicación |
| `Sótano`, `Cubierta`, abscisa | 0 | — |

**84 menciones de eje, módulo y edificio frente a 15 de piso.** En esa obra la unidad de producción es el
módulo entre ejes.

## La idea que ordena el proyecto

No es «añadir tres palabras más». Es que **una ubicación puede ser un tramo, no un punto**:

- `Módulo 1.1 (Ejes A-D)` — un módulo que ocupa del eje A al D.
- `Construcción Losa Aérea (Eje D-H)`, `Lucarnas (Ejes DB4-DB8)`.
- Y el mismo concepto resuelve un fallo mudo que P3 dejó anotado en obra **vertical**:
  `Piso 1 a 2 (eje A)` es una tarea de transición entre dos niveles, y hoy el extractor devuelve el
  primero y descarta el resto **en silencio**.

Un tramo y una transición entre pisos son la misma cosa: una ubicación con principio y fin.

## Qué se construye

1. **Etiquetas de eje comparables**: `A`, `DB08`, `03` conviven en el mismo archivo. Cada una se resuelve a
   una familia y un índice, para poder ordenarlas dentro de su familia sin fingir que se pueden comparar
   entre familias distintas.
2. **Ubicación como tramo**: `LocationMatch` gana un `span` opcional con principio y fin. Todo lo que hoy
   devuelve un punto sigue devolviéndolo igual.
3. **Vocabulario de obra lineal**: `Eje` y `Ejes` (con rango), `Módulo` con número decimal (`1.1`, `2.2`) y
   `Edificio`.
4. **Transiciones de piso**: `Piso 1 a 2` deja de resolverse a medias y en silencio.
5. **Fixture real** con los nombres de la Estación 16, incluidos los que **no** deben resolver.

## Estado (2026-08-08) — ejecutado

Siete tareas TDD con revisión independiente por tarea, más una revisión final de rama. **1400 tests en 143
suites**, lint limpio, `tsc` filtrado vacío y `next build` correcto.

**Medido contra el archivo real** (`PROGRAMACION ESTACION 16`, 301 tareas, parseado con `mpp-parser`):

| | Resultado |
|---|---|
| `Módulo` | 21 de 21 |
| `Piso` | 15 de 15 |
| `Edificio` con número | 6 de 6 |
| Tareas que mencionan un eje | **56 de 56 resuelven** (26 `Eje`, 17 `Módulo`, 13 `Edificio` o `Piso`) |
| «Torregrúa» | 0 resueltas — es la máquina, no una torre |
| DA PORTO, obra vertical | 197 de 212, **idéntico a P3**: sin regresión |

### Lo que solo apareció con el archivo delante

Dos fallos que ningún test de laboratorio habría visto, porque nacen de cómo se escriben los nombres en un
cronograma de verdad:

- **`Piso 2 - 100% avance` se leía como un tramo del piso 2 al 100.** El guion decorativo seguido de un
  número cualquiera pasaba por rango. Los porcentajes de avance en los nombres de tarea son cotidianos en
  obra, así que se habría disparado de verdad. Cerrado exigiendo dos dígitos como mucho, prohibiendo el `%`
  detrás —con o sin espacio— y exigiendo que el fin sea mayor que el principio.
- **Los tramos entre rejillas distintas daban números que engañan.** `Ejes J-DB08` es de la letra J a la
  serie DB: `from` 10 y `to` 8, que parece ir hacia atrás y no significa nada, porque son dos numeraciones
  que no se pueden comparar. Eran **12 de los 22 tramos** del archivo. Ahora el dato lo dice con
  `span.crossesGrids`, en vez de callarlo.

### Límite conocido: la unidad de producción se queda sin tramo

`Módulo 1.1 (Ejes A-D)` resuelve como `Módulo 1.1` y **sin `span`**, porque el módulo gana al eje por
diseño. Es coherente con la decisión D3 de la spec —el módulo es la unidad de producción y el eje dice
dónde está—, pero tiene una consecuencia que conviene decir en voz alta: **la idea que ordena el proyecto,
que una ubicación puede ser un tramo, no alcanza a las 17 tareas de módulo del archivo insignia.** El tramo
solo aparece donde el eje gana, que son 26.

Resolverlo pediría que una ubicación pueda llevar un detalle dentro —un módulo *que ocupa* un tramo de
ejes—, y eso es un modelo distinto, no un patrón más. Queda anotado, no inventado.

### Tres regresiones sobre obra vertical, cazadas por la revisión final

Ninguna estaba en el fixture de DA PORTO, así que ningún test las veía. Las tres salieron de mirar el
conjunto, no las piezas:

- **`Módulo` no aceptaba la tilde.** Estos patrones se recorren también sobre el nombre **sin normalizar**,
  y el archivo real escribe «Módulo». Sin la alternativa, cada módulo quedaba como un sistema distinto con
  una sola ubicación, y **la matriz salía sin ninguna receta**.
- **El decimal se partía en la Línea de Balance.** Su normalizador convertía el punto en espacio, así que
  «Módulo 1.1» quedaba en «modulo 1 1» y «Losa aérea» se rompía en dos actividades.
- **El bloque de obra lineal se pegó delante del vocabulario vertical**, y eso cambiaba en silencio nombres
  que ya funcionaban: `Edificio 2 - Apto 302` pasaba a leerse como edificio. La spec decide que el módulo
  gana al eje, pero **nunca decidió que el edificio ganara al apartamento**: eso salió de dónde se pegó el
  bloque, no de una decisión. Movido detrás de `Apartamento`.

Tras los tres arreglos, la medición sobre la Estación 16 es **idéntica**: no costaron cobertura.

### Tres errores del propio plan, cazados por los implementadores

Los tres los encontraron ayudantes que **pararon a preguntar** en vez de forzar que el código pasara:

- el orden entre familias de eje era imposible con la comparación de texto que yo había escrito;
- los tests de ejes usaban nombres reales con «Módulo» dentro, justo lo que la tarea siguiente hacía ganar;
- y sin un límite de palabra, «Replanteo de ejes» leía la propia «s» final como si fuera el eje «S».

## Condición de hecho

1. Sobre el vocabulario real de la Estación 16, **las 56 tareas que mencionan un eje resuelven todas**, más
   los 21 `Módulo` y los 6 `Edificio` con número, además de los 15 `Piso` que ya resolvía.

   > **Corrección de redacción, hecha con la medición delante (2026-08-08).** Este punto decía «resuelve los
   > 56 `Eje`», que daba a entender que las 56 llevarían la etiqueta `Eje`. No es así, y está bien que no lo
   > sea: 26 resuelven como `Eje`, 17 como `Módulo` y 13 como `Edificio` o `Piso`, porque esos tres **ganan
   > al eje por diseño** —el módulo es la unidad de producción y el eje dice dónde está ese módulo—. Lo que
   > importa es que **ninguna se queda sin resolver**, y eso se cumple.
   >
   > Los `Edificio` son **6 y no 7**: el séptimo es `EDIFICIO DESCENDENTE`, que lleva la palabra pero no
   > lleva número y **debe** rechazarse. Está en el fixture como negativo.
2. `Ejes A-D` da un tramo con principio y fin, no un punto; y `Piso 1 a 2` también.
3. Las cinco «torregrúa» y las cuatro «nivelación hasta nivel superior» **siguen sin resolver**: el
   fixture las incluye como negativos para que nadie afloje un patrón sin romper otro.
4. **Ningún archivo de obra vertical cambia de resultado.** El fixture de DA PORTO de P3 sigue en verde sin
   tocarse.

   > **Este punto estuvo incumplido y hubo que arreglarlo.** El fixture pasaba, pero la revisión final
   > encontró tres nombres de obra vertical **que el fixture no contiene** y que sí cambiaban de resultado
   > —apartamentos, torres y la agrupación de módulos—. Es la lección del proyecto: *un fixture en verde
   > prueba lo que contiene, no lo que falta*. Los tres están arreglados y descritos arriba.
5. Suite completa, lint, `tsc` filtrado vacío y `next build` en verde.

## Restricciones

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, código mínimo.
- **No se toca `GanttView.tsx` ni `ProjectContext.tsx`** — son del carril A.
- **Aditivo sobre P3, no un rediseño**: `LOCATION_PATTERNS` es una lista ordenada y `span` es opcional.
- Copy en español con tildes, lenguaje de obra.
- Rama propia (`carril-b/obra-lineal`), fusionada a `main` al pasar su revisión.

## Preguntas abiertas

Se anotan porque no hay evidencia para resolverlas y **no se inventa una respuesta**.

1. **Qué otras obras lineales lleva el usuario.** El único archivo disponible es una estación de metro. Un
   túnel o una vía se ubican por **abscisa** (`K12+340`), que no aparece en ningún archivo del
   repositorio. **No se implementa**: sin un caso real, sería diseñar a ciegas. Si aparece, es una entrada
   más en la lista de patrones.
2. **Cómo dibujar un tramo en la Línea de Balance.** Hoy cada unidad es una fila. Un tramo ocupa varias, y
   representarlo bien es una decisión de la vista, no del motor. Este proyecto deja el dato; la vista se
   decide cuando se aborde.
3. **Si dos familias de eje conviven, en qué orden van.** En el archivo real conviven letras (`A`-`K`),
   números (`03`-`07`) y una serie `DB`. Se ordenan por familia y luego por índice, que es lo único
   defendible sin saber la geometría real de la obra.
