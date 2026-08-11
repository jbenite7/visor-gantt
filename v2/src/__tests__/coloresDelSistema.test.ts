import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Los colores salen del sistema, y los tokens que se usan existen.
 *
 * Dos fallos distintos, y el segundo es el que no se ve venir:
 *
 * 1. **Colores escritos a mano.** Catorce pantallas ponían `#ffffff` como texto
 *    de un botón activo, existiendo `--color-text-on-primary`. Mientras el
 *    acento sea oscuro nadie lo nota; el día que se aclare, el texto
 *    desaparece en esos catorce sitios y en ningún otro.
 *
 * 2. **Un token que no existe, con color de reserva.** `TypicalUnitView` usaba
 *    `var(--color-warning, #b45309)`. Ese token **no está definido**, así que lo
 *    que se pintaba siempre era el color de reserva: un naranja fuera de la
 *    paleta, distinto al de todos los demás avisos de la app. La sintaxis de
 *    reserva de CSS convierte un error en algo que parece funcionar.
 */
const GLOBALS = "src/app/globals.css";

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = join(dir, entrada);
    if (statSync(completa).isDirectory()) {
      salida.push(...ficheros(completa));
    } else if (
      (entrada.endsWith(".tsx") || entrada.endsWith(".ts")) &&
      !entrada.includes(".test.")
    ) {
      salida.push(completa);
    }
  }
  return salida;
}

const FUENTES = [...ficheros("src/components"), ...ficheros("src/app")].map(
  (f) => ({ f, s: readFileSync(f, "utf8") }),
);
const CSS = readFileSync(GLOBALS, "utf8");

describe("los colores salen del sistema", () => {
  test("se leyeron fuentes de verdad", () => {
    expect(FUENTES.length).toBeGreaterThan(20);
    expect(CSS).toContain("--color-text-on-primary");
  });

  test("ninguna pantalla escribe un color a mano", () => {
    const aMano = FUENTES.filter(({ s }) =>
      /#[0-9a-fA-F]{6}\b/.test(s),
    ).map(({ f }) => f);

    expect(aMano).toEqual([]);
  });

  test("todo token de color que se usa está definido", () => {
    // Un `var(--token, reserva)` cuyo token no existe pinta la reserva y nadie
    // se entera: parece que funciona, y es un color fuera de la paleta.
    const definidos = new Set(
      [...CSS.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    );

    const inventados = new Set<string>();
    for (const { s } of FUENTES) {
      for (const m of s.matchAll(/var\((--[a-z0-9-]+)/g)) {
        if (!definidos.has(m[1])) inventados.add(m[1]);
      }
    }

    expect([...inventados]).toEqual([]);
  });
});
