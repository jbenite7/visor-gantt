---
tipo: flujo
estado: vigente
fecha: 2026-08-05
areas: [datos]
fuente: v2/src/app/actions/project.ts, v2/src/lib/db.ts, v2/scripts/init-schema.sql
resumen: "El ciclo guardar → recargar → reabrir: el proyecto completo viaja como JSONB y nada se pierde"
---
# Flujo: guardar y reabrir un proyecto

- **Guardar.** El estado editable de `ProjectContext.tsx` se serializa completo y la Server
   Action `v2/src/app/actions/project.ts` (protegida por [[autenticacion-y-sesion]]) lo escribe en
   `projects.project_data` (JSONB) vía los helpers server-only de `v2/src/lib/db.ts`.
- **Listado.** `ProjectList.tsx` consulta los proyectos guardados y permite reabrirlos.
- **Reabrir.** Al cargar, el JSONB se deserializa al mismo modelo y el proyecto entra de nuevo al
   flujo [[edicion-y-recalculo]]. La lectura **conserva compatibilidad** con proyectos guardados
   por versiones anteriores del modelo.

**Invariante ([[AGENTS]]).** Todo cambio de estado persistente debe sobrevivir el ciclo completo
guardar → recargar la página → reabrir el proyecto: calendario, matriz, baselines, columnas y
ajustes incluidos.

**Schema.** Las tablas `projects` y `matrix_templates` se crean perezosamente
(`ensureProjectsTable`); `init-schema.sql` solo inicializa volúmenes Docker nuevos, **no migra**
una base existente — cambios de schema son operación de riesgo con plan y respaldo.

Ver el módulo [[persistencia]] y la decisión [[conservacion-de-proyectos-e2e-por-runid]].
