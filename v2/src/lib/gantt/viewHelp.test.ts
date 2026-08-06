import { viewHelpFor } from "./viewHelp";

const MENU_VIEWS = [
  "gantt",
  "executive",
  "resources",
  "lob",
  "scurve",
  "bottlenecks",
  "unidadTipica",
  "calendario",
  "settings",
] as const;

// Vistas que salieron del menú de 14→9 pero siguen alcanzables por la paleta
// de comandos y por presets: también necesitan ayuda o el botón "Ayuda" no
// hace nada al pulsarlo.
const OFF_MENU_VIEWS = ["tracking", "taskSheet", "network", "matrix"] as const;

const ALL_REACHABLE_VIEWS = [...MENU_VIEWS, ...OFF_MENU_VIEWS];

describe("viewHelp: cada vista explica para qué sirve (E8)", () => {
  test("todas las vistas alcanzables (menú + fuera de menú) tienen ayuda no vacía", () => {
    for (const view of ALL_REACHABLE_VIEWS) {
      const help = viewHelpFor(view);
      expect(help).not.toBeNull();
      expect(help!.title.trim().length).toBeGreaterThan(0);
      expect(help!.purpose.trim().length).toBeGreaterThan(0);
      expect(help!.needs.trim().length).toBeGreaterThan(0);
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
