import { readFileSync } from "node:fs";

/**
 * El índice de `project_members(user_id)` nace con su tabla.
 *
 * Lo creaba la migración 006, y esa migración **falla en una instalación
 * nueva**: cuando corre, `project_members` todavía no existe —la crea
 * `ensureAuthTables` cuando alguien toca la sesión, no el migrador—. Medido
 * sobre una base virgen.
 *
 * Guardar la migración para que no reviente no basta: quedaría registrada como
 * aplicada y el índice **no se crearía nunca**, que es peor que fallar, porque
 * no se nota. Un índice que falta solo se ve cuando la pantalla que más se abre
 * empieza a ir lenta, con la base ya grande.
 *
 * Por eso el índice se crea junto a la tabla. La migración 006 se queda para
 * las bases que ya existen; aquí se cubre el camino de las nuevas.
 */
describe("las tablas de sesión traen sus índices puestos", () => {
  const rbac = readFileSync("src/lib/auth/rbac.ts", "utf8");

  test("se leyó el fichero de verdad", () => {
    expect(rbac).toContain("CREATE TABLE IF NOT EXISTS project_members");
  });

  test("crea el índice por usuario junto a project_members", () => {
    expect(rbac).toMatch(
      /CREATE INDEX IF NOT EXISTS \w+[\s\S]{0,80}project_members\s*\(user_id\)/,
    );
  });
});
