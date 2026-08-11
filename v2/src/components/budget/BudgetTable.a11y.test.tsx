/**
 * @jest-environment jsdom
 */
import { readFileSync } from "node:fs";

/**
 * Los campos de las tablas editables tienen nombre para quien no ve la columna.
 *
 * Estaban solo con `placeholder`, que **no es un nombre accesible**: desaparece
 * en cuanto el usuario escribe, y varios decían `"0"`, que no dice nada. Un
 * lector de pantalla anunciaba «campo de texto» ocho veces seguidas sin decir
 * cuál era cuál.
 *
 * Se comprueba sobre el texto del fichero, no montando la tabla: lo que importa
 * es que ningún campo nuevo entre sin etiqueta.
 */
const FICHEROS = [
  "src/components/budget/BudgetTable.tsx",
  "src/components/views/ResourceSheetView.tsx",
];

describe("las tablas editables etiquetan sus campos", () => {
  for (const fichero of FICHEROS) {
    test(`${fichero} no tiene campos mudos`, () => {
      const source = readFileSync(fichero, "utf8");
      const mudos: string[] = [];

      for (const m of source.matchAll(/<input\b[\s\S]{0,600}?\/>/g)) {
        const bloque = m[0];
        if (/aria-label|aria-labelledby/.test(bloque)) continue;
        // Los que no llevan nombre porque no lo necesitan.
        if (/type=["'](hidden|file|checkbox|radio)["']/.test(bloque)) continue;
        mudos.push(source.slice(0, m.index).split("\n").length.toString());
      }

      expect(mudos).toEqual([]);
    });
  }
});
