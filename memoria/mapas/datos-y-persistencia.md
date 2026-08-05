---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [datos, auth]
fuente: AGENTS.md
resumen: "Qué documentos mandan en datos, persistencia y autenticación, y qué trampas hay puestas"
---
# Mapa de datos y persistencia

## Qué manda

- [[AGENTS]] — el proyecto persistido vive principalmente en `projects.project_data` (`JSONB`);
  todo cambio de estado persistente debe sobrevivir guardar, recargar la página y reabrir el
  proyecto (calendario, matriz, baselines, columnas, ajustes). Cambios de schema, migraciones,
  backfills, borrados y operaciones sobre volúmenes son de riesgo: exigen plan, respaldo
  verificable y ruta de restauración; `v2/scripts/init-schema.sql` inicializa volúmenes nuevos
  pero no migra una base ya existente.
- [[v2/AGENTS|v2/AGENTS]] — consultas PostgreSQL solo en código server-side vía los helpers de
  `src/lib/db.ts`; `projects.project_data` conserva compatibilidad al leer proyectos existentes.

## Dónde vive en el código

- `v2/src/lib/db.ts` — helpers de acceso a PostgreSQL (server-only).
- `v2/scripts/init-schema.sql` — bootstrap del schema, montado por Docker Compose.
- `v2/src/app/actions/project.ts` — Server Actions de mutación de proyectos.
- `v2/src/lib/state/ProjectContext.tsx`, `history.ts` — estado editable en cliente y su historial,
  origen de lo que termina persistido en `project_data`.
- `v2/src/lib/auth/session.ts`, `cookie-security.ts`, `password.ts`, `rbac.ts` — sesión, cookies
  seguras, hash de contraseña y control de acceso basado en rol.
- `v2/src/app/api/auth/`, `v2/src/app/actions/auth.ts`, `v2/src/app/login/page.tsx` — flujo de
  autenticación.
- `v2/src/components/auth/AuthMenu.tsx` — UI de sesión.
- `v2/src/lib/budget/budgetParser.ts`, `v2/src/components/budget/BudgetMapping.tsx`,
  `BudgetTable.tsx` — datos presupuestales asociados al proyecto.
- `v2/src/lib/integrations/lastPlanner.ts`, `v2/src/app/api/integrations/` — integraciones de
  datos externas.

## Trampas y decisiones del área

Se llena en la pasada de ingest.
