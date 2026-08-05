---
tipo: decision
estado: vigente
fecha: 2026-08-04
areas: [scheduling]
fuente: goals/cierre-auditoria-goals/cierre.md
resumen: "La clasificacion de familia de actividad se implemento completa en vez de retirarse del contrato"
---
La auditoría del 2026-08-04 encontró que la clasificación semiautomática de familias (facts 65,
66, 67 de Línea de Balance y 92 de Unidad Típica) no existía en el código: ningún símbolo
`matchedBy`, `confidence`, `breadcrumb` ni `activityFamily` aparecía en `v2/src`. En vez de
retirar el requisito del contrato, se implementó completa en
`v2/src/lib/scheduling/activityFamily.ts`, consumida por los tres generadores de LOB (incluido
`generateAutomaticLOBFromTasks`, el que usa la aplicación) y por Unidad Típica.

**Why:** los facts describían un comportamiento concreto y verificable (prioridad
breadcrumb > WBS > nombre, nivel de confianza, motivo de revisión); simplificar el contrato para
que coincidiera con el código habría escondido una promesa incumplida en vez de resolverla.

**How to apply:** si un fact de un goal cerrado no tiene rastro en el código, no asumas que el
fact quedó obsoleto — verifica si conviene implementarlo antes de reescribirlo o borrarlo.
