import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * La fecha de corte llega a todo el que la necesita.
 *
 * Es el dato que más silenciosamente se pierde de esta app. Se importa del
 * `.mpp`, se guarda, y basta que un eslabón de la cadena no la pase para que
 * media pantalla calcule contra **hoy** sin que nada parezca roto:
 *
 * - La curva S dibujaba contra el corte y su diagnóstico contra hoy, a la vez.
 * - El motor de MPP la aceptaba y recibía `undefined`, así que el BCWS salía
 *   sin calcular.
 * - Los vencidos de Last Planner caían al valor por defecto, que es hoy.
 *
 * Todos esos eran el mismo fallo: la prop no llegaba. Este guardián comprueba
 * que quien la declara la recibe de quien la monta, para que el próximo eslabón
 * que se olvide se vea aquí y no en un número equivocado delante del jefe de
 * obra.
 */
const RAIZ = "src/components";

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

describe("la fecha de corte no se pierde por el camino", () => {
  const componentes = ficherosTsx(RAIZ).map((f) => ({
    f,
    nombre: basename(f, ".tsx"),
    s: readFileSync(f, "utf8"),
  }));

  const laDeclaran = componentes.filter(({ s }) =>
    /statusDate\??:\s*(string|Date)/.test(s),
  );

  test("hay componentes que la usan: el guardián no mira al vacío", () => {
    expect(laDeclaran.length).toBeGreaterThanOrEqual(3);
    expect(laDeclaran.map((c) => c.nombre)).toContain("SCurveView");
  });

  test("todo el que la declara la recibe de quien lo monta", () => {
    const sinRecibir: string[] = [];

    for (const { nombre } of laDeclaran) {
      // Quién monta este componente.
      const padres = componentes.filter(
        ({ nombre: otro, s }) =>
          otro !== nombre && new RegExp(`<${nombre}\\b`).test(s),
      );
      // Sin padre dentro de `components` lo monta una página; de eso ya
      // responde `projectViewWiring`.
      if (padres.length === 0) continue;

      for (const padre of padres) {
        const bloque = padre.s.slice(padre.s.search(new RegExp(`<${nombre}\\b`)));
        const cierre = bloque.indexOf("/>");
        const props = bloque.slice(0, cierre > 0 ? cierre : 600);
        if (!/statusDate=\{/.test(props)) {
          sinRecibir.push(`${padre.nombre} → ${nombre}`);
        }
      }
    }

    expect(sinRecibir).toEqual([]);
  });
});
