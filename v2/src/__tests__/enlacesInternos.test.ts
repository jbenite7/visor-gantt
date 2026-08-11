import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ningún enlace interno apunta a una ruta que no existe.
 *
 * Salió de un fallo propio: la pantalla del enlace compartido ofrecía «Crear
 * cuenta y quedármelo» apuntando a `/adoptar/<token>`, y esa ruta **no estaba
 * construida**. Un botón que promete lo que no hace es exactamente el patrón
 * que este trabajo lleva semanas eliminando, y se coló igual — con toda la
 * suite en verde, porque ningún test miraba esa propiedad.
 *
 * Se comprueba contra el árbol de `src/app`, que es donde el App Router decide
 * qué existe.
 */
const APP = "src/app";

/** Todas las rutas que el App Router sirve, con `[param]` como comodín. */
function rutasExistentes(dir = APP, prefijo = ""): string[] {
  const rutas: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = join(dir, entrada);
    if (!statSync(completa).isDirectory()) continue;
    // Los grupos `(nombre)` no aparecen en la URL.
    const segmento = entrada.startsWith("(") ? "" : `/${entrada}`;
    const ruta = `${prefijo}${segmento}`;
    // `page.tsx` sirve una pantalla; `route.ts` sirve una API. Las dos son
    // destinos válidos de un enlace.
    if (
      existsSync(join(completa, "page.tsx")) ||
      existsSync(join(completa, "route.ts"))
    ) {
      rutas.push(ruta || "/");
    }
    rutas.push(...rutasExistentes(completa, ruta));
  }
  return rutas;
}

/** ¿La ruta pedida casa con alguna existente, contando los `[param]`? */
function existeRuta(pedida: string, existentes: string[]): boolean {
  const partesPedidas = pedida.split("/").filter(Boolean);

  return existentes.some((existente) => {
    const partes = existente.split("/").filter(Boolean);

    // Un literal puede ser la ruta entera (`/login`) o solo el trozo anterior a
    // una interpolación (`/adoptar` en `/adoptar/${token}`). En el segundo caso
    // vale si alguna ruta real empieza por ahí: lo que se comprueba es que el
    // destino exista, no que el literal lo escriba completo.
    if (partes.length < partesPedidas.length) return false;

    return partesPedidas.every(
      (pedida_, i) => partes[i].startsWith("[") || partes[i] === pedida_,
    );
  });
}

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

describe("todo enlace interno lleva a una ruta que existe", () => {
  // La raíz no es un subdirectorio, así que se añade a mano: sin esto, todo
  // enlace a `/` -que los hay en media app- saldría como roto.
  const existentes = [
    ...(existsSync(join(APP, "page.tsx")) ? ["/"] : []),
    ...rutasExistentes(),
  ];

  test("se leyó el árbol de rutas de verdad", () => {
    expect(existentes.length).toBeGreaterThan(5);
    expect(existentes).toContain("/login");
  });

  test("ningún href apunta al vacío", () => {
    const rotos: string[] = [];

    for (const fichero of [...ficherosTsx("src/app"), ...ficherosTsx("src/components")]) {
      const source = readFileSync(fichero, "utf8");
      // Cualquier literal con pinta de ruta interna, no solo lo que sigue a
      // `href=`. La primera versión miraba solo `href=` y **no cazaba el fallo
      // que la motivó**: el enlace real era
      // `/login?next=${encodeURIComponent(`/adoptar/${token}`)}`, con la ruta
      // rota anidada dentro. Un guardián que no caza su propio caso es peor que
      // ninguno, porque además tranquiliza.
      for (const m of source.matchAll(/["'`](\/[a-z][a-z0-9/-]*)/g)) {
        const ruta = m[1].replace(/\/$/, "") || "/";
        if (!existeRuta(ruta, existentes)) {
          rotos.push(`${fichero}: ${ruta}`);
        }
      }
    }

    expect(rotos).toEqual([]);
  });
});
