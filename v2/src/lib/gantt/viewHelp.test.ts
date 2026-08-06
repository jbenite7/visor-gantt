import { viewHelpFor } from "./viewHelp";

describe("viewHelp: cada vista explica para qué sirve (E8)", () => {
  test("las 9 vistas del menú tienen ayuda", () => {
    for (const view of [
      "gantt",
      "executive",
      "resources",
      "lob",
      "scurve",
      "bottlenecks",
      "unidadTipica",
      "calendario",
      "settings",
    ] as const) {
      expect(viewHelpFor(view)).not.toBeNull();
    }
  });

  test("la ayuda dice para qué sirve y qué necesita el cronograma", () => {
    const help = viewHelpFor("lob")!;
    expect(help.purpose.length).toBeGreaterThan(20);
    expect(help.needs.length).toBeGreaterThan(20);
  });

  test("está escrita en lenguaje de obra, sin jerga de infraestructura", () => {
    const help = viewHelpFor("lob")!;
    const texto = `${help.purpose} ${help.needs}`;
    expect(texto).not.toMatch(/base de datos|endpoint|API|\.env|backend/i);
  });

  test("una vista desconocida devuelve null en vez de romper", () => {
    expect(viewHelpFor("no-existe" as never)).toBeNull();
  });
});
