# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-18
**Commit:** 126f40e
**Branch:** main

## OVERVIEW

Visor Gantt (visor-mpp) — Web viewer for Microsoft Project (.mpp) files. Upload .mpp → parse XML → interactive Gantt chart with CPM analysis. Next.js 16 TypeScript frontend + PHP 8.2+ backend (DDD).

## STRUCTURE

```
/
├── backend/          # PHP 8.2+ backend — DDD, CPM engine, XML parser
│   ├── src/          # Domain (DDD) + Services + controllers
│   ├── tests/        # PHP test scripts (test_cpm.php, etc.)
│   ├── config/       # database.php, holidays.php
│   ├── sql/          # schema.sql, create_holidays_table.sql
│   ├── scripts/      # migrate_holidays.php, migrate_json_to_db.php
│   ├── uploads/      # Temp .mpp uploads (gitignored)
│   └── public/       # Legacy backend public assets (css/js)
├── v2/               # Next.js 16 TypeScript — new version (App Router)
│   └── src/
│       ├── app/      # Routes: page.tsx, upload/, gantt-demo/, actions/
│       ├── components/  # gantt/GanttChart.tsx, types.ts, utils.ts
│       └── lib/      # parser/, scheduling/, db.ts
├── test_data/        # XML fixtures + manual-de-marca-aia.json
├── aia-ms-project/   # Sample .mpp file (external reference)
├── docker/           # Dockerfile (php:8.2-apache)
└── docs/             # Empty
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Upload & parse .mpp | `backend/src/ProjectParser.php` | XML MSPDI format |
| CPM algorithm | `backend/src/Domain/Scheduling/Service/CPMCalculatorService.php` | Forward/Backward pass |
| Calendar/holidays | `backend/src/Services/CalendarService.php` + `config/holidays.php` | Mon-Sat work week |
| Project persistence | `backend/src/ProjectStorage.php` | CRUD + versioning |
| Gantt rendering | `v2/src/components/gantt/GanttChart.tsx` | React component |
| v2 XML parser | `v2/src/lib/parser/mpp-parser.ts` | fast-xml-parser |
| v2 CPM engine | `v2/src/lib/scheduling/cpm.ts` | TypeScript port |
| v2 DB layer | `v2/src/lib/db.ts` + `v2/src/app/actions/upload.ts` | Supabase/PostgreSQL |
| Brand identity | `test_data/manual-de-marca-aia.json` | AIA colors/typography |
| SQL schemas | `backend/sql/schema.sql`, `backend/sql/create_holidays_table.sql` | PostgreSQL |
| Docker setup | `docker/Dockerfile`, `docker-compose.yml` | PostgreSQL |

## CONVENTIONS

- **Mobile First CSS**: All styles written for small screens, scale up with `@media (min-width: ...)`
- **PHP strict_types**: `declare(strict_types=1)` in all PHP class files
- **Separation of concerns**: Frontend renders JSON only (no business logic). Backend returns JSON only (no HTML).
- **DDD in backend**: `Domain\Scheduling\{Entity, ValueObject, Service, Mapper}` namespace structure
- **PSR-4 autoload**: Custom autoloader in `bootstrap.php` for `Domain\` namespace
- **Week = Mon-Sat**: Sunday is holiday. All date calculations exclude Sundays.
- **AIA brand**: Use `--aia-*` CSS variables from `manual-de-marca-aia.json`

## ANTI-PATTERNS (THIS PROJECT)

- DO NOT put business logic in frontend JS — backend owns all calculation
- DO NOT hardcode dates in `DD/MM/YYYY` — use ISO 8601 or native Date objects
- DO NOT assume 30-day months in Gantt position calculations (Frappe Gantt v1.0.4 bug)
- DO NOT overwrite XML original dates with CPM recalculated dates during import

## UNIQUE STYLES

- **CPM Engine**: Custom Critical Path Method implementation (Forward/Backward pass, float, critical path)
- **Version grouping**: Projects grouped by `versionGroup` with similarity detection (>70% match)
- **Dependency format**: `12FC+5d` = TaskID + Type (FF/FC/CC/CF) + Lag in days

## COMMANDS

```bash
# Docker stack (primary entrypoint)
docker compose up --build
docker compose run --rm frontend npm test
docker compose run --rm frontend npm run lint
docker compose run --rm frontend npm run build
docker compose down -v
```

## NOTES

- `backend/uploads/` is gitignored — stores temp .mpp files during processing
- v2 uses Docker service names for connectivity: `mpp-parser` and `db`
- v2 `@/*` path alias maps to `./src/*`
- `.mpp` files are binary — VSCode marks them as `binary` in settings
- `docs/` directory is empty — project docs live in root markdown files
- No CI/CD workflows configured (`.github/workflows/` is empty)
