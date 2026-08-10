import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * «Productividad» prometía obra ejecutada por día, y el número era el inverso
 * de la duración. Se llama **Ritmo** en toda la interfaz, sin excepción.
 *
 * La palabra se prohíbe entera —comentarios incluidos— porque un comentario
 * que la nombra es la semilla de que vuelva a la pantalla en el siguiente
 * copiar-pegar. La productividad real llegará cuando la matriz aporte
 * cantidades de obra ejecutada; ese es el dato que falta, y hasta entonces
 * este nombre está reservado.
 */
const SRC_DIR = path.resolve(__dirname, "../..");
/**
 * Los archivos que hablan **de** la palabra en vez de usarla en pantalla.
 *
 * `docsConsistency.test.ts` comprueba que el registro de pendientes explica por
 * qué el nombre está reservado, así que tiene que nombrarlo. Es la excepción
 * que confirma la regla, y se declara por nombre para que se vea.
 */
const ARCHIVOS_QUE_HABLAN_DE_LA_PALABRA = new Set([
  "copyProductividad.test.ts",
  "docsConsistency.test.ts",
]);

function archivosDeInterfaz(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return archivosDeInterfaz(full);
    if (ARCHIVOS_QUE_HABLAN_DE_LA_PALABRA.has(entry)) return [];
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe("Detector de «Productividad» en la interfaz (R6)", () => {
  test("la palabra no aparece en ningún archivo de src", () => {
    const culpables = archivosDeInterfaz(SRC_DIR)
      .filter((file) => /Productividad/i.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC_DIR, file));

    expect(culpables).toEqual([]);
  });
});
