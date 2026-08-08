---
tipo: goal
estado: abierto
fecha: 2026-08-07
areas: [matriz, cronograma, producto]
carril: B
fuente: docs/superpowers/specs/2026-08-07-matriz-como-producto-design.md
plan: docs/superpowers/plans/2026-08-07-matriz-como-producto.md
padre: goals/evolucion-visor-v2/goal.md
depende_de: goals/motor-deteccion/goal.md
resumen: "P4: convertir la programación matricial de un prototipo escondido en el módulo que arma un cronograma de obra y aprende de lo ejecutado"
---

# P4 · La matriz como producto

## Objetivo

La programación matricial es **el módulo más potente y el peor conectado** del visor. Ya genera un
cronograma completo a partir de alcances × ubicaciones × recetas, pero lo hace con su propio calendario
(«salta domingos»), con un desfase fijo entre pisos que no es una dependencia real, sin editor de recetas,
sin plantillas propias, sin poder aprobar los rendimientos que ella misma calcula, resolviendo los
conflictos en silencio y ahogándose por encima de unos cientos de celdas.

Este proyecto la convierte en producto: **que sirva para armar la obra, y que aprenda de la obra**.

## De dónde sale

**Bloque E** de [la spec del grilleo del 2026-08-06](../../docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md),
10 decisiones, más los hallazgos **M27** (fuera del menú) y **M28** (el borrador se pierde sin aviso).

## Qué se construye

| Decisión del grilleo | Qué se construye |
|---|---|
| Ritmo piso a piso | **Dependencias reales** entre ubicaciones, configurables por alcance: estructura encadena, acabados de torres distintas van en paralelo |
| Calendario | La matriz usa el **calendario del proyecto** (festivos, jornada) y avisa si al aplicarlo las fechas se desplazan mucho |
| Plantillas | Plantillas de fábrica por tipo de obra, **guardar la tuya**, y **generador a partir de un `.mpp` cargado** que propone alcances, ubicaciones, recetas y rendimientos para que el usuario revise |
| Recetas | **Editor completo**: añadir, quitar, reordenar actividades y definir cómo se encadenan |
| Rendimiento observado | **Panel para aprobar** los rendimientos reales que la app ya calcula y hoy nadie ve |
| Conflictos al aplicar | **Mostrarlos y elegir cuál gana**, tarea por tarea |
| Duplicar | Duplicar ubicación o alcance con sus celdas, y **crear N ubicaciones de golpe** («pisos 1 a 20») |
| Edición en lote | **Seleccionar varias celdas** (o fila/columna) y aplicarles receta, cantidad o activación |
| Escala | Aguantar **más de 1000 celdas** sin recalcular en cada tecla ni dibujar lo que no se ve |
| M27 · M28 | La matriz **vuelve al menú** y **avisa antes de salir** con cambios sin aplicar |

## Condición de hecho

1. Un cronograma generado desde la matriz **respeta los festivos y la jornada del proyecto**, y si al
   aplicar el calendario alguna tarea se desplaza más de tres días, la matriz lo dice antes de aplicar.
2. Retrasar el piso 1 en un alcance encadenado **mueve el piso 2**. En un alcance en paralelo, no.
3. Cargar un `.mpp` y pedir «generar matriz» produce una **propuesta revisable** —alcances, ubicaciones,
   recetas y rendimientos— que el usuario acepta, corrige o descarta antes de que toque nada.
4. Un rendimiento observado se puede **aprobar desde un panel**, y la siguiente generación lo usa.
5. Un conflicto entre matriz y Gantt se **muestra tarea por tarea con las dos versiones** y el usuario
   elige cuál gana.
6. Una matriz de **1200 celdas** se edita sin bloquear la pantalla.
7. La matriz está **en el menú**, dentro de «Trabajo», y avisa al salir con cambios sin aplicar.
8. Suite completa, lint, `tsc` filtrado vacío, `next build` y comprobación en navegador sobre la ruta de
   la matriz.

## Restricciones

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, código mínimo.
- **La Fase 3 (integración) depende del carril A.** Las Fases 1 y 2 —los siete archivos de
  `v2/src/lib/matrix/` y `MatrixEditorView.tsx`— avanzan sin esperar a nadie. La Fase 3 toca
  `GanttView.tsx` y `ProjectContext.tsx`, **propiedad del carril A**, y **no se empieza hasta que el
  carril A haya fusionado su trabajo a `main`**.
- **P3 va antes**: el generador de matrices desde `.mpp` usa el motor de detección. La Fase 1 sin él
  propondría los mismos 44 fallos.
- Copy en español con tildes, lenguaje de obra.
- Rama propia (`carril-b/matriz-como-producto`), fusionada a `main` al pasar su revisión.

## Fuera de alcance

- **Deshacer paso a paso dentro de la matriz.** El grilleo lo dejó como objetivo, con «Descartar cambios
  con confirmación» como lo que se hace ahora. Eso último es del carril A (es un cambio en la barra), y el
  deshacer granular es un proyecto propio. Sí entra, en cambio, que **borrar una ubicación con tareas ya
  generadas avise, deje elegir y sea deshacible** con el `runUndoable` que ya existe: no es un deshacer
  nuevo, es aplicar el criterio de «nada se pierde en silencio» al único borrado que hoy no lo cumple.
- **Cantidades de obra medidas.** La matriz seguirá calculando duración desde cantidad y rendimiento; de
  dónde salen las cantidades reales es harina de otro costal.
- **Editor de dependencias arrastrando** en el Diagrama de Red: es P5.
