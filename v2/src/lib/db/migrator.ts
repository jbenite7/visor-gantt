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

/**
 * Clave arbitraria y fija para el lock consultivo (`pg_advisory_lock`) que
 * serializa las migraciones entre procesos. Con varias instancias arrancando
 * a la vez (réplicas de un deploy, `docker-compose up --scale`), sin este
 * lock dos procesos podrían leer el mismo pendiente y ejecutar su `up()` dos
 * veces: `ON CONFLICT DO NOTHING` protege la fila de control, no el DDL.
 */
const ADVISORY_LOCK_KEY = 727271;

function assertNoDuplicateIds(migrations: Migration[]): void {
  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.id)) {
      throw new Error(`Id de migración duplicado: ${migration.id}`);
    }
    seen.add(migration.id);
  }
}

export async function appliedMigrationIds(
  client: MigrationClient,
): Promise<string[]> {
  await client.query(CREATE_MIGRATIONS_TABLE);
  const result = await client.query("SELECT id FROM schema_migrations ORDER BY id");
  return result.rows.map((row) => String(row.id));
}

/**
 * Aplica las pendientes en orden de `id`. Devuelve las que ejecutó.
 *
 * Cada migración corre dentro de su propia transacción (`BEGIN`/`COMMIT`,
 * `ROLLBACK` si falla): DDL de PostgreSQL es transaccional, así que si `up()`
 * lanza a mitad de camino no quedan tablas a medio crear sin registro en
 * `schema_migrations`. Todo el proceso queda serializado por un lock
 * consultivo para que dos procesos no ejecuten la misma migración a la vez.
 */
export async function runMigrations(
  client: MigrationClient,
  migrations: Migration[],
): Promise<string[]> {
  assertNoDuplicateIds(migrations);

  await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
  try {
    const applied = new Set(await appliedMigrationIds(client));
    const executed: string[] = [];

    for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
      if (applied.has(migration.id)) continue;

      await client.query("BEGIN");
      try {
        await migration.up(client);
        await client.query(
          "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
          [migration.id],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      executed.push(migration.id);
    }

    return executed;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
  }
}

/**
 * Revierte una migración aplicada. `false` si no estaba aplicada o si el
 * `id` no existe en `migrations` (un typo del programador). Estos dos casos
 * son indistinguibles para quien llama: es una limitación conocida del
 * contrato, heredada del brief, que no se cambia aquí.
 *
 * `down()` y su `DELETE` corren en la misma transacción: si `down()` falla,
 * la migración sigue registrada como aplicada (no queda a medias).
 */
export async function rollbackMigration(
  client: MigrationClient,
  migrations: Migration[],
  id: string,
): Promise<boolean> {
  await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
  try {
    const applied = new Set(await appliedMigrationIds(client));
    if (!applied.has(id)) return false;

    const migration = migrations.find((candidate) => candidate.id === id);
    if (!migration) return false;

    await client.query("BEGIN");
    try {
      await migration.down(client);
      await client.query("DELETE FROM schema_migrations WHERE id = $1", [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return true;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
  }
}
