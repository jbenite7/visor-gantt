# PROJECT KNOWLEDGE BASE

**Actualizado:** 2026-07-06
**Branch:** main

## OVERVIEW

Visor Gantt (visor-mpp) — Editor operativo de planificación sobre archivos de Microsoft Project (`.mpp`). Importa `.mpp` → parsea → Gantt/CPM interactivo con ruta crítica, dependencias (FS/SS/FF/SF + lags), WBS/rollups, y **programación matricial en paridad simétrica 100%** con el CPM/Gantt.

Stack único, totalmente dockerizado:

- `frontend` — Next.js 16 + TypeScript + React 19 (App Router). Es el **código activo** del repo, vive en `v2/`.
- `mpp-parser` — Microservicio Python (FastAPI + MPXJ) que convierte `.mpp` binario a JSON.
- `db` — PostgreSQL. Cada proyecto se persiste como JSON en la columna `project_data`.
- `pgadmin` — Administración opcional de la base de datos.

> El backend PHP legacy (DDD) fue **erradicado** el 2026-07-06. No existe ninguna ruta de ejecución fuera de Docker + `v2/`.

## STRUCTURE

```
/
├── v2/                    # Next.js 16 TypeScript — código ACTIVO (App Router)
│   ├── src/
│   │   ├── app/           # Rutas, actions, api/, globals.css (design system)
│   │   ├── components/    # gantt/GanttChart.tsx, matriz, UI
│   │   └── lib/           # parser/, scheduling/, matrix/, import/, auth/, db.ts
│   └── scripts/           # init-schema.sql
├── services/
│   └── mpp-parser/        # Microservicio Python (FastAPI + MPXJ) — parse .mpp → JSON
├── test_data/             # manual-de-marca-aia.json (identidad de marca, usado por globals.css)
├── docs/                  # Despliegue Hetzner, campos calculados MS Project
└── docker-compose.yml     # Stack: frontend + mpp-parser + db + pgadmin
```

## WHERE TO LOOK

| Tarea | Ubicación | Notas |
|------|-----------|-------|
| Parse .mpp binario → JSON | `services/mpp-parser/` | Python FastAPI + MPXJ (Java) |
| Cliente parser desde v2 | `MPP_PARSER_URL` / `NEXT_PUBLIC_MPP_PARSER_URL` | Servicio Docker `mpp-parser:8000` |
| Import .mpp → project_data + matriz | `v2/src/lib/import/mpp-project.ts` | `buildProjectDataFromMpp`, `buildImportedMatrix` |
| Parser XML MSPDI (v2) | `v2/src/lib/parser/mpp-parser.ts` | `fast-xml-parser` |
| Motor CPM / scheduling | `v2/src/lib/scheduling/cpm.ts` | Forward/Backward pass, float, ruta crítica |
| Programación matricial (paridad) | `v2/src/lib/matrix/matrixFromGantt.ts` | `buildMatrixPlanFromGantt`, `generateScheduleFromMatrix`, `matrixSync` |
| Render Gantt | `v2/src/components/gantt/GanttChart.tsx` | Componente React |
| Persistencia | `v2/src/lib/db.ts` | Pool `pg`; columna `project_data` JSON |
| Auth / sesión + seed admin | `v2/src/lib/auth/session.ts` | `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` |
| Design system Apple-like | `v2/src/app/globals.css` | OKLCH, glass/backdrop-blur, dark mode, `--aia-*` |
| Identidad de marca AIA | `test_data/manual-de-marca-aia.json` | Colores/tipografía; consumido por `globals.css` |
| Esquema DB inicial | `v2/scripts/init-schema.sql` | Montado como init de PostgreSQL |
| Despliegue producción | `docs/deploy-production-hetzner.md` | Hetzner |

## CONVENTIONS

- **Mobile First CSS**: estilos para pantallas pequeñas primero, escalar con `@media (min-width: ...)`.
- **Design system Apple-like 2026**: tokens OKLCH, superficies glass (`backdrop-filter` con prefijo `-webkit-` para Safari), modo oscuro. Único punto de verdad: `v2/src/app/globals.css`.
- **Paridad simétrica matriz ↔ CPM/Gantt (100%)**: `buildMatrixPlanFromGantt` (Gantt→Matriz) y `generateScheduleFromMatrix` (Matriz→Gantt) se mantienen en sync. El import `.mpp` genera `matrixPlan` en **ambas ramas** (con y sin recálculo de campos).
- **Persistencia JSON**: el estado del proyecto vive en la columna `project_data` (JSON), no en tablas normalizadas por entidad.
- **Separación de responsabilidades**: el parseo binario de `.mpp` es responsabilidad del microservicio Python; el frontend consume JSON.

## ANTI-PATTERNS (THIS PROJECT)

- **NO modificar el cronograma con acciones inteligentes/IA sin confirmación explícita del usuario.** El asistente preventivo y el what-if operan en runtime/preview; solo persisten cuando el usuario aplica.
- **NO romper la paridad matriz↔Gantt**: si tocas una dirección, actualiza la otra o fallan los tests `matrixSync` / `matrixFromGantt` / `matrixGenerator`.
- **NO asumir un flujo fuera de Docker**: el frontend depende de `mpp-parser` y `db` por nombre de servicio.
- **NO sobrescribir las fechas originales del XML con fechas recalculadas por CPM durante el import.**

## COMMANDS

```bash
# Stack Docker (entrypoint primario)
docker compose up -d --build
docker compose down            # -v para borrar el volumen de datos

# Verificación (desde v2/)
npm run lint
npx jest --runInBand           # unit
npm run build                  # next build --webpack
npm run test:e2e -- --project=chromium --workers=1
BENCHMARK_SYNTHETIC_FLOORS=60 BENCHMARK_RUNS=20 npm run benchmark:gantt
```

## NOTES

- Seed admin en un despliegue limpio: `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` (consumido en `v2/src/lib/auth/session.ts`).
- v2 usa nombres de servicio Docker para conectividad: `mpp-parser` y `db`.
- Alias de path `@/*` → `./src/*`.
- Los `.mpp` son binarios (gitignored).
- `docs/recovery-codes.txt` es sensible: no exponer.
