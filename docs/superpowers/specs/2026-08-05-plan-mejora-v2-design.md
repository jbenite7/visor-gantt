# Plan de mejora visor-gantt v2 — diseño

Fecha: 2026-08-05. Origen: cierre del journey `improve-app` (9 fases) — ver
[PRODUCT.md](../../PRODUCT.md), [DESIGN.md](../../DESIGN.md), [EXPERIMENTS.md](../../EXPERIMENTS.md).

## Problema

La revisión final dio **NOT DONE (6/10)**. Las ocho fases anteriores arreglaron lo que estaba roto
(pérdida de datos, errores mudos, criticidad invisible, INP de 584 ms). Queda lo que **sobra**: la app
abre con 14 puertas y no dice cuál abrir; con un cronograma corriente, cuatro dan a una habitación vacía.

## Decisiones tomadas (grilleo del 2026-08-05)

| Decisión | Elección | Consecuencia |
|---|---|---|
| ¿Ver `.mpp` sin cuenta? | **No, la cuenta se queda** | E51 sale del plan. Se acepta mantener 6 pasos hasta el valor y la distancia frente al visor 1.0 |
| ¿Cuánto recortar? | **Recorte completo: 14 → 9** | Se ejecutan C1-C6 de PRODUCT.md |
| ¿Vistas sin datos? | **Siempre visibles, explicando el vacío** | El menú no cambia entre proyectos; el usuario aprende dónde está cada cosa |
| ¿Qué más entra? | **Ayuda por vista + progreso de importación + cerrar el deshacer** | Cuatro entregas |

## Alcance

**Dentro:** recorte 14→9, ayuda por vista (E8), progreso de importación (E4), cierre del deshacer
(E24 parcial, E12, E13).

**Fuera, y por qué:** modo sin cuenta (descartado arriba); medición de campo real E47 (necesita usuarios,
no código); cosméticos sueltos E21/E22 (se resuelven de paso al tocar cada archivo).

## Diseño

### Entrega 1 — El recorte (14 → 9)

`VIEW_TABS` en `src/components/gantt/toolbar/ViewSidebar.tsx:27` es la **única fuente** de la lista, así
que el recorte es un cambio de datos más el enrutado de las vistas absorbidas.

| Vista final | Absorbe | Mecanismo |
|---|---|---|
| **Gantt** | Seguimiento, Hoja Tareas | Dejan de ser entradas del menú y pasan a ser **dos presets nuevos** en `lib/gantt/roleViewPresets.ts`, junto a los tres que ya existen (Planificador / Dirección / Obra). El selector «Vista rol» de la barra superior es el único control; no se añade otro. Sus componentes (`TrackingGanttView`, `TaskSheetView`) siguen existiendo y montándose según el preset activo |
| **Problemas** (renombra «Cuellos») | Conflictos | Una vista con dos secciones. Resuelve de paso que ambas compartían el icono `AlertTriangle` |
| Ejecutivo, Línea Balance, Curva S, Unidad Típica, Recursos, Calendario, Configuración | — | Sin cambios |

- **Diagrama de Red**: sale del menú, **no se borra**. Sigue accesible desde `Cmd+K`, donde ya está
  registrada como comando.
- **Matriz**: deja de ser vista. Su único contenido real («Crear matriz») se mueve a `/project/new`, que es
  donde crear una matriz tiene sentido. El editor sigue existiendo para los proyectos que ya la usan.
- `ViewType` se mantiene como tipo (lo consumen `ProjectToolbar` y los E2E); solo cambia qué entra en
  `VIEW_TABS`.

**Riesgo y mitigación:** `ViewType` aparece en tests E2E (`sidebar-view-*`). Esta entrega va **primera** y
no avanza hasta tener la suite completa en verde.

### Entrega 2 — Ayuda por vista (E8)

Hay **18 textos de ayuda ya escritos** en `commandActions` (`GanttView.tsx`, campo `hint`). No hay que
redactar: hay que mover.

1. Extraer a `src/lib/gantt/viewHelp.ts`: un mapa `ViewType → { título, para qué sirve, qué necesita }`,
   redactado con el tono de POSITIONING.md (nombrar el trabajo, no la infraestructura).
2. Consumirlo en **dos sitios**, para que ayuda y vacío digan lo mismo escrito una sola vez:
   - Un panel «¿Qué es esta vista?» accesible desde la vista.
   - El estado vacío de cada vista (patrón ya aplicado en `typicalUnit.ts`).
3. La paleta de comandos pasa a leer de ese módulo en vez de tener el texto embebido.

### Entrega 3 — Progreso de importación (E4)

En `HomeMppUploadAction.tsx` y `api/import-mpp/route.ts`:

- Tres fases visibles: **subiendo → analizando → guardando**.
- `AbortController` con timeout explícito, y botón **Cancelar** mientras corre.
- Al terminar, resumen de lo importado (N tareas, N dependencias, N recursos) — cierra también E32.

No baja la latencia real (~36 s para 11 MB): la convierte en espera legible.

### Entrega 4 — Cerrar el deshacer

- Envolver con `runUndoable` lo que quedó fuera en E24: editar recurso, editar partida,
  `handleSyncMatrixFromGantt`, reset de columnas.
- `Ctrl+Z` anuncia qué deshizo, usando la `description` que cada comando ya lleva (E12).
- Indicador de guardado permanente con hora del último guardado y reintento en el error (E13).

## Cómo se construye

- **TDD estricto**: test primero, verlo fallar, código mínimo. Sin excepciones.
- **Cuatro entregas independientes y desplegables por separado.** Si se para tras cualquiera, la app queda
  coherente.
- **Verificación por entrega**: suite completa + lint + `next build` + comprobación en navegador sobre
  `/gantt-demo` con el contenedor reconstruido.

## Criterio de hecho

1. El menú lateral muestra **9 vistas**, ninguna con etiqueta truncada.
2. Ninguna capacidad desaparece: Diagrama de Red sigue accesible por `Cmd+K`; el editor de matriz sigue
   funcionando para proyectos que la usan.
3. Cada una de las 9 vistas explica para qué sirve, y su estado vacío dice qué necesita el cronograma.
4. La importación muestra fase, permite cancelar y termina con un resumen de lo importado.
5. Toda acción destructiva es deshacible o confirmada; `Ctrl+Z` dice qué deshizo.
6. Suite completa en verde, lint limpio y `next build` correcto en cada entrega.
