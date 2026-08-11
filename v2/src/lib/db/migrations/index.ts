import type { Migration } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";
import { migration002BaselinesAsSnapshots } from "./002_baselines_as_snapshots";
import { migration003ShareColumns } from "./003_share_columns";

/** Todas las migraciones del proyecto, en orden de id. */
export const ALL_MIGRATIONS: Migration[] = [
  migration001ProjectSnapshots,
  migration002BaselinesAsSnapshots,
  migration003ShareColumns,
];
