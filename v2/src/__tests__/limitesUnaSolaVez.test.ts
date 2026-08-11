import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MAX_FILE_SIZE_MB } from "@/lib/import/uploadLimits";
import { SHARE_TTL_DAYS } from "@/lib/share/shareToken";

/**
 * Un número que el usuario ve, escrito una sola vez.
 *
 * El límite de subida estaba copiado **cinco veces** —dos rutas, dos
 * componentes y un comentario— y el plazo de caducidad del enlace estaba a mano
 * en el copy de dos pantallas mientras `SHARE_TTL_DAYS` era la fuente.
 *
 * No es cosmética: el día que alguien suba el tope a 100 MB en la ruta, la
 * pantalla seguirá diciendo 50 y rechazando antes de intentarlo, o peor —dirá
 * 100 y el servidor rechazará—. Es la misma forma de fallo que este trabajo
 * lleva semanas cerrando: la app afirmando algo que no cumple.
 */
function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = join(dir, entrada);
    if (statSync(completa).isDirectory()) {
      salida.push(...ficheros(completa));
    } else if (
      (entrada.endsWith(".ts") || entrada.endsWith(".tsx")) &&
      !entrada.includes(".test.")
    ) {
      salida.push(completa);
    }
  }
  return salida;
}

const FUENTES = ficheros("src").map((f) => ({ f, s: readFileSync(f, "utf8") }));

describe("los límites que el usuario ve se escriben una sola vez", () => {
  test("el tope de subida se define en un único sitio", () => {
    const definiciones = FUENTES.filter(({ s }) =>
      /(const|let)\s+MAX_FILE_SIZE_MB\s*=/.test(s),
    ).map(({ f }) => f);

    expect(definiciones).toEqual(["src/lib/import/uploadLimits.ts"]);
    expect(MAX_FILE_SIZE_MB).toBe(50);
  });

  test("ninguna pantalla se escribe su propio formateador de fechas", () => {
    // Estaba duplicado palabra por palabra en dos pantallas, y una tercera lo
    // escribía distinto: la misma app enseñando `11/08/2026` y `11/8/2026`.
    // `formatIsoDay` y `formatProjectDate` viven en `lib/date`.
    const aMano = FUENTES.filter(
      ({ f }) => f.startsWith("src/components") || f.startsWith("src/app"),
    )
      .filter(({ s }) =>
        /\$\{day\}\/\$\{month\}\/\$\{year\}|getUTCMonth\(\) \+ 1\}\//.test(s),
      )
      .map(({ f }) => f);

    expect(aMano).toEqual([]);
  });

  test("ninguna pantalla escribe el plazo de caducidad a mano", () => {
    // `SHARE_TTL_DAYS` es la fuente; el copy tiene que salir de ahí.
    const aMano = FUENTES.filter(
      ({ f, s }) =>
        f.startsWith("src/components") || f.startsWith("src/app"),
    )
      .filter(({ s }) => /\b7 días\b/.test(s))
      .map(({ f }) => f);

    expect(aMano).toEqual([]);
    expect(SHARE_TTL_DAYS).toBe(7);
  });
});
