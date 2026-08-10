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

  test("down borra exactamente lo que up creó, no unos nombres escritos a mano", async () => {
    const client = fakeClient();
    await migration001ProjectSnapshots.up(client);

    // Los nombres salen del SQL que up ejecutó de verdad. Si up los cambia y
    // down no, este test lo caza; con literales fijos, no.
    const sqlDeUp = client.sql.join("\n");
    const tabla = sqlDeUp.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    const indice = sqlDeUp.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
    expect(tabla).toBeTruthy();
    expect(indice).toBeTruthy();

    const antes = client.sql.length;
    await migration001ProjectSnapshots.down(client);
    const sqlDeDown = client.sql.slice(antes).join("\n");

    expect(sqlDeDown).toContain(`DROP INDEX IF EXISTS ${indice}`);
    expect(sqlDeDown).toContain(`DROP TABLE IF EXISTS ${tabla}`);
  });
});
