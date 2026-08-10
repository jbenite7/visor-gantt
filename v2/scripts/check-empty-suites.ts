import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Ningún test queda apagado sin que alguien lo haya decidido.
 *
 * Este guardián nació de un susto que **resultó no serlo**, y conviene dejarlo
 * escrito para que nadie lo repita como cierto: el 2026-08-10, resolviendo un
 * conflicto de fusión, una llave suelta dejó un fichero sin compilar. Se contó
 * primero como «la suite siguió en verde porque los otros 174 compensaban».
 * **Era falso.** Jest falló con `TS1005: '}' expected` y reportó
 * «1 failed, 174 passed»: dijo exactamente qué fichero, y no se le escapó nada.
 *
 * El agujero de verdad apareció al ir a comprobarlo, y es otro. **Jest ya cubre
 * el caso del fichero sin tests**: falla con «Your test suite must contain at
 * least one test». Lo que **no** cubre es un `describe.skip` o un `test.skip`
 * — ahí informa «2 skipped» y devuelve **éxito**. Ese sí apaga un fichero
 * entero sin que nada se ponga rojo. Verificado reproduciéndolo, no deducido.
 *
 * Este guardián cierra esa mitad: los saltados permitidos se declaran aquí,
 * uno por uno y con su motivo. Cualquier otro rompe la comprobación.
 *
 * No puede ser un test de Jest: tendría que ejecutar Jest desde dentro de
 * Jest. Se corre con `npm run test:no-empty`, antes de fusionar.
 */
const SALTADOS_DECLARADOS: { prueba: RegExp; porque: string }[] = [
  {
    prueba: /Abscisas de obra lineal/,
    porque:
      "R6: el patrón de abscisas espera un .mpp real de túnel o vía para poder verificarse. Escrito y desactivado a propósito.",
  },
];

const reportPath = join(tmpdir(), `jest-suites-${process.pid}.json`);

interface Assertion {
  fullName: string;
  status: string;
}

function runJest(): { name: string; assertionResults: Assertion[] }[] {
  try {
    execFileSync(
      "npx",
      ["jest", "--runInBand", "--json", `--outputFile=${reportPath}`],
      { cwd: process.cwd(), stdio: "ignore" },
    );
  } catch {
    // Jest sale con código 1 si hay fallos reales. El informe se escribe
    // igualmente, y quien falle lo verá al correr la suite normal: aquí solo
    // interesan los saltados.
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    testResults: { name: string; assertionResults: Assertion[] }[];
  };
  return report.testResults;
}

function main() {
  let suites: ReturnType<typeof runJest>;
  try {
    suites = runJest();
  } finally {
    rmSync(reportPath, { force: true });
  }

  const saltados = suites.flatMap((suite) =>
    suite.assertionResults
      .filter((assertion) => assertion.status !== "passed" && assertion.status !== "failed")
      .map((assertion) => ({
        fichero: suite.name.split("/v2/").pop() ?? suite.name,
        nombre: assertion.fullName,
      })),
  );

  const inesperados = saltados.filter(
    (saltado) =>
      !SALTADOS_DECLARADOS.some((declarado) => declarado.prueba.test(saltado.nombre)),
  );

  if (inesperados.length > 0) {
    console.error(
      `\n${inesperados.length} test(s) apagados sin declarar.\n` +
        "Un `.skip` que nadie decidió suele venir de un conflicto mal resuelto:\n" +
        "el fichero deja de correr y la suite sigue en verde.\n" +
        "Si el salto es a propósito, decláralo en SALTADOS_DECLARADOS con su motivo.\n",
    );
    for (const test of inesperados) {
      console.error(`  · ${test.fichero}\n      ${test.nombre}`);
    }
    process.exit(1);
  }

  const total = suites.reduce(
    (sum, suite) => sum + suite.assertionResults.length,
    0,
  );
  console.log(
    `Sin tests apagados por accidente: ${suites.length} ficheros, ${total} tests, ` +
      `${saltados.length} saltados y todos declarados.`,
  );
}

main();
