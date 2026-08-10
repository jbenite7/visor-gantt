import {
  appliedMigrationIds,
  rollbackMigration,
  runMigrations,
  type Migration,
  type MigrationClient,
} from "./migrator";

/** Cliente falso: recuerda el SQL ejecutado y simula la tabla schema_migrations. */
function fakeClient(): MigrationClient & { sql: string[] } {
  const applied: string[] = [];
  const sql: string[] = [];

  return {
    sql,
    async query(text: string, params?: unknown[]) {
      sql.push(text.trim());
      if (text.includes("SELECT id FROM schema_migrations")) {
        return { rows: applied.map((id) => ({ id })) };
      }
      if (text.includes("INSERT INTO schema_migrations")) {
        applied.push(String(params?.[0]));
        return { rows: [] };
      }
      if (text.includes("DELETE FROM schema_migrations")) {
        const index = applied.indexOf(String(params?.[0]));
        if (index >= 0) applied.splice(index, 1);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

function migration(id: string, log: string[]): Migration {
  return {
    id,
    async up() {
      log.push(`up:${id}`);
    },
    async down() {
      log.push(`down:${id}`);
    },
  };
}

describe("migrador de esquema", () => {
  test("crea la tabla de control antes de consultar nada", async () => {
    const client = fakeClient();

    await appliedMigrationIds(client);

    expect(client.sql[0]).toContain("CREATE TABLE IF NOT EXISTS schema_migrations");
  });

  test("aplica las migraciones pendientes en orden de id", async () => {
    const client = fakeClient();
    const log: string[] = [];

    const ejecutadas = await runMigrations(client, [
      migration("002_segunda", log),
      migration("001_primera", log),
    ]);

    expect(log).toEqual(["up:001_primera", "up:002_segunda"]);
    expect(ejecutadas).toEqual(["001_primera", "002_segunda"]);
  });

  test("volver a correrlas no repite ninguna", async () => {
    const client = fakeClient();
    const log: string[] = [];
    const migraciones = [migration("001_primera", log), migration("002_segunda", log)];

    await runMigrations(client, migraciones);
    const segundaVuelta = await runMigrations(client, migraciones);

    expect(segundaVuelta).toEqual([]);
    expect(log).toEqual(["up:001_primera", "up:002_segunda"]);
  });

  test("revertir una migración aplicada ejecuta su down y la borra del registro", async () => {
    const client = fakeClient();
    const log: string[] = [];
    const migraciones = [migration("001_primera", log), migration("002_segunda", log)];
    await runMigrations(client, migraciones);

    const revertida = await rollbackMigration(client, migraciones, "002_segunda");

    expect(revertida).toBe(true);
    expect(log).toEqual(["up:001_primera", "up:002_segunda", "down:002_segunda"]);
    expect(await appliedMigrationIds(client)).toEqual(["001_primera"]);
  });

  test("revertir una migración que no se aplicó no hace nada", async () => {
    const client = fakeClient();
    const log: string[] = [];

    const revertida = await rollbackMigration(client, [migration("001_primera", log)], "001_primera");

    expect(revertida).toBe(false);
    expect(log).toEqual([]);
  });

  test("revertir un id que no está en el array de migraciones también da false (indistinguible de 'no aplicada')", async () => {
    const client = fakeClient();
    const log: string[] = [];
    const migraciones = [migration("001_primera", log)];
    await runMigrations(client, migraciones);

    await expect(
      rollbackMigration(client, migraciones, "001_primera_mal_escrita"),
    ).resolves.toBe(false);
  });

  test("ids duplicados son un error de programación y no ejecutan nada", async () => {
    const client = fakeClient();
    const log: string[] = [];

    await expect(
      runMigrations(client, [migration("001_x", log), migration("001_x", log)]),
    ).rejects.toThrow(/duplicad/i);

    expect(log).toEqual([]);
  });

  test("si up() falla a mitad de camino, revierte la transacción y no queda registrada", async () => {
    const client = fakeClient();
    const migracionRota: Migration = {
      id: "001_rota",
      async up(c) {
        await c.query("CREATE TABLE foo (id INT)");
        throw new Error("fallo simulado en up()");
      },
      async down() {},
    };

    await expect(runMigrations(client, [migracionRota])).rejects.toThrow(
      "fallo simulado en up()",
    );

    expect(client.sql).toContain("ROLLBACK");
    expect(await appliedMigrationIds(client)).toEqual([]);
  });

  test("si down() falla, la migración sigue registrada como aplicada", async () => {
    const client = fakeClient();
    const migraciones: Migration[] = [
      {
        id: "001_x",
        async up() {},
        async down() {
          throw new Error("fallo simulado en down()");
        },
      },
    ];
    await runMigrations(client, migraciones);

    await expect(rollbackMigration(client, migraciones, "001_x")).rejects.toThrow(
      "fallo simulado en down()",
    );

    expect(await appliedMigrationIds(client)).toEqual(["001_x"]);
  });

  test("toma un lock consultivo al migrar y lo suelta al terminar", async () => {
    const client = fakeClient();
    const log: string[] = [];

    await runMigrations(client, [migration("001_primera", log)]);

    expect(client.sql.some((s) => s.includes("pg_advisory_lock"))).toBe(true);
    expect(client.sql.some((s) => s.includes("pg_advisory_unlock"))).toBe(true);
  });

  test("suelta el lock consultivo aunque una migración falle", async () => {
    const client = fakeClient();
    const migracionRota: Migration = {
      id: "001_rota",
      async up() {
        throw new Error("boom");
      },
      async down() {},
    };

    await expect(runMigrations(client, [migracionRota])).rejects.toThrow("boom");

    expect(client.sql.some((s) => s.includes("pg_advisory_unlock"))).toBe(true);
  });
});
