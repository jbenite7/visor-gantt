import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Si el historial cubriera solo algunas operaciones, el usuario no podría
 * predecir qué se deshace — que es peor que no tener deshacer. La única
 * forma de garantizarlo es que `setDraft` no exista.
 */
describe("Detector de mutaciones fuera de la pila (R1)", () => {
  const source = readFileSync(
    path.resolve(__dirname, "MatrixEditorView.tsx"),
    "utf8",
  );

  test("el editor no muta el borrador con setDraft", () => {
    const lineasCulpables = source
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      // `resetDraft(` contiene la cadena y es legítimo: se busca la palabra
      // suelta, no el trozo. Este mismo descuido convirtió `resetDraft` en
      // `recommitDraft` durante el renombrado, y ningún test lo vio.
      .filter((entry) => /(?<![A-Za-z])setDraft\(/.test(entry.line))
      .map((entry) => `${entry.number}: ${entry.line.trim()}`);

    expect(lineasCulpables).toEqual([]);
  });

  test("el borrador nace del hook con historial, no de un useState suelto", () => {
    expect(source).toContain("useDraftHistory<MatrixPlan>");
  });

  test("los diálogos de borrado ya no prometen que es irreversible", () => {
    expect(source).not.toContain("no se puede deshacer");
  });
});
