# P2 · Cerrar el backlog de UX — diseño

Fecha: 2026-08-07. Carril A, segundo proyecto del [goal maestro](../../../goals/evolucion-visor-v2/goal.md),
después de [P1](2026-08-07-no-perder-trabajo-design.md).
Requisitos: [spec del grilleo del 2026-08-06](2026-08-06-supergoal-backlog-ux-design.md). Las decisiones ya
están tomadas; este documento las convierte en diseño técnico sobre el código real.

Goal: [goals/cerrar-backlog-ux/goal.md](../../../goals/cerrar-backlog-ux/goal.md).

## Problema

27 experimentos vivos y un patrón que el inventario nombró bien: **funciones construidas que nadie puede
alcanzar, y controles que no hacen lo que su nombre dice.** Comprobado en el código, no inferido:

| Hecho | Dónde |
|---|---|
| El login manda el mensaje de error **en la URL** (`/login?error=<texto>`) y no conserva el correo | `src/app/actions/auth.ts:7-24`, `src/app/login/page.tsx:40-59` |
| El límite de 50 MB solo aparece **después** de rechazar el archivo | `src/components/upload/HomeMppUploadAction.tsx:17-26` |
| Los errores del analizador llegan al usuario **sin traducir**: la ruta reenvía el texto crudo del microservicio | `src/app/api/import-mpp/route.ts:73-79` |
| `WarningList` existe y **no lo importa nadie** | `src/components/upload/WarningList.tsx` |
| `MPPUploader` sigue vivo y **sin importador** (E17 a medias) | `src/components/upload/MPPUploader.tsx` |
| Las columnas MPP **convierten texto en `0`** en silencio, teniendo `parseNumericFieldInput` a mano | `src/components/gantt/table/GanttRow.tsx:207-215` |
| Las predecesoras mal escritas se **descartan en silencio** (`if (!match) continue`) | `src/components/gantt/table/GanttRow.tsx:134` |
| Las **filas resumen son editables** como cualquier otra | `src/components/gantt/table/GanttRow.tsx:272-514` |
| Se entra en edición **solo con doble clic**; no hay Enter ni F2 | `src/components/gantt/table/EditableCell.tsx:63-78` |
| Los tiradores de resize existen pero son `fill="transparent"`: **invisibles siempre** | `src/components/gantt/bars/TaskBar.tsx:186-216` |
| El fantasma de arrastre **no dice la fecha destino**, solo un rectángulo punteado | `src/components/gantt/bars/TaskBar.tsx:218-233` |
| Durante el arrastre el tipo de vínculo se adivina por el borde de origen (`"FS" : "SS"`), no por el real | `src/components/gantt/GanttChart.tsx:415` vs `useCreateDependency.ts:40-48` |
| `changedTaskIds` se calcula y **solo alimenta el registro de auditoría**: no resalta nada | `src/lib/state/ProjectContext.tsx:133-149, 344, 373, 431` |
| El modo Avanzado **solo** muestra un desplegable | `src/components/views/GanttView.tsx:1363` |
| La **Matriz no está en el menú**: `VIEW_TABS` tiene 9 entradas y ninguna es `matrix` | `src/components/gantt/toolbar/ViewSidebar.tsx:24-34` |
| La paleta filtra con `String.includes`: **un error de tecleo y no encuentra nada** | `src/components/views/GanttView.tsx:1068-1075` |
| El botón de la paleta **no muestra `⌘K`** | `src/components/views/GanttView.tsx:1332-1341` |
| El botón rotulado **`L1` aplica el nivel 2** | `src/components/gantt/table/GanttTable.tsx:530-536` |
| No hay **ningún esqueleto**: solo el texto «Cargando cronograma...» | `src/app/project/[id]/ProjectView.tsx:199-229` |
| «Copiar Excel» copia **TSV**; «PDF» es `window.print()` | `src/lib/gantt/scheduleExchange.ts:41-71`, `src/components/reports/ExecutivePlanningDashboard.tsx:69-72` |
| La **API de Last Planner** solo la referencia su propio test | `src/app/api/integrations/last-planner/preview/route.ts` |
| El CSV de Last Planner exporta **«Responsable» siempre vacío** | `src/lib/observations/observations.ts:107-118` |
| Con cero tareas, `computeEarnedValueSCurve` devuelve **`spi: 1, cpi: 1`**: semáforo verde de un proyecto vacío | `src/lib/scheduling/scurve.ts:277-280` |
| El tablero ejecutivo **no muestra fecha de corte** ni enlaza a ningún detalle | `src/lib/gantt/executiveDashboard.ts:69-81`, `ExecutivePlanningDashboard.tsx:153-176` |
| **Dos definiciones de sobreasignado**: semanal en Uso de Recursos, diaria en Problemas | `ResourceUsageView.tsx:288` vs `src/lib/scheduling/assignments.ts:62` |
| Las **asignaciones no se pueden crear ni borrar** | `src/components/views/AssignmentSheetView.tsx:20-30` |

## Estructura: cuatro entregas desplegables

Orden decidido en el grilleo: **Entrada → Tabla → Pulido**, y las conexiones del Bloque D al final, porque
varias de ellas aterrizan en el menú que la entrega C reorganiza.

Si el trabajo se para entre entregas, la app queda coherente. Dentro de una entrega, no.

## Decisiones de diseño por entrega

### Entrega A · La entrada

**El error del login deja de viajar por la URL.** Hoy `loginErrorUrl` mete el mensaje en `?error=`, que es
falsificable: cualquiera puede enviar un enlace que pinte el texto que quiera bajo la marca del producto. Se
sustituye por **códigos**: `?error=credenciales`, `?error=faltan-datos`, `?error=sin-cuenta`, que el servidor
traduce a texto. Un código desconocido no pinta nada.

**El correo sobrevive al intento fallido** viajando también por la URL —`?correo=`— como `defaultValue` del
campo. Es un dato que el propio usuario acaba de escribir, no un secreto.

**Contraseña olvidada:** texto que dirige al administrador del proyecto. No se monta recuperación por correo:
sería un proyecto propio, y el grilleo así lo decidió.

**Errores del analizador:** un módulo nuevo `src/lib/import/parserErrors.ts` traduce lo que devuelve el
microservicio a causa probable en lenguaje de obra. El detalle técnico se queda en el registro del servidor
(`console.error` en la ruta), nunca en pantalla.

**`WarningList` vive o se borra.** Decisión: **vive**, conectado al resumen de importación, para cerrar E33
(«las pérdidas silenciosas se anuncian»). `MPPUploader`, en cambio, **se borra**: es la ruta muerta que el
Bloque 0 dejó pendiente, y mantener dos flujos de subida es exactamente lo que produjo esta confusión.

### Entrega B · Tabla y Gantt

**Solo lectura de lo calculado.** `EditableCell` ya tiene `readOnly`; lo que falta es usarlo. `finish` y todas
las celdas de una fila resumen pasan a `readOnly`, con gris (`--color-text-muted`), como decidió el grilleo.

**Editar el fin cambia la duración** es lo de más riesgo del proyecto y va **en tarea propia, la última de la
entrega**, con salida degradada explícita: si el motor no lo soporta limpiamente (restricciones, días no
laborables, dependencias que lo impiden), la celda se queda en solo lectura y se informa en la interfaz. La
decisión de degradar se toma con el test delante, no antes.

**Nada se descarta en silencio.** `parseMppEditValue` pasa a usar `parseNumericFieldInput`, que ya existe y ya
devuelve `{ok:false, reason}`; el rechazo se reporta con `reportInvalidEdit`, que ya pinta `RejectionToast`.
Las predecesoras mal escritas dejan de caer en el `continue` mudo y explican qué formato se espera.

**La celda editable se reconoce y se abre con teclado.** Señal al pasar por encima (borde punteado con los
tokens existentes) y entrada en edición con Enter o F2 sobre la celda enfocada. El doble clic sigue
funcionando: no se pierde nada.

**El arrastre es honesto.** El fantasma ya salta por días (`pixelsToDays` redondea); lo que falta es **decir
la fecha destino**, en una etiqueta junto al fantasma. Los tiradores dejan de ser transparentes: se pintan al
pasar por la barra o al seleccionarla. El tipo de vínculo se calcula con `inferDepType`, la misma función que
decide al soltar, y se anuncia durante el arrastre — hoy la vista previa dice «FS» aunque vaya a crear «FF».

**El impacto se ve.** `changedTaskIds` deja de ser interna: se exporta desde `ProjectContext` como
`lastChangedTaskIds` y la tabla y el Gantt resaltan esas filas durante unos segundos, con un recuento
(«3 actividades se movieron»). Sobre el mismo canal se avisa de los dos cambios de calado: **fin de obra** y
**ruta crítica**, comparando el antes y el después del recálculo.

**Simple/Avanzado cumple.** El modo Simple oculta las columnas MPP y los paneles de análisis avanzado, no solo
un desplegable. Y es **por defecto solo en la primera visita**: después manda `uiSettings.interactionMode`,
que ya se persiste.

### Entrega C · Pulido

**El menú se agrupa en Trabajo · Análisis · Ajustes**, con títulos, y **la Matriz entra en «Trabajo»** — hoy
solo se llega por `⌘K`, que es como no existir. `VIEW_TABS` pasa de lista plana a lista con grupo, y el
`<nav>` gana `role="tablist"`, que hoy falta pese a que los hijos ya son `role="tab"`.

**La paleta tolera erratas.** Se sustituye `String.includes` por una coincidencia por subsecuencia con
distancia máxima, en un módulo propio y probado (`src/lib/gantt/fuzzyMatch.ts`), y se añaden los comandos de
exportación y de Configuración que faltan. El botón muestra `⌘K`.

**Lo destructivo se separa de lo frecuente** con divisor y etiqueta de texto, y **Deshacer/Rehacer dejan de
desmontarse**: hoy el grupo entero desaparece cuando no hay historial (`ProjectToolbar.tsx:223`), lo que
reordena la barra bajo el dedo del usuario. Pasan a estar siempre visibles y apagados.

**El chip de filtro dice cuántas oculta.** El contador existe (`gantt-task-filter-count`) pero muestra
`visibles / total`; pasa a decir el número de ocultas, que es el dato que preocupa. Y una tarea filtrada de la
que dependa algo visible se muestra atenuada, para que la flecha no muera en el vacío.

**El desfase del WBS se corrige** en `levelButtons` (`label: L${index+1}` ↔ `level: index+2`) y el control es
**siempre botones**, no un `<select>` a partir de tres niveles: un control que cambia de tipo según el
proyecto es un control que hay que reaprender.

**Esqueleto de carga** para tabla y Gantt, sustituyendo «Cargando cronograma...». Y **destello sutil** en la
celda al aceptar una edición (E44), con la animación en `globals.css` y sin color nuevo.

**Barrido final:** tildes, `MPPUploader` borrado, «Nuevo Proyecto» como `<Link>`, roles ARIA de la barra.
Va al final para no ensuciar los diffs de fondo, tal como decidió la spec del supergoal.

### Entrega D · Lo construido e inalcanzable

**Las exportaciones dicen lo que son.** «Copiar Excel» → «Copiar para Excel»; «PDF» → «Imprimir o guardar como
PDF». Generar `.xlsx` y PDF con membrete queda anotado como mejora futura con diseño propio. El export del
cronograma pasa a **CSV de verdad con `;`**, el separador que Excel espera en configuración regional
española, e **incluye las observaciones** de cada actividad (M31).

**La API de Last Planner se conecta.** `POST /api/integrations/last-planner/preview` ya existe, está probada y
devuelve `LastPlannerPreview` con semanas, compromisos y restricciones. Se le monta una vista que la llama y
pinta el resultado, con su export. Es la función mejor construida y peor conectada del producto.

**El responsable entra en la observación**, opcional. Sin él, la columna «Responsable» del CSV de Last Planner
sale vacía y una restricción sin responsable no compromete a nadie. Y las observaciones ganan **vista propia
en el menú**, con todas las del proyecto y su exportación, como tenía el visor 1.0.

**La matriz avisa antes de salir** con cambios sin aplicar, y «Deshacer» se renombra a **«Descartar cambios»
con confirmación** — hoy borra todo el borrador sin decir cuánto. El deshacer paso a paso queda como
objetivo, no como alcance de este proyecto.

**El tablero ejecutivo deja de mentir con un proyecto vacío.** `computeEarnedValueSCurve` devuelve hoy
`spi: 1, cpi: 1` cuando no hay datos, lo que pinta un semáforo verde. Se cambia a devolver `spi: null,
cpi: null`, y el tablero muestra **«aún no hay datos»**. Además muestra la **fecha de corte** y cada indicador
**lleva a su detalle**: los cuellos abren Problemas, el avance abre el Gantt.

**Una sola definición de sobreasignado.** Gana la diaria de `detectOverallocation`
(`src/lib/scheduling/assignments.ts:62`), que es la que ya alimenta Problemas y la que tiene tests. Uso de
Recursos deja su umbral semanal propio y consume la misma función. Las asignaciones se pueden **crear y
borrar**, se pueden crear **desde la propia tarea** en el Gantt, y crear una que sobrecargue **avisa antes**.

## Ninguna capacidad desaparece

| Lo que se toca | Dónde queda |
|---|---|
| Vistas del menú | Las 9 siguen, ahora agrupadas, y entra la Matriz: 10 |
| Matriz por `⌘K` | Sigue en la paleta, además del menú |
| `MPPUploader` (borrado) | La subida real ya vive en `HomeMppUploadAction`; no se pierde ninguna ruta de usuario |
| «Copiar Excel» | Mismo botón, mismo sitio, nombre honesto y CSV que Excel abre bien |
| «PDF» | Mismo botón: sigue abriendo el diálogo de impresión, ahora lo dice |
| `<select>` de niveles WBS | Botones, con el mismo alcance de niveles |
| Umbral semanal de Uso de Recursos | Sustituido por el diario, que es más estricto y ya está probado |

## Riesgos

1. **«Editar el fin cambia la duración» toca el motor de cálculo.** Tarea propia, última de la entrega B,
   con salida degradada escrita en el plan. Es el único punto donde el plan admite no hacerlo.
2. **Cambiar `spi`/`cpi` a `null`** toca un tipo que consumen la Curva S, el tablero y el export. El plan lo
   ordena de dentro afuera: primero el tipo y sus tests, después los tres consumidores.
3. **Unificar «sobreasignado»** hará que Uso de Recursos marque **más** celdas que antes (el umbral diario es
   más estricto que el semanal). Es el resultado correcto, pero es un cambio visible: se anuncia en la
   tarjeta de `EXPERIMENTS.md`.
4. **La entrega C toca `VIEW_TABS`, que consumen los E2E.** Se ejecuta la suite de Playwright antes de cerrar
   esa entrega, igual que hizo el plan del 2026-08-05 con el recorte de vistas.

## Dependencias del carril B

Ninguna tarea de este plan escribe en `v2/src/lib/matrix/*`, `v2/src/lib/scheduling/unitPatterns.ts` ni
`activityFamily.ts`. Dos puntos del backlog que sí los necesitarían quedan **anotados como dependencia del
carril B**, no planificados aquí:

- **M10 · corregir clasificaciones ambiguas de la Línea de Balance desde la interfaz**: necesita el
  diccionario que aprende del motor de detección (P3).
- **M2 · «Productividad» → «Ritmo (1/día)»**: el renombrado es de interfaz y podría hacerse aquí, pero la
  productividad real depende de cantidades de obra que vienen de la matriz (P4). **Este plan hace el
  renombrado y nada más**, que es lo que decidió el grilleo.

## Preguntas abiertas

1. **Dónde vive la vista de Last Planner en el menú.** La spec dice «conectar la API», y decide el grupo de
   la Matriz («Trabajo») pero no el de Last Planner. Este plan la coloca en **«Trabajo»**, junto a la Matriz,
   por ser una vista de compromiso semanal y no de análisis. Si el usuario la quiere en otro sitio, es un
   cambio de una línea en `VIEW_TABS`.
2. **Qué pasa con `?error=` en enlaces antiguos.** Un `/login?error=cualquier%20texto` guardado en un
   marcador dejará de pintar nada tras el cambio a códigos. Se considera correcto —es el punto del arreglo—
   y se anota aquí para que no se lea como regresión.

## Cómo se construye

TDD estricto: test primero, verlo fallar por el motivo esperado, código mínimo. Directorio `v2/`.
Verificación por entrega: `npx jest --runInBand`, `npx eslint <archivos>`,
`npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` (vacío), `npx next build` y comprobación en navegador.

Plan: [2026-08-07-cerrar-backlog-ux.md](../plans/2026-08-07-cerrar-backlog-ux.md).

## Criterio de hecho

El de [goals/cerrar-backlog-ux/goal.md](../../../goals/cerrar-backlog-ux/goal.md), sin excepciones. En
particular: los 27 experimentos **cerrados o descartados con motivo escrito** en `docs/EXPERIMENTS.md`.
