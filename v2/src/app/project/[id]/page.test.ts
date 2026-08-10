import { readFileSync } from "node:fs";
import { parseImportSummary } from "@/lib/import/importSummary";

/**
 * La costura entre la ruta de importación y la página del proyecto.
 *
 * La revisión en frío del 2026-08-08 encontró que el aviso de columnas
 * descartadas estaba muerto: la ruta mandaba `descartadas` en la URL y la
 * página no lo leía, así que `discardedColumns` llegaba siempre vacío. Las dos
 * piezas tenían test y las dos pasaban; lo que no tenía test era el empalme.
 */
describe("los parámetros que la importación manda por la URL se leen todos", () => {
  test("la página convierte los cuatro, no tres", () => {
    const query: Record<string, string> = {
      tareas: "240",
      dependencias: "212",
      recursos: "0",
      descartadas: "Texto27,Número14",
    };

    // Lo mismo que hace `page.tsx` al construir el resumen.
    const resumen = parseImportSummary({
      tareas: query.tareas,
      dependencias: query.dependencias,
      recursos: query.recursos,
      descartadas: query.descartadas,
    });

    expect(resumen).toEqual({
      tasks: 240,
      dependencies: 212,
      resources: 0,
      discardedColumns: ["Texto27", "Número14"],
    });
  });

  test("el código de la página nombra los cuatro parámetros", () => {
    // Un test de la costura, no del comportamiento: si alguien añade un
    // parámetro a la ruta y olvida leerlo aquí, el aviso vuelve a morir.
    const fuente = readFileSync("src/app/project/[id]/page.tsx", "utf8");

    for (const parametro of ["tareas", "dependencias", "recursos", "descartadas"]) {
      expect(fuente).toContain(`query.${parametro}`);
    }
  });

  test("y la ruta de importación manda esos mismos cuatro", () => {
    const fuente = readFileSync("src/app/api/import-mpp/route.ts", "utf8");

    for (const parametro of ["tareas", "dependencias", "recursos", "descartadas"]) {
      expect(fuente).toContain(`"${parametro}"`);
    }
  });
});
