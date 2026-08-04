# Visor Gantt — guía local del repositorio

## Autoridad y alcance

- Este archivo complementa las instrucciones globales. Dentro de `v2/`, aplica además `v2/AGENTS.md` como override técnico más cercano.
- `v2/` es la aplicación activa. No inventes rutas legacy ni mantengas implementaciones paralelas fuera de ella.
- Si la tarea nombra un goal, lee primero su `goal.md`, `facts.md`, `plan.md` y artefactos de validación disponibles. Ese paquete define alcance y done condition; no mezcles otros goals sin autorización.
- Inspecciona el estado de Git antes de editar. Conserva cambios locales ajenos y no uses metadatos históricos como fecha o rama predeterminada para decidir el trabajo actual.

## Runtime y mapa de responsabilidades

- Docker Compose es la fuente de verdad del runtime integrado: `frontend` (Next.js en `v2/`), `mpp-parser` (FastAPI + MPXJ), `db` (PostgreSQL) y `pgadmin` opcional.
- El parseo binario `.mpp` pertenece a `services/mpp-parser/`; la transformación al modelo de la aplicación vive en `v2/src/lib/import/mpp-project.ts` y la persistencia en `v2/src/lib/db.ts` y acciones server-side.
- El motor de calendario/CPM vive en `v2/src/lib/scheduling/`; la programación matricial en `v2/src/lib/matrix/`; el estado editable y su historial en `v2/src/lib/state/ProjectContext.tsx`.
- Usa `docker-compose.yml`, el código actual y la aplicación servida para confirmar comportamiento. Si Docker sirve una imagen desactualizada, reconstruye o reinicia el servicio pertinente antes de aceptar evidencia.

## Contratos de dominio no negociables

- Conserva durante importación las fechas y los datos originales del MPP. Los valores derivados o recalculados deben mantener procedencia explícita y no sobrescribir silenciosamente la fuente.
- Mantén las relaciones FS, SS, FF y SF, sus lags, calendarios, restricciones, jerarquía/WBS, rollups, holgura total/libre y ruta crítica. El recálculo debe ser determinista y no crear un segundo modelo de scheduling.
- Ante ciclos, autodependencias, referencias huérfanas o calendarios inválidos, muestra issues accionables y conserva el último cronograma válido; no persistas un recálculo parcial o corrupto.
- Distingue identidad interna y visible: `Unique ID` identifica establemente la entidad importada; el `Row ID` consecutivo es el contrato visible/editable para predecesoras y sucesoras. Traduce entre ambos en los límites correctos y prueba importación, edición, guardado y recálculo.
- Mantén simetría Matriz ↔ Gantt. Un cambio en generación, sincronización o aplicación debe preservar `matrixPlan`, dependencias, jerarquía y `matrixSource` en ambas direcciones; evita sincronización unilateral o pérdida de ediciones más recientes.
- El proyecto persistido vive principalmente en `projects.project_data` (`JSONB`). Todo cambio de estado persistente debe sobrevivir guardar, recargar la página y reabrir el proyecto; incluye calendario, matriz, baselines, columnas y ajustes afectados.
- El asistente, recomendaciones y escenarios what-if son análisis o preview. No alteran ni persisten el cronograma base hasta que el usuario aplique explícitamente el cambio.
- La importación debe respetar autenticación y permisos, guardar el agregado completo de forma atómica y devolver errores claros. Un archivo inválido, parser caído o fallo de DB no debe crear proyectos parciales.

## Routing y seguridad

- Para auditorías de MPP, CPM, calendarios, identidad, Matriz–Gantt o persistencia, usa `visor_schedule_contract_guardian` en read-only si el runtime permite seleccionar agentes tipados. Si no, delega el mismo contrato a un agente genérico read-only y declara el fallback.
- Para auditorías de Docker, parser, Server/Client boundaries, hidratación, rendimiento o evidencia E2E, usa `visor_runtime_evidence_guardian` bajo la misma regla. Los guardianes auditan y recomiendan; no implementan ni cambian datos, Docker o Git.
- No expongas credenciales, recovery codes ni contenido de proyectos reales. Usa variables de entorno y datos mínimos; no copies secretos a instrucciones, logs o evidencia.
- Trata cambios de schema, migraciones, backfills, borrados y operaciones sobre volúmenes como persistentes y de riesgo. Exige plan, respaldo verificable, ruta de restauración y aprobación. Nunca elimines volúmenes como operación rutinaria.
- `v2/scripts/init-schema.sql` inicializa volúmenes nuevos; editarlo no migra una base ya existente. Para una base viva diseña y valida una migración explícita.

## Verificación proporcional

- Primero ejecuta tests enfocados del dominio tocado; después lint y build cuando aplique. Para cambios visuales o interactivos añade navegador real y Playwright sobre la app servida.
- Scheduling/importación: cubre campos originales, cuatro tipos de dependencia con lags, calendarios, ciclos/errores, CPM, float y ruta crítica.
- Matriz: cubre `matrixFromGantt`, `matrixGenerator` y `matrixSync`, incluidas paridad bidireccional, procedencia e identidad.
- Persistencia: prueba guardar → recargar → reabrir y contrasta `project_data`; no aceptes solo estado de React o un test unitario.
- Runtime: confirma servicios con `docker compose config --services`, salud del parser, conectividad a PostgreSQL y ausencia de errores críticos en consola/red. Para rendimiento usa corridas comparables y documenta fixture, entorno, repeticiones y umbrales.
- Antes de cerrar, reporta comandos ejecutados, evidencia, limitaciones y cualquier paso manual. No hagas commit, push ni deploy salvo petición explícita.
