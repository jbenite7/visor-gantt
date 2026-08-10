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

  test("revertir un id desconocido es un error de programación, no un silencio", async () => {
    const client = fakeClient();
    const log: string[] = [];
    const migraciones = [migration("001_primera", log)];
    await runMigrations(client, migraciones);

    await expect(
      rollbackMigration(client, migraciones, "001_primera_mal_escrita"),
    ).resolves.toBe(false);
  });
});
