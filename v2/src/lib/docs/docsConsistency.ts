import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Los documentos leídos como datos, no como prosa.
 *
 * La auditoría del 2026-08-08 encontró filas marcadas `open` en `DESIGN.md`
 * cuyo experimento llevaba días `shipped`. Quien lea el documento suelto
 * concluye que hay deuda que no existe, y la siguiente auditoría arranca con
 * datos equivocados. La única forma de que no vuelva a pasar es que la
 * contradicción rompa la suite.
 */
export const REPO_DOCS_DIR = path.resolve(__dirname, "../../../../docs");

export function readDoc(
  name: "EXPERIMENTS.md" | "DESIGN.md" | "PRODUCT.md",
): string {
  return readFileSync(path.join(REPO_DOCS_DIR, name), "utf8");
}

export interface ShippedExperiment {
  id: string;
  /** Hallazgos de DESIGN.md que el experimento cierra. */
  findings: number[];
  status: string;
}

export function shippedExperiments(
  experimentsDoc: string,
): ShippedExperiment[] {
  const result: ShippedExperiment[] = [];

  for (const line of experimentsDoc.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    // | (vacío) | ID | Cambio | Origen | ... | Estado | (vacío)
    const id = cells[1];
    if (!/^E\d+$/.test(id ?? "")) continue;

    const status = cells[cells.length - 2] ?? "";
    if (!status.includes("shipped")) continue;

    const findings = [...(cells[3] ?? "").matchAll(/#(\d+)/g)].map((match) =>
      Number(match[1]),
    );
    result.push({ id, findings, status });
  }

  return result;
}

export function designFindingStatus(
  designDoc: string,
  finding: number,
): string | null {
  for (const line of designDoc.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells[1] !== String(finding)) continue;

    const status = cells[cells.length - 2] ?? "";
    // «open (E4)» y «open» son lo mismo para esto; «**done**» y «parcial» no.
    return status.startsWith("open") ? "open" : status;
  }
  return null;
}
