import { readFileSync } from "node:fs";

/**
 * La costura entre el proyecto cargado y la vista.
 *
 * Un dato nuevo de `ProjectData` puede guardarse bien y no llegar nunca a la
 * pantalla si nadie lo pasa por el camino. Ya pasó con el aviso de columnas
 * descartadas de la importación, que estaba muerto por una línea que faltaba
 * en `page.tsx`.
 */
describe("todo dato del proyecto llega desde la página hasta el Gantt", () => {
  const page = readFileSync("src/app/project/[id]/page.tsx", "utf8");
  const view = readFileSync("src/app/project/[id]/ProjectView.tsx", "utf8");

  const DATOS = [
    "matrixPlan",
    "observations",
    "detectionDictionary",
    "baselines",
    "budgetItems",
  ];

  test("la página los pasa a ProjectView", () => {
    // `baselines` viaja transformado —sus fechas se serializan— así que se
    // acepta cualquier expresión que lo mencione como prop.
    const olvidados = DATOS.filter(
      (dato) =>
        !page.includes(`${dato}={project.${dato}`) &&
        !new RegExp(`${dato}=\\{`).test(page),
    );

    expect(olvidados).toEqual([]);
  });

  test("ProjectView los pasa al Gantt", () => {
    const olvidados = DATOS.filter(
      (dato) => !new RegExp(`${dato}=\\{`).test(view),
    );

    expect(olvidados).toEqual([]);
  });
});
