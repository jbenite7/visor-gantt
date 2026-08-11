import { readFileSync } from "node:fs";

/**
 * Punto 4 de la auditoría del 2026-08-10.
 *
 * `POSTGRES_PASSWORD` estaba escrita literal mientras el resto del fichero sí
 * interpolaba: cambiarla en el `.env` no hacía nada, y si además se cambiaba
 * `DATABASE_URL` la app se rompía **sin haber cambiado la contraseña real**.
 * Agravante: pgAdmin publicado con credenciales por defecto, y todos los
 * puertos abiertos a cualquier interfaz de la máquina.
 */
describe("docker-compose no fija credenciales ni abre puertos de más", () => {
  const compose = readFileSync("../docker-compose.yml", "utf8");

  test("la contraseña de la base se puede cambiar desde el entorno", () => {
    expect(compose).toMatch(/POSTGRES_PASSWORD:\s*\$\{/);
  });

  test("usuario y base también, para que no queden a medias", () => {
    expect(compose).toMatch(/POSTGRES_USER:\s*\$\{/);
    expect(compose).toMatch(/POSTGRES_DB:\s*\$\{/);
  });

  test("ningún puerto se publica a todas las interfaces", () => {
    const publicados = [...compose.matchAll(/^\s+- "([^"]+:\d+)"/gm)].map(
      (m) => m[1],
    );

    expect(publicados.length).toBeGreaterThan(0);
    const abiertos = publicados.filter((p) => !p.startsWith("127.0.0.1:"));
    expect(abiertos).toEqual([]);
  });

  test("pgAdmin no se levanta por defecto", () => {
    // Vive detrás de un perfil: `docker compose --profile admin up`.
    const bloque = compose.slice(compose.indexOf("pgadmin:"));
    expect(bloque).toContain("profiles:");
  });

  test("no queda ninguna contraseña literal suelta", () => {
    expect(compose).not.toMatch(/PASSWORD:\s*[A-Za-z0-9]/);
  });
});
