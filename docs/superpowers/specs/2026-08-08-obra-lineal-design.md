# P3b · La obra lineal — diseño

Fecha: 2026-08-08 · Carril **B** · Goal: [`goals/obra-lineal/goal.md`](../../../goals/obra-lineal/goal.md)
Origen: el **límite conocido** que P3 dejó escrito con la medición delante, y la decisión del usuario del
2026-08-08 de que la infraestructura es una línea real de trabajo.

Depende de **P3 · Motor de detección**, ya fusionado: esto se construye encima, sin rehacerlo.

---

## 1. El problema, con el archivo delante

`test_data/20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp` es una estación de metro. Parseado con el
servicio `mpp-parser`, tiene **300 tareas**. Contando sobre los nombres de tarea reales:

| Palabra | En tareas | Qué hace el motor de P3 |
|---|---|---|
| `Eje` | 56 | nada |
| `Módulo` | 21 | nada |
| `Piso` | 15 | lo resuelve |
| `Edificio` | 7 | nada |
| `Torre` | 5 | nada, **y está bien**: las cinco son «torregrúa» |
| `Nivel` | 4 | nada, **y está bien**: las cuatro son «nivelación hasta nivel superior» |
| `Sótano`, `Cubierta`, abscisa | 0 | — |

**Corrección de una cifra anterior.** La spec de P3 listó esas 4 menciones de `Nivel` en su tabla de
limitación como si fueran ubicaciones. Medido sobre las tareas: **ninguna lo es**. El patrón de P3 exige
un número tras la palabra, así que ya las ignora correctamente; lo que estaba mal era el recuento del
documento, no el código.

Los nombres reales, para ver de qué se habla:

```
Módulo 1.1 (Ejes A-D)          Módulo 2.2 (Ejes J-DB08)
Construcción Losa Aérea (Eje D-H)   Lucarnas (Ejes DB4-DB8)
Edificio 1 (Sur)               Edificio 2 (Norte)
Piso 1 (eje B a 2)             Piso 1 a 2 (eje A)
Solución apuntalamiento … (Eje 3-H)
```

## 2. La idea que ordena el proyecto

Lo tentador sería añadir tres palabras a la lista de patrones y dar el trabajo por hecho. Sería un error,
porque **un eje no es un punto: es un tramo**. `Ejes A-D` no dice «estoy en el eje A», dice «voy del A al
D». Reducirlo a su primer valor es exactamente el fallo mudo que P3 ya dejó anotado para otro caso:

> `Piso 1 (eje B a 2)` y `Piso 1 a 2 (eje A)` son tareas de transición entre dos niveles. El extractor
> devuelve el primer número y descarta el resto en silencio.

**Un tramo entre ejes y una transición entre pisos son la misma cosa**: una ubicación con principio y fin.
Resolver el concepto una vez arregla los dos casos, uno de obra lineal y otro de obra vertical.

Por eso este proyecto **no es «P3 con más palabras»**: es P3 más un concepto que le faltaba.

## 3. Decisiones de diseño

### D1 · `span` es opcional y aditivo

`LocationMatch` gana un campo:

```ts
export interface LocationSpan {
  /** Texto tal cual del principio y del fin. */
  rawFrom: string;
  rawTo: string;
  /** Números ordenables. `from` coincide siempre con `value`. */
  from: number;
  to: number;
}
```

`LocationMatch.span?: LocationSpan`. Todo lo que hoy devuelve un punto **sigue devolviéndolo igual**, sin
`span`. El fixture de DA PORTO de P3 no se toca y debe seguir en verde: es la prueba de que la gramática
nueva no pisa a la anterior.

`value` sigue siendo el número por el que se ordena, y para un tramo es su principio. Así, todo lo que hoy
ordena por `value` sigue funcionando sin enterarse de que existen los tramos.

### D2 · Un eje es una familia y un índice

En el mismo archivo conviven tres formas de nombrar un eje: letras (`A`…`K`), números (`03`, `05`, `07`) y
una serie con prefijo (`DB4`, `DB08`). No son el mismo eje escrito distinto: son **rejillas distintas** de
partes distintas de la obra.

```ts
export interface AxisLabel {
  /** «» para las letras sueltas, «#» para los números, el prefijo para las series («DB»). */
  family: string;
  /** A=1…Z=26 para las letras; el número tal cual para el resto. */
  index: number;
  raw: string;
}
```

Se ordenan **por familia y luego por índice**. Comparar `A` con `03` no significa nada, y el diseño no
finge que sí: los agrupa por familia y deja el orden dentro de cada una.

Es lo único defendible sin conocer la geometría real de la obra, y queda dicho como pregunta abierta.

### D3 · Vocabulario nuevo, en la lista que ya existe

Tres entradas más en `LOCATION_PATTERNS`, con las mismas cautelas que las de P3:

| Patrón | Ejemplo real | `value` |
|---|---|---|
| `Eje` / `Ejes` con rango | `Ejes A-D`, `Eje J-DB08`, `Eje 3-H` | el índice del primero, con `span` |
| `Eje` suelto | `(eje A)` | su índice, sin `span` |
| `Módulo` con decimal | `Módulo 1.1`, `Módulo 2.2` | `1.1`, `2.2` |
| `Edificio` | `Edificio 1 (Sur)` | `1` |

**`Módulo` admite decimal a propósito.** `1.1` y `1.2` son submódulos del módulo 1, y tratarlos como
enteros los fundiría. Como número decimal ordenan solos y en el orden correcto.

**El orden importa, como en P3.** `Módulo 1.1 (Ejes A-D)` contiene los dos patrones; gana el módulo, que es
la unidad de producción, y el eje queda como el detalle de dónde está ese módulo. Se coloca `Módulo` antes
que `Eje` en la lista.

### D4 · Las transiciones de piso

`Piso 1 a 2` pasa a resolverse como un tramo: `value: 1`, `span: { from: 1, to: 2 }`. El patrón de piso de
P3 **no se sustituye**: se le añade delante una variante con rango, que solo casa cuando hay un «a» o un
guion entre dos números.

Esto es una mejora de obra **vertical** que llega de rebote, y conviene decirlo: el archivo DA PORTO no
tiene transiciones, pero otros cronogramas sí, y hoy se resolverían a medias sin avisar.

### D5 · Lo que NO se hace

- **Abscisas** (`K12+340`), que es como se ubica un túnel o una vía. **No aparecen en ningún archivo del
  repositorio.** Implementarlas sería diseñar a ciegas, y ya hay precedente en este proyecto de lo que
  cuesta eso. Queda como pregunta abierta.
- **Dibujar el tramo en la Línea de Balance.** Hoy cada unidad es una fila; un tramo ocupa varias.
  Representarlo bien es una decisión de la vista, no del motor. Este proyecto **deja el dato disponible** y
  la vista se decide cuando se aborde: forzarlo ahora sería inventar una interfaz sin haberla pensado.
- **Cambiar cómo agrupa la Línea de Balance.** Con `value` = principio del tramo, lo que hoy funciona sigue
  funcionando. Aprovechar el `span` es trabajo de otro proyecto.

## 4. Arquitectura

Todo se apoya en el módulo de detección que P3 dejó montado. Ningún archivo nuevo fuera de él.

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `detection/axisLabel.ts` | `parseAxisLabel`, `compareAxisLabels` | nuevo |
| `detection/location.ts` | `LocationSpan`, `span` en `LocationMatch`, patrones nuevos | se amplía |
| `detection/fixtures/estacion16.ts` | Vocabulario real de la Estación 16 con sus esperados | nuevo (test) |
| `detection/index.ts` | Reexporta lo nuevo | se amplía |
| `detection/fixtures/daPorto.ts` | **Intacto.** Es la prueba de no regresión | no se toca |

## 5. Cómo se prueba que funciona

El mismo método que funcionó en P3, que ya cazó un error de patrón antes de llegar a producción: **el
fixture son los nombres reales del archivo**, extraídos del `.mpp` parseado, con los que deben resolver y
los que **deben seguir sin resolver**.

Los negativos de este archivo son especialmente valiosos porque son trampas de verdad:

- las cinco **«torregrúa»**, que parecen una torre;
- las cuatro **«nivelación hasta nivel superior»**, que parecen un nivel;
- `EDIFICIO DESCENDENTE`, que lleva la palabra «edificio» sin número y **no** es una ubicación.

Y sobre todo: **el fixture de DA PORTO de P3 debe seguir en verde sin tocarse.** Si la gramática nueva
pisa a la anterior, se ve ahí.

## 6. Riesgos

**R1 · `Edificio` sin número.** `EDIFICIO DESCENDENTE` no debe resolver. El patrón exige dígitos, igual que
los de P3, y el fixture lo fija como negativo.

**R2 · El rango puede confundirse con un guion decorativo.** «Losa aérea - Eje D» tiene un guion que no es
un rango. El patrón de rango exige **dos etiquetas de eje** alrededor del separador, no una sola.

**R3 · Añadir patrones cambia lo que ya agrupaba.** Es lo que pasó en P3 al derivar `UNIT_PATTERNS`:
`typicalUnit` y `lob` recorren la misma lista para limpiar nombres, así que reconocer «módulo» hará que se
quite del nombre del sistema. **Eso es lo que se busca** —«Losa aérea módulo 1.1» y «Losa aérea módulo 2.1»
deben ser el mismo sistema—, pero hay que comprobarlo, no suponerlo. El plan lo verifica con la suite
completa y con una medición sobre el archivo real.

## 7. Preguntas abiertas

1. **Qué otras obras lineales lleva el usuario.** Solo hay una estación de metro. Túnel y vía se ubican por
   abscisa y no hay ningún archivo que lo muestre.
2. **Cómo se dibuja un tramo en la Línea de Balance.** Decisión de vista, no de motor.
3. **El orden entre familias de eje.** Se ordenan por nombre de familia porque es lo único defendible sin
   conocer la geometría; si la obra tiene un orden real distinto, hay que preguntarlo.
