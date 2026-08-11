import { readFileSync } from "node:fs";

/**
 * La costura entre el proyecto cargado y la vista.
 *
 * Un dato nuevo de `ProjectData` puede guardarse bien y no llegar nunca a la
 * pantalla si nadie lo pasa por el camino. Ya pasó con el aviso de columnas
 * descartadas de la importación, que estaba muerto por una línea que faltaba
 * en `page.tsx`.
 *
 * **Reescrito el 2026-08-10.** Antes este guardián llevaba una lista de cinco
 * datos escrita a mano. Un campo que no estuviera en la lista le era invisible,
 * y así se le escapó `statusDate` —la fecha de corte del `.mpp`—: se importaba,
 * se guardaba, y no llegaba a la pantalla; peor, a la primera edición el
 * guardado la sobrescribía con `undefined` y desaparecía de la base.
 *
 * Ahora los campos se **derivan de la interfaz `ProjectData`**. Un campo nuevo
 * entra solo en la comprobación: o se cablea, o se declara aquí con su motivo.
 */
describe("todo dato del proyecto llega desde la página hasta el Gantt", () => {
  const page = readFileSync("src/app/project/[id]/page.tsx", "utf8");
  const view = readFileSync("src/app/project/[id]/ProjectView.tsx", "utf8");
  // `ProjectData` se mudó a su propio módulo el 2026-08-10: `project.ts` es
  // `"use server"` y no podía exportar las funciones de serialización que E51
  // necesita. La autocomprobación de abajo cazó la mudanza en el momento, que
  // es justo para lo que está.
  const actions = readFileSync(
    "src/lib/project/projectSerialization.ts",
    "utf8",
  );

  /**
   * Campos que a propósito no viajan a la pantalla, uno a uno y con su motivo.
   * Declarar es el punto: una excepción escrita es una decisión; una excepción
   * silenciosa es el fallo de `statusDate` otra vez.
   */
  const NO_VIAJAN: Record<string, string> = {
    id: "Viaja como `projectId`, con otro nombre.",
    name: "Viaja como `projectName`, con otro nombre.",
    planningAuditEvents:
      "Lo reconstruye el propio Gantt a partir de las ediciones de la sesión.",
  };

  /** Los campos declarados en `interface ProjectData { ... }`. */
  function camposDeProjectData(): string[] {
    const inicio = actions.indexOf("export interface ProjectData {");
    const cuerpo = actions.slice(inicio, actions.indexOf("\n}", inicio));

    return [
      ...new Set(
        [...cuerpo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]),
      ),
    ];
  }

  const CAMPOS = camposDeProjectData();
  const AVIAJAR = CAMPOS.filter((campo) => !(campo in NO_VIAJAN));

  test("la interfaz se lee de verdad: el guardián no mira al vacío", () => {
    // Si el `interface` se renombra o se mueve, esto avisa en vez de pasar
    // en verde comprobando una lista vacía.
    expect(CAMPOS.length).toBeGreaterThan(15);
    expect(CAMPOS).toContain("statusDate");
  });

  /**
   * Se sigue el **dato**, no el nombre de la prop.
   *
   * Vale que viaje con su nombre (`observations={...}`) o bajo otro
   * (`initialStatusDate={statusDate}`, que es como lo llama el Gantt).
   * Exigir que el nombre coincidiera obligaría a declarar como excepción cada
   * renombrado legítimo, y una excepción de más es justo por donde se cuela
   * el siguiente dato perdido.
   */
  function viaja(dato: string, source: string): boolean {
    return (
      new RegExp(`${dato}=\\{`).test(source) ||
      new RegExp(`=\\{\\s*${dato}[\\s?.}]`).test(source)
    );
  }

  test("la página los pasa a ProjectView", () => {
    const olvidados = AVIAJAR.filter((dato) => !viaja(dato, page));

    expect(olvidados).toEqual([]);
  });

  test("ProjectView los pasa al Gantt", () => {
    const olvidados = AVIAJAR.filter((dato) => !viaja(dato, view));

    expect(olvidados).toEqual([]);
  });
});
