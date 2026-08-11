import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Ningún componente construido queda fuera del alcance del usuario.
 *
 * Es **el patrón que este proyecto existe para eliminar**: función construida
 * que nadie puede usar. Se ha repetido todo el trabajo — una API de Last Planner
 * que ningún botón llamaba, un export sin botón, la matriz fuera del menú, y
 * hasta una ruta de adopción que un enlace prometía y no existía.
 *
 * Un componente que nadie importa es la versión más barata de ese fallo, y la
 * más fácil de dejar pasar: no rompe nada, no sale en ninguna pantalla, y la
 * suite entera sigue verde.
 */
const RAIZ_COMPONENTES = "src/components";

/**
 * Componentes sin importador a propósito, declarados uno a uno con su motivo.
 *
 * Declarar es el punto: una excepción escrita es una decisión; una excepción
 * silenciosa es el fallo otra vez.
 */
const SIN_IMPORTADOR_A_PROPOSITO: { componente: string; porque: string }[] = [];

function ficherosTsx(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = join(dir, entrada);
    if (statSync(completa).isDirectory()) {
      salida.push(...ficherosTsx(completa));
    } else if (entrada.endsWith(".tsx") && !entrada.includes(".test.")) {
      salida.push(completa);
    }
  }
  return salida;
}

function ficherosDeCodigo(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = join(dir, entrada);
    if (statSync(completa).isDirectory()) {
      salida.push(...ficherosDeCodigo(completa));
    } else if (
      (entrada.endsWith(".ts") || entrada.endsWith(".tsx")) &&
      !entrada.includes(".test.")
    ) {
      salida.push(completa);
    }
  }
  return salida;
}

describe("todo componente construido lo puede alcanzar alguien", () => {
  const componentes = ficherosTsx(RAIZ_COMPONENTES);
  const fuentes = ficherosDeCodigo("src").map((f) => ({
    f,
    s: readFileSync(f, "utf8"),
  }));

  test("se leyeron componentes de verdad: el guardián no mira al vacío", () => {
    expect(componentes.length).toBeGreaterThan(20);
    expect(fuentes.length).toBeGreaterThan(componentes.length);
  });

  test("ninguno se quedó sin quien lo use", () => {
    const huerfanos: string[] = [];

    for (const componente of componentes) {
      const nombre = basename(componente, ".tsx");
      if (SIN_IMPORTADOR_A_PROPOSITO.some((e) => e.componente === nombre)) {
        continue;
      }

      // Se busca el nombre en cualquier otro fichero de código: la importación
      // puede escribirse con ruta relativa o con alias, así que se sigue el
      // nombre y no la forma de escribirla.
      const loUsaAlguien = fuentes.some(
        ({ f, s }) => f !== componente && new RegExp(`\\b${nombre}\\b`).test(s),
      );

      if (!loUsaAlguien) huerfanos.push(componente);
    }

    expect(huerfanos).toEqual([]);
  });
});
