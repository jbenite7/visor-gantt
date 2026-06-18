# BACKEND — PHP 8.2+

DDD-based PHP backend. CPM scheduling engine + XML MSPDI parser + project storage.

## STRUCTURE

```
src/
├── bootstrap.php              # PSR-4 autoloader for Domain\ namespace
├── ProjectParser.php          # XML MSPDI parser → task/dependency extraction
├── ProjectStorage.php         # CRUD + versioning (JSON files in data/projects/)
├── ProjectData.php            # Data transfer object
├── Domain/Scheduling/
│   ├── Entity/Task.php        # Immutable task entity
│   ├── ValueObject/Dependency.php, DependencyType.php
│   ├── Service/CPMCalculatorService.php  # Forward/Backward pass algorithm
│   └── Mapper/TaskDataMapper.php         # XML → Domain mapping
├── Services/CalendarService.php  # Mon-Sat week, holiday exclusion
config/
├── database.php               # PostgreSQL connection
├── holidays.php               # Holiday dates array
sql/
├── schema.sql                 # Projects + holidays tables
├── create_holidays_table.sql
scripts/
├── migrate_holidays.php       # JSON → DB migration
├── migrate_json_to_db.php     # File-based → DB migration
tests/
├── test_cpm.php               # CPM algorithm verification
├── test_cpm_saturday.php      # Saturday work week edge cases
├── test_duration_parser.php   # ISO 8601 duration parsing
├── test_summary_rollup.php    # Summary task date aggregation
data/projects/                 # JSON project storage (gitignored)
uploads/                       # Temp .mpp files (gitignored)
```

## WHERE TO LOOK

| Task | File | Key Method |
|------|------|------------|
| Parse .mpp XML | `src/ProjectParser.php` | `parse()`, `parseDate()`, `parseDuration()` |
| CPM calculation | `src/Domain/Scheduling/Service/CPMCalculatorService.php` | `calculate()` — Forward + Backward pass |
| Save/load project | `src/ProjectStorage.php` | `save()`, `load()`, `listAll()`, `detectDuplicate()` |
| Holiday logic | `src/Services/CalendarService.php` | `isWorkingDay()`, `addWorkingDays()` |
| Task entity | `src/Domain/Scheduling/Entity/Task.php` | Immutable — `withEarlyStart()`, `withLateFinish()` |
| XML → Domain map | `src/Domain/Scheduling/Mapper/TaskDataMapper.php` | `mapToTask()`, `mapToDependency()` |

## CONVENTIONS

- `declare(strict_types=1)` in ALL PHP files
- DDD layers: Entity (immutable) → ValueObject → Service → Mapper
- Autoloading: `Domain\Scheduling\` maps to `src/Domain/Scheduling/`
- Week = Mon-Sat (Sunday excluded from all date math)
- Tests are standalone scripts: `php tests/test_cpm.php` (no PHPUnit)

## ANTI-PATTERNS

- DO NOT use `DateTime` without `+1 day` skipping Sunday — use `CalendarService` instead
- DO NOT modify Task entity after creation — it's immutable, use `with*()` methods
- DO NOT hardcode holiday dates — use `config/holidays.php` or DB
