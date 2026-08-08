---
tipo: goal
estado: abierto
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

## Condición de hecho

1. Sobre el vocabulario real de la Estación 16, el motor resuelve los 56 `Eje`, los 21 `Módulo` y los 7
   `Edificio`, además de los 15 `Piso` que ya resolvía.
2. `Ejes A-D` da un tramo con principio y fin, no un punto; y `Piso 1 a 2` también.
3. Las cinco «torregrúa» y las cuatro «nivelación hasta nivel superior» **siguen sin resolver**: el
   fixture las incluye como negativos para que nadie afloje un patrón sin romper otro.
4. **Ningún archivo de obra vertical cambia de resultado.** El fixture de DA PORTO de P3 sigue en verde sin
   tocarse: es la prueba de que la gramática nueva no pisa a la anterior.
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
