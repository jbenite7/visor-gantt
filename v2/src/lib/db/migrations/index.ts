import type { Migration } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";

/** Todas las migraciones del proyecto, en orden de id. */
export const ALL_MIGRATIONS: Migration[] = [migration001ProjectSnapshots];
