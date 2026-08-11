import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRECTORIO = "src/app/actions";

/**
 * Las acciones que pueden saltarse la cerradura, declaradas una a una.
 *
 * Declarar es el punto: una excepción con motivo escrito es una decisión; una
 * excepción silenciosa es el agujero del 2026-08-10 otra vez.
 */
const SIN_CERRADURA_A_PROPOSITO: { funcion: string; porque: string }[] = [
  {
    funcion: "createMatrixPlanFromTemplate",
    porque:
      "No toca la base: transforma una plantilla en memoria y devuelve el resultado.",
  },
];

const SENIALES_DE_CERRADURA = [
  "authorizeProjectAction",
  "tienePermiso",
  "getCurrentUser",
];

/** Las funciones exportadas de un fichero, con su cuerpo hasta la siguiente. */
function accionesDe(source: string): { nombre: string; cuerpo: string }[] {
  const partes = source.split(/export async function /).slice(1);
  return partes.map((parte) => ({
    nombre: parte.slice(0, parte.search(/[(<\s]/)),
    cuerpo: parte,
  }));
}

/**
 * Ninguna acción de servidor toca la base sin comprobar sesión y permiso.
 *
 * En vez de vigilar **una** regla concreta, vigila la propiedad de la que
 * depende todo: este proyecto no tiene `middleware.ts`, así que la protección
 * va página por página y acción por acción. Lo que se queda fuera de las dos
 * redes no lo nota nadie.
 *
 * **Este guardián habría cazado el agujero del 2026-08-10**: `loadProject`,
 * `saveProjectSnapshot`, `listProjectSnapshots` y `loadProjectSnapshot` no
 * comprobaban nada. No lo cazó ningún test porque ninguno miraba esa propiedad;
 * lo cazó una persona leyendo el código antes de construir encima. Un guardián
 * existe para que la próxima vez no dependa de eso.
 *
 * **Por qué no incluye `loadSharedProject`**: vive en `src/lib/share/`, no en
 * `src/app/actions/`, y su cerradura es el token, no la sesión. Si algún día se
 * moviera aquí, este guardián lo marcaría — y tendría razón en pedir que se
 * declare como excepción con su motivo.
 */
describe("Toda acción de servidor comprueba sesión y permiso", () => {
  const ficheros = readdirSync(DIRECTORIO).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );

  test("hay ficheros que revisar: el guardián no se quedó mirando al vacío", () => {
    expect(ficheros.length).toBeGreaterThan(0);
  });

  for (const fichero of ficheros) {
    const source = readFileSync(join(DIRECTORIO, fichero), "utf8");

    for (const { nombre, cuerpo } of accionesDe(source)) {
      if (SIN_CERRADURA_A_PROPOSITO.some((e) => e.funcion === nombre)) continue;

      test(`${fichero} · ${nombre} comprueba antes de tocar la base`, () => {
        const tocaLaBase = /client\.query|pool\.query/.test(cuerpo);
        if (!tocaLaBase) return;

        const tieneCerradura = SENIALES_DE_CERRADURA.some((senial) =>
          cuerpo.includes(senial),
        );

        expect(tieneCerradura).toBe(true);
      });
    }
  }
});
