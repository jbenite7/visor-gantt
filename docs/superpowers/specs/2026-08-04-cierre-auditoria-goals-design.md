# Cierre de la auditoría fact-by-fact — diseño

**Fecha:** 2026-08-04
**Origen:** `goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md`

## Problema

La auditoría independiente contra el código real encontró que ningún goal cierra limpiamente.
La base del código está sana (75 suites, 543 tests, lint y build limpios); el problema es la
distancia entre lo que los contratos declaran y lo que el código hace, más tres defectos reales.

Este diseño cubre los cinco incumplimientos confirmados y la deuda menor asociada.

## Alcance

Cinco frentes, en orden de ejecución. El orden va de lo que afecta a un usuario real hoy hacia
lo que es deuda de contrato.

### 1. Errores de importación visibles en la aplicación

**Defecto.** `HomeMppUploadAction.tsx:44` usa un `<form action="/api/import-mpp" method="post">`
nativo enviado con `requestSubmit()`, sin `onSubmit`, `fetch` ni `preventDefault`. La ruta
responde a los fallos con `NextResponse.json({error}, {status})` en cinco caminos: archivo
inválido (400), extensión incorrecta (400), tamaño excedido (413), fallo del parser (status del
parser) y fallo al guardar (500). Al ser navegación nativa, el navegador abandona la página y
renderiza el JSON crudo a pantalla completa.

**Diseño.** Interceptar el envío en el cliente: `onSubmit` con `preventDefault`, `fetch` con
`FormData` y `redirect: "manual"`. En respuesta exitosa (303) navegar con `router.push` al
destino; en error, leer el JSON y mostrar el mensaje en el bloque `error` que el componente ya
tiene (líneas 73-77). El estado `isProcessing` debe liberarse siempre, también en el camino de
error, para que el botón no quede bloqueado en "Importando...".

La ruta del servidor no cambia: sus cinco respuestas de error ya son correctas y están bien
tipadas. El defecto es exclusivamente de consumo en el cliente.

**Contrato.** Ningún fallo de importación debe sacar al usuario de la aplicación. Los cinco
caminos de error muestran su mensaje dentro de la página, con el formulario reutilizable.

### 2. Clasificación de familias de actividad

**Defecto.** Cuatro facts (65, 66, 67 de LOB; 92 de Unidad Típica) describen un clasificador
semiautomático con reglas regex, prioridad, breadcrumb/WBS, nivel de confianza y motivo de
revisión. No existe: los símbolos `matchedBy`, `confidence`, `breadcrumb`, `activityFamily` no
aparecen en `v2/src`, y la raíz "famil" no está en `lob.ts` ni en `typicalUnit.ts`.

**Decisión tomada.** Implementarlo completo, incluyendo el motivo de revisión cuando la
clasificación es ambigua.

**Diseño.** Módulo nuevo `v2/src/lib/scheduling/activityFamily.ts`, consumido por LOB y por
Unidad Típica. Responsabilidad única: dado un `GanttTask` y su contexto de WBS, decidir a qué
familia pertenece y explicar por qué.

Familias iniciales: Estructura, Arquitectura, Redes MEP, Urbanismo, Preliminares. Coinciden con
los alcances que ya usa el generador matricial, de modo que un proyecto creado desde matriz se
clasifica de forma consistente con su propio origen.

Resultado por tarea:

- `family`: la familia decidida, o `null` si ninguna regla alcanza el umbral.
- `matchedBy`: qué la decidió — `"wbs"`, `"breadcrumb"`, `"name"` o `"none"`.
- `confidence`: número de 0 a 1.
- `breadcrumbLevel`: en qué nivel de la ruta WBS se encontró la señal.
- `reviewReason`: texto accionable cuando la confianza es baja o hubo empate entre familias.

Regla de prioridad, que es el corazón del fact 67: **la señal de WBS/breadcrumb gana siempre
sobre el nombre de la tarea.** Una tarea llamada "Piso 3" bajo un capítulo "Redes MEP" es MEP,
no Estructura. Las palabras ambiguas (Piso, Torre, Staff, Retiro, Ejes, Zona) nunca deciden
familia por sí solas: si aparecen sin respaldo de WBS, el resultado es `family: null` con
`reviewReason` explicando que hace falta clasificación manual.

Este módulo es independiente de `UNIT_PATTERNS`, que resuelve *unidad* (Piso, Zona) y no
*familia*. Nota de deuda: `UNIT_PATTERNS` está duplicado literalmente en `lob.ts:388` y
`typicalUnit.ts:4`; se unifica en este trabajo porque ambos consumidores se tocan de todos modos.

**Contrato.** LOB y Unidad Típica muestran la familia junto a su procedencia y confianza, y
marcan para revisión lo que no pudieron decidir. Ninguna clasificación se aplica de forma
silenciosa: siempre es auditable a partir de `matchedBy` y `confidence`.

### 3. Conservación de proyectos E2E

**Defecto.** El fact 8 exige que la suite conserve los proyectos creados para revisión
posterior, y el fact 111 que no se borren al finalizar. Nueve de doce specs ejecutan
`DELETE FROM projects WHERE name LIKE ...`.

**Decisión tomada.** Conservar, usando un prefijo único por corrida.

**Diseño.** Helper compartido en `v2/e2e/helpers/runId.ts` que produce un identificador de
corrida estable dentro de un mismo proceso. Cada spec compone su nombre de proyecto como
`<prefijo del spec> <runId> <detalle>`, y elimina su `DELETE` de `beforeEach`/`afterEach`.

El aislamiento entre corridas deja de venir del borrado y pasa a venir del identificador: dos
corridas nunca colisionan porque nunca comparten nombre. La limpieza de corridas antiguas se
mueve a un script explícito, `v2/scripts/clean-e2e-projects.ts`, que se ejecuta a mano cuando
haga falta y nunca desde los tests.

**Contrato.** Terminada la suite, los proyectos de esa corrida siguen en la base y son
identificables por su `runId`. Ningún test borra datos que otro test o una revisión posterior
pueda necesitar.

### 4. Persistencia del arrastre de jerarquía

**Defecto.** El mecanismo de arrastre existe (`GanttTable.tsx:625`, umbral sobre `deltaX`), pero
el único E2E de persistencia usa el botón `hierarchy-indent` de la barra, no el mouse. El fact 35
pide que los cambios por arrastre sobrevivan a la recarga.

**Diseño.** Añadir a `hierarchy-visual-persistence.spec.ts` un caso que ejecute un arrastre real
con el ratón, supere el umbral horizontal, verifique `wbs`, `outlineLevel` e `isSummary` en
`project_data`, recargue `/project/[id]` y confirme la jerarquía visible. Es cobertura nueva
sobre código existente; no se espera cambio de producción.

### 5. Banner de resumen del proyecto

**Defecto.** `paridad-visor-10` está marcado `completed` pero su fact 34 ("Banner informativo
sutil entre toolbar y SplitPane") no está implementado: la única ocurrencia de "banner" en
`v2/src` es un test de otro componente.

**Diseño.** Componente `ProjectSummaryBanner` entre `<ProjectToolbar>` (`GanttView.tsx:1043`) y
el SplitPane, con el resumen del proyecto. Sutil por definición del fact: una franja de texto
con los tokens del sistema de diseño existente, sin competir con la barra de herramientas.

### Deuda menor incluida

- `overflow-x: hidden` defensivo en `html`/`body` (`globals.css:362-377`).
- `playwright.config.ts`: forzar `workers: 1` también fuera de CI y retirar los proyectos
  firefox/webkit que contradicen el fact de navegador único.
- Tests de componente para `ColumnSelector` y `DependencyPopover`.
- Documentos de cierre para `predecessors-use-row-id` y `optimize-gantt-recalculation`, que están
  implementados y cubiertos pero sin acta.

## Fuera de alcance

- Re-ejecutar el benchmark de producción: requiere `PRODUCTION_SSH_HOST` y no es re-verificable
  desde aquí. Se documenta como condicionado, no se toca.
- Rediseño visual de LOB o Unidad Típica más allá de mostrar familia, procedencia y confianza.
- Colaboración multiusuario, integraciones externas y cualquier fact de visión de `top5`.

## Verificación

Cada frente se cierra con prueba automatizada, no con captura:

1. Importación: test del componente que simule los cinco errores del servidor y verifique que el
   mensaje aparece en la página y que el botón se rehabilita.
2. Familias: tests unitarios de `activityFamily.ts` cubriendo prioridad WBS sobre nombre, las seis
   palabras ambiguas del fact 67, empates y umbral de confianza.
3. E2E: la suite completa corre y, al terminar, los proyectos de la corrida siguen en la base.
4. Arrastre: el nuevo caso E2E pasa.
5. Banner: test de componente que confirme su presencia y contenido.

Cierre global: `npm test`, `npm run lint`, `npm run build` y la suite Playwright en Chromium.
Ningún goal se marca cerrado sin salida real de comandos que lo respalde.

## Condición de hecho

Los cinco incumplimientos quedan resueltos con prueba automatizada; la deuda menor queda resuelta
o registrada explícitamente; los facts que cambian de significado se actualizan en su goal; y
cada goal afectado recibe su acta de cierre con la evidencia de comandos de la sesión que lo
cerró.
