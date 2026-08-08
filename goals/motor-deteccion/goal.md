---
tipo: goal
estado: abierto
fecha: 2026-08-07
areas: [cronograma, deteccion, matriz]
carril: B
fuente: docs/superpowers/specs/2026-08-07-motor-deteccion-design.md
plan: docs/superpowers/plans/2026-08-07-motor-deteccion.md
padre: goals/evolucion-visor-v2/goal.md
resumen: "P3: que el visor reconozca el piso y el sistema de cada tarea con nombres de obra reales, incluidos los sótanos, y que aprenda de las correcciones del usuario"
---

# P3 · Motor de detección

## Objetivo

Que el visor reconozca **a qué piso y a qué sistema pertenece cada tarea** con los nombres que la obra
escribe de verdad. Hoy falla en **44 de 239 tareas** de un archivo real, y esas 44 no son un caso raro: son
los sótanos, la cubierta y todo lo que nombra su ubicación en la tarea padre en vez de en la propia tarea.

Va aparte porque **mejora tres módulos a la vez** —Línea de Balance, Unidad Típica y el generador de
matrices— y ninguno rinde hasta que esto funcione.

## De dónde sale

- **Bloque F** de [la spec del grilleo del 2026-08-06](../../docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md),
  2 decisiones: portar las dos piezas de PDC V2 (`lps-aia`) y añadir un diccionario que se llene con las
  correcciones del usuario, probado antes que lo automático.
- La medición de PDC V2: **820 filas, 2 sin resolver** con la cascada; **1 de 820** con emparejamiento
  ingenuo por nombre.
- Los nombres reales de `aia-ms-project/20260312 DA PORTO TORRE 3.mpp`, que son la evidencia de por qué
  falla el motor actual: `LOSA AÉREA SÓTANO 1`, `COLUMNAS SÓTANO 3`, `PISO CUBIERTA`,
  `MAMPOSTERÍA › INTERNA › SÓTANO 2`.

## Qué se construye

1. **Extractor de ubicación** portado de `ActivityMatcherService::extractLocationValue`: cubre `Piso`,
   `Nivel`, `Planta`, `Etapa`, `Sótano` (**como negativo**, para poder ordenarlos), `Torre`, `Zona`,
   `Sector`, `Tramo`, `mezanine` y los códigos `P01`/`S1`.
2. **Cascada de resolución** portada de `AmarreCronogramaService`: **diccionario curado → nombre exacto →
   similitud de palabras (Jaccard, umbral 0,33)**, con la evidencia de por qué resolvió así.
3. **Diccionario que aprende**: las correcciones del usuario se guardan y se prueban **antes** que lo
   automático.
4. **Frontera de proveedor**: el motor se consume por una interfaz, de modo que mañana pueda vivir detrás
   de una API sin tocar a quien lo llama.
5. **Cableado** de Línea de Balance y Unidad Típica al motor nuevo, con los sótanos ordenados por debajo
   del piso 1.

## Condición de hecho

1. Sobre el vocabulario real del archivo DA PORTO (fijado como fixture en el repositorio), el extractor
   resuelve ubicación para **todas las tareas de estructura y acabados**, sótanos y cubierta incluidos.
   Las de urbanismo, que no tienen ubicación por piso, se marcan explícitamente como «obra general», no
   se descartan en silencio.
2. La cascada distingue `CARPINTERIA EN MADERA` de `VENTANERÍA` (el caso que el texto resuelve mal) porque
   el diccionario gana al automático.
3. Unidad Típica y Línea de Balance ordenan `SÓTANO 3 < SÓTANO 1 < PISO 1 < PISO 12 < CUBIERTA`.
4. Suite completa, lint, `tsc` filtrado vacío y `next build` en verde.

## Restricciones

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, código mínimo.
- **No se toca `GanttView.tsx` ni `ProjectContext.tsx`** — son del carril A (regla del goal maestro).
- Copy en español con tildes, lenguaje de obra.
- Rama propia (`carril-b/motor-deteccion`), fusionada a `main` al pasar su revisión.

## Fuera de alcance

- **Llamar al motor por API**: se deja la frontera preparada, no el cliente HTTP. Sin un servicio
  desplegado que lo sirva, sería código muerto.
- **Corregir la ubicación a mano desde la interfaz** de Línea de Balance (M10 / Bloque G): el motor expone
  el diccionario y la API para hacerlo; la pantalla que lo usa es de otro proyecto.
- **Cantidades de obra**: sin ellas «productividad» sigue siendo ritmo. No se resuelve aquí.
