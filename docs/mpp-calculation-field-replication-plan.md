# Plan de réplica de campos calculados MS Project

Este plan consolida los campos de cálculo del cronograma en tres capas:

- Inventario de campos por familia (origen del requerimiento)
- Estado de soporte en la app
- Próximos pasos para cierre de paridad total frente a MS Project

## Capa 1: Inventario activo (implementado)

- Cronograma CPM
  - Start, Finish, Duration, Early Start/Finish, Late Start/Finish, Total Slack, Free Slack, Start Slack, Finish Slack, Negative Slack, Critical, Predecessors, Successors, WBS/Unique ID Predecessors, WBS Successors
- Restricciones y calendario
  - Constraint Type, Constraint Date, Deadline, Task Calendar, Ignore Resource Calendar, Leveling Delay, Preleveled Start/Finish, Scheduled Start/Finish/Duration, Task Mode
- Resumen y WBS
  - Summary, Milestone, Outline Level, Outline Number, WBS, Rollup, Group By Summary, Summary Progress, Task Summary Name
- Progreso / tracking
  - % Complete, % Work Complete, Physical % Complete, Actual/Remaining Start-Finish-Duration, Actual Start/Finish, Complete Through, Stop, Resume, Status, Status Indicator, Health
- Trabajo y recursos
  - Work, Actual Work, Remaining Work, Regular Work, Overtime Work, Actual Overtime Work, Remaining Overtime Work, Peak, Overallocated, Assignment Units, Resource Names, Resource Initials, Resource Group, Resource Type, Assignment Delay
- Costos
  - Cost, Fixed Cost, Fixed Cost Accrual, Actual Cost, Remaining Cost, Overtime Cost, Actual Overtime Cost, Remaining Overtime Cost, Cost Variance, Cost Per Use, Standard Rate, Overtime Rate, Cost Rate Table
- Baseline y variancias
  - Baseline, Baseline0...Baseline10 (Start/Finish/Duration/Work/Cost/Budget Work/Budget Cost), Estimated Start/Finish/Duration, Start Variance, Finish Variance, Duration Variance, Work Variance, Cost Variance
- Valor ganado
  - BCWS, BCWP, ACWP, SV, SV%, CV, CV%, SPI, CPI, EAC, VAC, TCPI, Earned Value Method
- Timephased
  - Work, Actual Work, Cost, Actual Cost, Baseline Work/Cost y Baseline1...10, Cumulative Work/Cost, Remaining Cumulative Work, Overallocation, % Complete, SV, CV, SPI, CPI por escala
- Campos personalizados
  - Text1-30, Number1-20, Date1-10, Cost1-10, Duration1-10, Flag1-20, Start1-10, Finish1-10, Outline Code1-10, Enterprise variants (Cost, Date, Duration, Flag, Number, Text, Task Outline Code, Resource Outline Code)

## Capa 2: Estado del sistema actual

- Inventario de requisitos: `v2/src/lib/mpp/calculationRequirements.ts`
- Especificación de cómputo por campo: `v2/src/lib/mpp/calculatedFields.ts`
- Evaluador de cobertura: `v2/src/lib/mpp/calculationCoverage.ts`
- Engine de cálculo: `v2/src/lib/mpp/mppCalculationEngine.ts`
- Inspector por campo: `v2/src/lib/mpp/fieldInspector.ts`

Estado opertivo hoy:

- Campos requeridos en el inventario están tipificados como `engineCalculated`, `userInput` o `customInput` según corresponda.
- Los campos personalizados importados se preservan con aliases, formulas, dependencias, rollup y lookup metadata.
- Los campos con fórmula se recalculan con `customFormula` cuando son soportados.
- La edición de campos base y custom sin fórmula es editable; campos calculados quedan controlados por el motor.

## Capa 3: Pendientes de paridad total

1. Cobertura contra exportación oficial MS Project/MPXJ en escenarios reales de regresión (no solo cobertura estática).
2. Validación de fórmulas de EVM, restricciones complejas y calendarios por período con casos adversos.
3. Verificación de curvas de asignación avanzadas y split tasks con múltiples interrupciones.
4. Alineación de granularidad de variaciones de fórmula/costo para importaciones con perfiles de calendario no estándar.

## Flujo matricial (validado)

- Formulario de proyecto nuevo en modo matriz: `v2/src/app/project/new/NewProjectForm.tsx`
- Plantilla base: `v2/src/lib/matrix/templates.ts`
- Generador: `v2/src/lib/matrix/matrixGenerator.ts`
- E2E de referencia: creación de edificio de 10 pisos + 3 disciplinas completas (`v2/e2e/matrix-new-project.spec.ts`)
