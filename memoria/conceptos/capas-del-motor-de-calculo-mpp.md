---
tipo: concepto
estado: vigente
fecha: 2026-07-01
areas: [importacion]
fuente: docs/mpp-calculation-field-replication-plan.md
resumen: "El plan de replica de campos MPP organiza el trabajo en tres capas: inventario, estado, pendientes"
---
`docs/mpp-calculation-field-replication-plan.md` describe el sistema de campos calculados MPP en
tres capas: **Capa 1**, el inventario de familias de campos (CPM, restricciones/calendario,
resumen/WBS, tracking, trabajo/recursos, costos, baseline/variancias, valor ganado, timephased,
campos personalizados); **Capa 2**, el estado del sistema actual, repartido en cinco módulos —
`calculationRequirements.ts` (inventario de requisitos), `calculatedFields.ts` (especificación de
cómputo por campo), `calculationCoverage.ts` (evaluador de cobertura), `mppCalculationEngine.ts`
(motor de cálculo) y `fieldInspector.ts` (inspector por campo) — todos en `v2/src/lib/mpp/`; y
**Capa 3**, los pendientes de paridad total (regresión contra exportación oficial MPXJ,
validación de fórmulas EVM y calendarios adversos, split tasks con múltiples interrupciones).
