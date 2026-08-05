# Cierre de la auditoría fact-by-fact

**Slug:** `cierre-auditoria-goals`
**Status:** `active`
**Creado:** 2026-08-04

## Proposición

Resolver los cinco incumplimientos que la auditoría independiente del 2026-08-04 confirmó contra
el código real, más la deuda menor asociada, de modo que cada goal afectado pueda cerrarse con
evidencia de comandos y no con autoreporte.

La auditoría de origen está en `goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md`.
El diseño aprobado está en `docs/superpowers/specs/2026-08-04-cierre-auditoria-goals-design.md`.
El plan de ejecución está en `plan.md`.

## Alcance, en orden de ejecución

1. **Errores de importación visibles en la app** — el formulario nativo de
   `HomeMppUploadAction.tsx` hace que los cinco caminos de error de `/api/import-mpp` se rendericen
   como JSON crudo a pantalla completa. Se intercepta el envío en cliente y se muestra el error
   dentro de la página.
2. **Clasificación de familias de actividad** — módulo nuevo `activityFamily.ts` con reglas regex,
   prioridad de WBS/breadcrumb sobre nombre, nivel de confianza y motivo de revisión, consumido
   por LOB y Unidad Típica. Cubre los facts 65, 66, 67 y 92, hoy inexistentes en el código.
3. **Conservación de proyectos E2E** — nueve de doce specs borran los proyectos que los facts 8 y
   111 exigen conservar. Se sustituye el borrado por aislamiento con identificador de corrida.
4. **Persistencia del arrastre de jerarquía** — cobertura E2E con arrastre real de ratón para el
   fact 35, hoy probado solo con el botón de la barra.
5. **Banner de resumen del proyecto** — fact 34 de `paridad-visor-10`, marcado `completed` sin
   estar implementado.

Deuda menor incluida: `overflow-x` defensivo, configuración de Playwright alineada al fact de
navegador único, tests de componente para `ColumnSelector` y `DependencyPopover`, y actas de
cierre para `predecessors-use-row-id` y `optimize-gantt-recalculation`.

## Decisiones tomadas

- La clasificación de familias se **implementa completa**, con motivo de revisión, en lugar de
  retirarse del contrato.
- Los proyectos E2E se **conservan** usando un prefijo único por corrida; la limpieza pasa a un
  script manual y sale de los tests.

## Condición de hecho

Los cinco incumplimientos quedan resueltos con prueba automatizada; la deuda menor queda resuelta
o registrada explícitamente; los facts que cambian de significado se actualizan en su goal; y cada
goal afectado recibe su acta de cierre con la salida real de `npm test`, `npm run lint`,
`npm run build` y la suite Playwright en Chromium ejecutada en la sesión que lo cierre.

## Fuera de alcance

Benchmark de producción (requiere `PRODUCTION_SSH_HOST`), rediseño visual de LOB o Unidad Típica
más allá de mostrar familia y procedencia, y los facts de visión de `top5`.

## Archivos de este goal

- [[goals/cierre-auditoria-goals/cierre|cierre]] — el cierre verificado

Estado de todos los goals: [[estado|Estado de los goals]].
