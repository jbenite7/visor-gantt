import type { MigrationClient } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";

function fakeClient(): MigrationClient & { sql: string[] } {
  const sql: string[] = [];
  return {
    sql,
    async query(text: string) {
      sql.push(text.trim());
      return { rows: [] };
    },
  };
}

describe("migración 001 · tabla project_snapshots", () => {
  test("el id declara el orden", () => {
    expect(migration001ProjectSnapshots.id).toBe("001_project_snapshots");
  });

  test("up crea la tabla con clave compuesta por proyecto y foto", async () => {
    const client = fakeClient();

    await migration001ProjectSnapshots.up(client);

    const creacion = client.sql.join("\n");
    expect(creacion).toContain("CREATE TABLE IF NOT EXISTS project_snapshots");
    expect(creacion).toContain("project_id TEXT NOT NULL");
    expect(creacion).toContain("origin TEXT NOT NULL");
    expect(creacion).toContain("captured_at TIMESTAMPTZ NOT NULL");
    expect(creacion).toContain("tasks JSONB NOT NULL");
    expect(creacion).toContain("PRIMARY KEY (project_id, id)");
  });

  test("up crea el índice de lectura por proyecto y fecha", async () => {
    const client = fakeClient();

    await migration001ProjectSnapshots.up(client);

    expect(client.sql.join("\n")).toContain(
      "CREATE INDEX IF NOT EXISTS idx_project_snapshots_project",
    );
  });

  test("down deshace el índice y la tabla, en ese orden", async () => {
    const client = fakeClient();

    await migration001ProjectSnapshots.down(client);

    expect(client.sql[0]).toContain("DROP INDEX IF EXISTS idx_project_snapshots_project");
    expect(client.sql[1]).toContain("DROP TABLE IF EXISTS project_snapshots");
  });

  test("up y down componen: revertir deja el mismo estado que antes de aplicar", async () => {
    const client = fakeClient();

    await migration001ProjectSnapshots.up(client);
    const sqlDespuesDeUp = [...client.sql];
    client.sql.length = 0;

    await migration001ProjectSnapshots.down(client);

    expect(sqlDespuesDeUp.some((s) => s.includes("CREATE TABLE"))).toBe(true);
    expect(client.sql[0]).toContain("DROP INDEX IF EXISTS idx_project_snapshots_project");
    expect(client.sql[1]).toContain("DROP TABLE IF EXISTS project_snapshots");
  });
});
