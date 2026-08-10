import type { PoolClient } from "pg";

/**
 * Migrador de esquema.
 *
 * El repo no tenía ninguno: las tablas se creaban con `CREATE TABLE IF NOT
 * EXISTS` sueltos y no había forma de revertir nada. Este módulo es lo mínimo
 * para que una migración se pueda aplicar una sola vez y deshacer.
 */

/** Lo poco que un `PoolClient` necesita exponer para migrar. */
export interface MigrationClient {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
}

export interface Migration {
  /** Ordena la ejecución: `001_...`, `002_...` */
  id: string;
  up: (client: MigrationClient) => Promise<void>;
  down: (client: MigrationClient) => Promise<void>;
}

/** Envuelve un cliente de `pg` para no arrastrar sus sobrecargas de tipos. */
export function migrationClient(client: PoolClient): MigrationClient {
  return {
    query: async (sql, params) => {
      const result = await client.query(sql, params as unknown[]);
      return { rows: result.rows as Record<string, unknown>[] };
    },
  };
}

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export async function appliedMigrationIds(
  client: MigrationClient,
): Promise<string[]> {
  await client.query(CREATE_MIGRATIONS_TABLE);
  const result = await client.query("SELECT id FROM schema_migrations ORDER BY id");
  return result.rows.map((row) => String(row.id));
}

/** Aplica las pendientes en orden de `id`. Devuelve las que ejecutó. */
export async function runMigrations(
  client: MigrationClient,
  migrations: Migration[],
): Promise<string[]> {
  const applied = new Set(await appliedMigrationIds(client));
  const executed: string[] = [];

  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (applied.has(migration.id)) continue;
    await migration.up(client);
    await client.query(
      "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
      [migration.id],
    );
    executed.push(migration.id);
  }

  return executed;
}

/** Revierte una migración aplicada. `false` si no estaba aplicada o no existe. */
export async function rollbackMigration(
  client: MigrationClient,
  migrations: Migration[],
  id: string,
): Promise<boolean> {
  const applied = new Set(await appliedMigrationIds(client));
  if (!applied.has(id)) return false;

  const migration = migrations.find((candidate) => candidate.id === id);
  if (!migration) return false;

  await migration.down(client);
  await client.query("DELETE FROM schema_migrations WHERE id = $1", [id]);
  return true;
}
