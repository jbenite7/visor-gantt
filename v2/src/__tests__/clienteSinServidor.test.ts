import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ningún componente de cliente arrastra código de servidor.
 *
 * Salió de un fallo propio: para que una pantalla enseñara el plazo de
 * caducidad le hice importar `SHARE_TTL_DAYS` desde el módulo que genera el
 * token, y ese módulo importa `node:crypto`. **El build de producción dejó de
 * compilar**, y lo cazó el build — no la suite, que siguió verde con sus 1.851
 * tests, porque Jest corre en Node y allí `node:crypto` existe.
 *
 * Es la clase de fallo que solo aparece al empaquetar, y por eso merece un
 * guardián propio: esperar al build es esperar demasiado tarde.
 */
const MODULOS_DE_SERVIDOR = [
  "node:crypto",
  "node:fs",
  "node:path",
  '"pg"',
  "@/lib/db",
];

function ficheros(dir: string, ext: string[]): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = join(dir, entrada);
    if (statSync(completa).isDirectory()) {
      salida.push(...ficheros(completa, ext));
    } else if (ext.some((x) => entrada.endsWith(x)) && !entrada.includes(".test.")) {
      salida.push(completa);
    }
  }
  return salida;
}

/** Qué importa un fichero, con rutas de alias resueltas a fichero real. */
function importesDe(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

function resolver(especificador: string, desde: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) base = join("src", especificador.slice(2));
  else if (especificador.startsWith(".")) base = join(desde, "..", especificador);
  else return null;

  for (const sufijo of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidato = base + sufijo;
    try {
      if (statSync(candidato).isFile()) return candidato;
    } catch {
      // sigue probando
    }
  }
  return null;
}

describe("las pantallas de cliente no arrastran el servidor", () => {
  const clientes = ficheros("src", [".tsx", ".ts"]).filter((f) =>
    readFileSync(f, "utf8").startsWith('"use client"'),
  );

  test("hay componentes de cliente que revisar", () => {
    expect(clientes.length).toBeGreaterThan(5);
  });

  test("ninguno importa, ni de segunda mano, código que solo existe en el servidor", () => {
    const culpables: string[] = [];

    for (const cliente of clientes) {
      const vistos = new Set<string>();
      const pendientes = [cliente];

      while (pendientes.length > 0) {
        const actual = pendientes.pop()!;
        if (vistos.has(actual)) continue;
        vistos.add(actual);

        const source = readFileSync(actual, "utf8");
        for (const imp of importesDe(source)) {
          if (MODULOS_DE_SERVIDOR.some((m) => imp === m.replace(/"/g, ""))) {
            culpables.push(`${cliente} → ${actual} → ${imp}`);
            continue;
          }
          const destino = resolver(imp, actual);
          // Solo se sigue dentro de `lib`: los componentes de cliente que
          // importan otros componentes de cliente no aportan nada aquí.
          if (destino && destino.startsWith("src/lib")) pendientes.push(destino);
        }
      }
    }

    expect(culpables).toEqual([]);
  });
});
