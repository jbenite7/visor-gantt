---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [importacion, datos]
fuente: AGENTS.md
resumen: "Qué documentos mandan en importación y qué trampas hay puestas"
---
# Mapa de importación

## Qué manda

- [[AGENTS]] — contrato de dominio no negociable: conservar durante la importación las fechas y
  datos originales del `.mpp`; los valores derivados deben mantener procedencia explícita y no
  sobrescribir silenciosamente la fuente. La importación debe respetar autenticación/permisos,
  guardar el agregado completo de forma atómica y no crear proyectos parciales ante archivo
  inválido, parser caído o fallo de DB.
- [[v2/AGENTS|v2/AGENTS]] — Route Handlers para multipart/archivos grandes; usar Server Actions
  solo para mutaciones acotadas desde la UI.
- [[docs/ms-project-calculated-fields|campos calculados MS Project]] — inventario ejecutable de
  qué campos importados quedan como valor pasivo vs. recalculados por el motor.

## Dónde vive en el código

- `services/mpp-parser/main.py` (+ `libs/`, `utils/`) — microservicio FastAPI + MPXJ que parsea el
  binario `.mpp` a JSON.
- `v2/src/lib/import/mpp-project.ts` — transforma el JSON del parser al modelo de la aplicación
  (`buildProjectDataFromMpp`).
- `v2/src/lib/parser/mpp-parser.ts` — cliente/adaptador de parseo dentro de `v2/`.
- `v2/src/lib/api/mpp-client.ts` — cliente HTTP hacia el servicio `mpp-parser`.
- `v2/src/app/api/import-mpp/`, `v2/src/app/api/parse-mpp/` — Route Handlers que reciben el
  archivo y disparan el pipeline de importación.
- `v2/src/components/upload/` — `MPPUploader.tsx`, `HomeMppUploadAction.tsx`, `ErrorDisplay.tsx`,
  `WarningList.tsx`, `mpp-to-gantt.ts` (UI y adaptación de la importación hacia el Gantt).
- `v2/src/lib/mpp/` — motor de campos calculados MPP: `mppCalculationEngine.ts`,
  `calculatedFields.ts`, `calculationRequirements.ts`, `calculationCoverage.ts`,
  `fieldInspector.ts`, `mppParityAudit.ts`.

## Trampas y decisiones del área

**Decisiones**
- [[errores-de-importacion-visibles-en-la-app]]

**Trampas**
- [[json-crudo-en-errores-de-importacion]]

**Conceptos**
- [[capas-del-motor-de-calculo-mpp]]
