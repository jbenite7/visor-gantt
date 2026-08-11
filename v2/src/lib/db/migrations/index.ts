import type { Migration } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";
import { migration002BaselinesAsSnapshots } from "./002_baselines_as_snapshots";
import { migration003ShareColumns } from "./003_share_columns";
import { migration004ProjectOwnership } from "./004_project_ownership";
import { migration005ProjectVersion } from "./005_project_version";

/**
 * Todas las migraciones del proyecto, **en orden de id**.
 *
 * El migrador ejecuta este array tal cual, así que el orden no es decorativo:
 * un id fuera de sitio se aplicaría antes de tiempo. Hay un test que lo
 * comprueba, porque «acuérdate de ponerla al final» no es una garantía.
 */
export const ALL_MIGRATIONS: Migration[] = [
  migration001ProjectSnapshots,
  migration002BaselinesAsSnapshots,
  migration003ShareColumns,
  migration004ProjectOwnership,
  migration005ProjectVersion,
];
