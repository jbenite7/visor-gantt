import type { Migration } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";
import { migration002BaselinesAsSnapshots } from "./002_baselines_as_snapshots";
// El hueco del 003 es a proposito: esa migracion vive en la rama de E51, que
// esta en pausa. Son independientes, asi que el orden entre ellas da igual.
import { migration004ProjectOwnership } from "./004_project_ownership";
import { migration005ProjectVersion } from "./005_project_version";

/** Todas las migraciones del proyecto, en orden de id. */
export const ALL_MIGRATIONS: Migration[] = [
  migration001ProjectSnapshots,
  migration002BaselinesAsSnapshots,
  migration004ProjectOwnership,
  migration005ProjectVersion,
];
