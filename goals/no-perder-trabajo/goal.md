---
tipo: goal
estado: abierto
fecha: 2026-08-07
areas: [datos, cronograma, ux]
carril: A
proyecto: P1
fuente: docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md
resumen: "Cerrar los dos bugs de pérdida de datos confirmados: observaciones que no se guardan y líneas base desconectadas"
---

# P1 · No perder trabajo

## Objetivo

Que ninguna acción del usuario pierda trabajo en silencio. Se anota una observación en obra y queda guardada
al instante; se pulsa «Línea base» y la comparación se dibuja donde se pulsó, con un nombre puesto por quien
la guarda y la posibilidad de borrarla. Y si algo queda pendiente de guardar, la app avisa antes de cerrar.

Es el primer proyecto del [goal maestro](../evolucion-visor-v2/goal.md), carril A, y es **urgente**: hasta que
esté hecho, anotar y cerrar la pestaña puede perder lo escrito.

## De dónde sale

Dos hallazgos de gravedad crítica del inventario de 16 módulos, más tres remates de la misma familia:

| # | Hallazgo | Archivo |
|---|---|---|
| M24 | Las observaciones no disparan el autoguardado: `observations` falta en las dependencias del efecto temporizado | `v2/src/components/views/GanttView.tsx:1202-1216` |
| M13 | Dos sistemas de líneas base desconectados: el botón visible guarda pero nunca dibuja; el que dibuja usa estado local que no se guarda | `v2/src/components/views/GanttView.tsx:326-568` y `v2/src/components/views/TrackingGanttView.tsx:470-483` |
| M33 | Sin aviso al cerrar con cambios pendientes | `v2/src/components/views/GanttView.tsx:1182-1226` |
| M22 | El import de `.mpp` nunca trae las líneas base del archivo | decidido: **no se importan**, se empieza en limpio |
| — | «Reintentar» del indicador de guardado es texto, no un botón | `v2/src/lib/gantt/saveStatusLabel.ts:19` |

Las decisiones están tomadas en [la spec del grilleo del 2026-08-06](../../docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md),
sección «Decisiones del Bloque D». No se reabren.

## Alcance

**Dentro:**
- Guardado inmediato de observaciones, sin esperar al temporizador de 750 ms.
- Un solo sistema de líneas base: el que se persiste en `ProjectData.baselines`.
- El Gantt principal dibuja la comparación con la línea base activa.
- Nombrar la línea base al guardarla y poder borrarla (deshacible).
- Aviso al cerrar la pestaña **solo si** hay algo pendiente de guardar.
- «Reintentar» como botón real en el indicador de guardado.
- Traducción al español de la sub-barra de Seguimiento, que hoy está en inglés.

**Fuera:**
- Importar las líneas base del `.mpp` (M22): decidido en firme, se empieza en limpio.
- Pedir responsable al anotar una observación (M32) y la vista de observaciones del proyecto: van en P2.
- Cualquier cambio en `v2/src/lib/matrix/*` o en el motor de detección: territorio del carril B.

## Condición de hecho

1. Anotar, atender o borrar una observación llama a `saveProject` **sin avanzar el temporizador**, y hay un
   test que lo prueba con temporizadores falsos.
2. La línea base activa se dibuja en el Gantt principal, no solo en Seguimiento, y sobrevive a una recarga.
3. `TrackingGanttView` no tiene estado propio de líneas base: las recibe por props.
4. Guardar pide nombre; borrar es deshacible con `Ctrl+Z`.
5. Cerrar con cambios pendientes avisa; sin cambios pendientes, no.
6. `npx jest --runInBand` en verde, `npx eslint` limpio, `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`
   vacío, `npx next build` correcto, y comprobación en navegador de los dos flujos.

## Archivos de este proyecto

- [spec](../../docs/superpowers/specs/2026-08-07-no-perder-trabajo-design.md) — el diseño
- [plan](../../docs/superpowers/plans/2026-08-07-no-perder-trabajo.md) — el plan de ejecución TDD

## Cerrado 2026-08-08

Ejecutado y fusionado a `claude/suspicious-joliot-8f08ea`. Las seis piezas están en pie y verificadas en
navegador: anotar dispara el guardado **a los 60 ms**, la línea base activa dibuja en el Gantt principal,
borrarla es deshacible con `Ctrl+Z`, y cerrar con trabajo pendiente pregunta.

**Dos defectos que solo aparecieron al verificar, no al diseñar:**
- El grupo de línea base de la barra estaba en `display: none` sin ninguna regla que lo reactivara: el control
  que el inventario llamó «el más visible» no se veía en ninguna anchura.
- Un guardado fallido dejaba el proyecto marcado como limpio, así que el aviso al cerrar dejaba pasar trabajo
  que se iba a perder.

Evidencia en [docs/EXPERIMENTS.md](../../docs/EXPERIMENTS.md), tarjeta «P1 · No perder trabajo».
