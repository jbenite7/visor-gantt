---
tipo: decision
estado: vigente
fecha: 2026-08-04
areas: [qa]
fuente: goals/cierre-auditoria-goals/cierre.md
resumen: "Los specs E2E ya no borran proyectos; el aislamiento es por identificador de corrida (runId)"
---
Los specs Playwright ya no ejecutan `DELETE FROM projects`. El aislamiento entre corridas viene
de un identificador único por ejecución en `v2/e2e/helpers/runId.ts`, que se incorpora al nombre
de cada proyecto creado durante la suite. Verificado: tras la corrida completa en verde,
`select count(*) from projects` pasó de 35 a 87 filas, con nombres como
`E2E What If Persistence run-msf2srrr` conviviendo entre corridas sin colisión.

**Why:** los facts 8 y 111 exigen conservar los proyectos E2E para revisión posterior; 9 de 12
specs contradecían eso ejecutando `DELETE` al terminar, lo que la auditoría del 2026-08-04
confirmó por lectura directa del código.

**How to apply:** la limpieza pasó a un script manual, `v2/scripts/clean-e2e-projects.ts`, que
exige `--yes` y solo toca filas con marcador de corrida — nunca la ejecutes sin revisar qué
proyectos matchea primero. Ningún spec nuevo debe volver a borrar sus propios proyectos.
