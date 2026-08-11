const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({ __esModule: true, default: { connect } }));

const runMigrations = jest.fn(async () => {});
jest.mock("@/lib/db/migrator", () => ({
  runMigrations: (...args: unknown[]) => runMigrations(...args),
  migrationClient: (c: unknown) => c,
}));

import { ensureSchema, resetSchemaCache } from "./ensureSchema";

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  connect.mockClear();
  runMigrations.mockClear();
  runMigrations.mockResolvedValue(undefined);
  resetSchemaCache();
});

/**
 * Las migraciones solo se disparaban desde `snapshots.ts`, es decir, al abrir
 * la Curva S. E51 estrena rutas públicas que necesitan `share_token` y
 * `expires_at` **en la primera visita**, y esas rutas no pasan por ahí.
 */
describe("ensureSchema", () => {
  test("aplica las migraciones", async () => {
    await ensureSchema();

    expect(runMigrations).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalled();
  });

  test("no las repite en cada petición: una vez por proceso", async () => {
    await ensureSchema();
    await ensureSchema();
    await ensureSchema();

    expect(runMigrations).toHaveBeenCalledTimes(1);
  });

  test("varias llamadas a la vez comparten el mismo trabajo", async () => {
    await Promise.all([ensureSchema(), ensureSchema(), ensureSchema()]);

    expect(runMigrations).toHaveBeenCalledTimes(1);
  });

  test("si fallan, se reintenta en la siguiente: un fallo no se cachea", async () => {
    runMigrations.mockRejectedValueOnce(new Error("base caída"));

    await expect(ensureSchema()).rejects.toThrow("base caída");
    expect(release).toHaveBeenCalled();

    await ensureSchema();
    expect(runMigrations).toHaveBeenCalledTimes(2);
  });
});
