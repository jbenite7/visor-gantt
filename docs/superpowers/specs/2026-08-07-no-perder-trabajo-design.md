# P1 · No perder trabajo — diseño

Fecha: 2026-08-07. Carril A, primer proyecto del [goal maestro](../../../goals/evolucion-visor-v2/goal.md).
Requisitos: [spec del grilleo del 2026-08-06](2026-08-06-supergoal-backlog-ux-design.md) — las decisiones ya
están tomadas y este documento no las reabre, solo las convierte en diseño técnico.

Goal: [goals/no-perder-trabajo/goal.md](../../../goals/no-perder-trabajo/goal.md).

## Problema

Dos bugs de pérdida de datos confirmados leyendo el código, no inferidos.

### M24 · Las observaciones no se guardan solas

El efecto que marca el proyecto como sucio y arma el temporizador de autoguardado
(`GanttView.tsx:1182-1216`) lista trece dependencias —`tasks`, `resources`, `assignments`, `budgetItems`,
`budgetMappings`, `baselines`, `calendar`, `syncedMatrixPlan`, los tres `columnSettings`, `uiSettings` y
`projectName`— y **no lista `observations`**. La función que arma la carga sí las incluye
(`GanttView.tsx:894`), así que las observaciones se persisten *cuando otra cosa dispara el guardado*: pulsar
«Guardar ahora», tocar cualquier otro dato, o desmontar la vista limpiamente (`GanttView.tsx:1218-1226`).

Un cierre de pestaña o una recarga dura no desmontan limpiamente. Se pierde lo anotado. Y anotar sobre la
barra es exactamente el loop que el propio código documenta como «lo que hacía valioso al visor 1.0»
(`v2/src/lib/observations/observations.ts:1-6`).

### M13 · Dos sistemas de líneas base

| Dónde | Qué hace | Qué le falta |
|---|---|---|
| Barra principal (`GanttView.tsx:326-568`, `ProjectToolbar.tsx:252-305`) | Guarda en el estado `baselines`, que **sí** viaja en `ProjectData` y se serializa (`app/actions/project.ts:157-215`), y selecciona una activa | **Nunca dibuja nada.** `activeBaselineId` solo alimenta la etiqueta del desplegable |
| Seguimiento (`TrackingGanttView.tsx:470-483`) | Dibuja barras fantasma, variaciones y colores por desviación | Su `useState<Baseline[]>([])` **es local**: no se guarda, no se comparte, y arranca vacío en cada montaje |

Resultado: el control más visible no hace lo que promete, y el que funciona pierde el trabajo al cambiar de
vista. Además `GanttView.handleSaveBaseline` duplica a mano la lógica de
`v2/src/lib/scheduling/baseline.ts:saveBaseline`, con nombres en inglés (`Baseline 1`).

### Los tres remates de la misma familia

- **M33**: no hay ningún `beforeunload`. El guardado es por temporizador de 750 ms
  (`GanttView.tsx:105`), así que cerrar rápido tras editar pierde lo último.
- **«Reintentar»**: `saveStatusLabel` devuelve la cadena `"No se pudo guardar. Reintentar"`
  (`saveStatusLabel.ts:19`) dentro de un `<span role="status">`. No se puede pulsar.
- **Sub-barra de Seguimiento en inglés**: «Save Baseline», «None», «N tasks · N behind, N ahead».

## Decisiones de diseño

### 1. Guardado inmediato de observaciones — no basta con añadir la dependencia

La decisión del grilleo es explícita: *«se guardan al instante, sin esperar al temporizador: una anotación es
un acto único, no hay nada que agrupar»*. Añadir `observations` al array de dependencias del efecto
existente daría guardado a los 750 ms, no inmediato, y seguiría perdiendo la anotación de quien cierre en ese
intervalo.

**Diseño:** un efecto propio, separado del temporizado, que al cambiar `observations` (saltando el montaje)
cancela el temporizador pendiente y llama a `doSaveRef.current()` de inmediato.

Se separa en vez de reutilizar el efecto grande porque son dos políticas distintas de guardado sobre el mismo
estado, y mezclarlas obligaría a saber *cuál* de las trece dependencias cambió. Se guardan también, de paso,
todos los demás cambios pendientes: `doSave` serializa el proyecto completo.

**Riesgo asumido:** si alguien teclea una observación tras otra muy rápido, habrá una llamada por observación
en vez de una agrupada. Es aceptable: crear una observación exige escribir texto y pulsar guardar en el panel
(`ObservationPanel.tsx:36-42`), no es un evento por tecla.

### 2. Un solo sistema de líneas base, el que se persiste

`ProjectData.baselines` gana. `TrackingGanttView` deja de tener estado: pasa a **componente controlado** que
recibe `baselines`, `activeBaselineId`, `onSaveBaseline`, `onSelectBaseline` y `onDeleteBaseline` por props,
igual que ya hace `ProjectToolbar`. `GanttView` es el único dueño.

`GanttView.handleSaveBaseline` se reescribe sobre `saveBaseline()` de
`v2/src/lib/scheduling/baseline.ts`, que ya está probado (`baseline.test.ts`), en vez de duplicar el mapeo.

### 3. El Gantt principal dibuja la comparación

`GanttChart` gana una prop opcional `showBaseline?: boolean`. Cuando es `true`, pinta para cada tarea con
`baselineStart` y `baselineFinish` una barra fantasma detrás de la real, en la misma capa y con la misma
geometría que ya usa `TrackingGanttChart` (`TrackingGanttView.tsx:250-280`).

`GanttView` calcula `tasksForChart = activeBaseline ? applyBaselineToTasks(calculatedTasks, activeBaseline) : calculatedTasks`
—`applyBaselineToTasks` ya existe y no muta— y lo pasa al chart junto con `showBaseline={Boolean(activeBaseline)}`.

**Por qué barra fantasma y no una segunda fila:** las barras fantasma son el patrón que el propio producto ya
usa en Seguimiento; introducir un segundo lenguaje visual para el mismo dato sería peor que no dibujarlo.

**Sin color nuevo:** la barra fantasma usa `var(--color-text-muted)` con opacidad, que es lo que ya emplea
Seguimiento. No se añade ningún token a `globals.css`.

### 4. Nombrar al guardar y poder borrar

El grupo de línea base de `ProjectToolbar` se extrae a un componente propio,
`v2/src/components/gantt/toolbar/BaselineMenu.tsx`, porque pasa de dos controles a cinco y `ProjectToolbar`
ya tiene 300+ líneas.

- **Guardar**: abre un campo de nombre con un valor propuesto —`Línea base 1`, `Línea base 2`…— que el
  usuario puede cambiar. Enter guarda; Escape cancela. Si el nombre queda vacío se usa el propuesto: nunca se
  bloquea el guardado por un campo en blanco.
- **Borrar**: dentro del desplegable, junto a cada línea base, con etiqueta de texto («Borrar»), no solo
  icono. Pasa por `runUndoable` del contexto (`ProjectContext.tsx`), la misma primitiva que ya hace
  deshacibles borrar recurso o partida. Si se borra la activa, la selección queda en ninguna.

**Pregunta abierta anotada, no inventada:** la spec no dice si debe haber un tope de líneas base
(MS Project permite 11; `baseline.ts:1-6` dice explícitamente que este módulo no lo impone). Este proyecto
**no impone tope**, y se anota como decisión pendiente si el uso real lo pide.

### 5. Aviso al cerrar solo si hay algo pendiente

Hoy lo pendiente vive en `isDirtyRef`, una `ref`: no puede gobernar el registro de un listener. Se añade
`hasPendingChanges` como estado, espejo de la ref, que pasa a `true` cuando el efecto marca sucio y a `false`
cuando `doSave` termina bien. Un efecto registra `beforeunload` **solo mientras** es `true`, de modo que un
usuario sin cambios nunca ve el diálogo del navegador.

El navegador no permite personalizar ese texto: se llama a `event.preventDefault()` y se asigna
`event.returnValue = ""`, que es lo que Chrome y Safari respetan hoy.

### 6. «Reintentar» como botón

`saveStatusLabel` deja de meter la palabra dentro del mensaje: pasa a devolver solo
`"No se pudo guardar"`. El botón se renderiza aparte, en el mismo contenedor del indicador, únicamente
cuando `saveStatus === "error"`, y su `onClick` es `handleManualSave`, que ya existe
(`GanttView.tsx:919-926`) y fuerza `isDirtyRef.current = true` antes de guardar.

## Alcance

**Dentro:** los seis puntos de arriba, más traducir la sub-barra de Seguimiento al español y renombrar los
valores por defecto de línea base a «Línea base N».

**Fuera:**
- Importar líneas base del `.mpp` (M22) — decidido en firme el 2026-08-06.
- Responsable en la observación (M32) y vista de observaciones del proyecto — van en P2.
- Comparar la Curva S contra la línea base — es del bloque de analíticos, P5.

## Ninguna capacidad desaparece

| Lo que hay hoy | Dónde queda |
|---|---|
| Guardar línea base desde la barra principal | Igual, ahora pidiendo nombre |
| Guardar línea base desde Seguimiento | Igual, mismo botón, ahora escribe en el estado compartido |
| Selector de línea base en Seguimiento | Igual, ahora sincronizado con el de la barra |
| Barras fantasma y variaciones en Seguimiento | Igual, más disponibles ahora en el Gantt principal |
| Texto «Reintentar» del indicador | Botón de verdad, mismo sitio |

## Riesgos

1. **Cambiar el efecto de autoguardado toca el corazón de la persistencia.** Se mitiga con un efecto nuevo y
   separado en vez de tocar la lista de dependencias existente, que ya tiene cobertura en 20+ tests de
   `GanttView.test.tsx`.
2. **El test `autosaves baseline snapshots` (`GanttView.test.tsx:1129`) se romperá** al introducir el campo de
   nombre: hoy pulsa `getByTitle("Guardar línea base")` y espera que guarde en un paso. El plan lo actualiza
   explícitamente en la misma tarea, no lo borra.
3. **`beforeunload` no es testeable en Playwright con fiabilidad.** Se prueba en Jest disparando el evento y
   comprobando `defaultPrevented`, y se verifica a mano en el navegador.

## Cómo se construye

TDD estricto: test primero, verlo fallar por el motivo esperado, código mínimo. Directorio `v2/`.
Verificación: `npx jest --runInBand`, `npx eslint <archivos>`,
`npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` (vacío) y `npx next build`.

Plan: [2026-08-07-no-perder-trabajo.md](../plans/2026-08-07-no-perder-trabajo.md).

## Criterio de hecho

El de [goals/no-perder-trabajo/goal.md](../../../goals/no-perder-trabajo/goal.md), sin excepciones.
