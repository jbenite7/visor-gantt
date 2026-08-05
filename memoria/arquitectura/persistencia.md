---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [datos, docker]
fuente: v2/src/lib/db.ts, v2/src/app/actions/project.ts, v2/scripts/init-schema.sql
resumen: "Acceso a PostgreSQL: proyectos, plantillas de matriz, bootstrap de schema"
---
# persistencia

**Qué hace.** Guarda y recupera proyectos completos (JSONB) y plantillas de matriz en PostgreSQL;
crea las tablas `projects` y `matrix_templates` de forma perezosa la primera vez que se necesitan.

**Dónde vive.** `v2/src/lib/db.ts` (pool de conexión `pg`, `ensureProjectsTable`),
`v2/src/app/actions/project.ts` (Server Actions de guardar/cargar proyecto),
`v2/scripts/init-schema.sql` (bootstrap del schema para volúmenes Docker nuevos).

**Qué consume.** `DATABASE_URL` (definida en `docker-compose.yml`, servicio `db` con Postgres 15).

**Quién lo consume.** El módulo [[memoria/arquitectura/importacion-modulo|importacion]] (persiste el proyecto tras el parseo), el módulo
[[matriz]] (plantillas), y toda vista que carga un proyecto guardado (`ProjectList.tsx`).

**Invariantes.** Los tests E2E ya no borran proyectos: el aislamiento entre corridas es por
`runId`, no por `DELETE FROM projects` — ver [[conservacion-de-proyectos-e2e-por-runid]] y la
trampa que documenta el estado anterior, [[e2e-borraba-los-proyectos-que-debia-conservar]].
