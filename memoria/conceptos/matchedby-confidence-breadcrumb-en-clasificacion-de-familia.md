---
tipo: concepto
estado: vigente
fecha: 2026-08-04
areas: [scheduling]
fuente: v2/src/lib/scheduling/activityFamily.ts
resumen: "El clasificador de familia devuelve matchedBy, confidence, breadcrumbLevel y reviewReason"
---
El resultado de clasificar una tarea en `activityFamily.ts` trae cuatro campos: `matchedBy`
(`"breadcrumb" | "wbs" | "name" | "none"`, la fuente que decidió la familia), `confidence` (número
de certeza asociado a esa fuente), `breadcrumbLevel` (el nivel de jerarquía que dio el match, o
`null` si no vino de breadcrumb) y `reviewReason` (motivo textual cuando la clasificación es
ambigua, por ejemplo cuando el nombre coincide con varias familias a la vez). La prioridad de
resolución es breadcrumb sobre WBS sobre nombre; si nada matchea, `matchedBy` es `"none"` con
`confidence: 0`.
