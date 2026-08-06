import { ROLE_VIEW_PRESETS, findRoleViewPreset } from "./roleViewPresets";

describe("presets que absorben vistas del menú (C1)", () => {
  test("existe un preset de Seguimiento que abre la vista tracking", () => {
    const preset = findRoleViewPreset("tracking");
    expect(preset).toBeDefined();
    expect(preset!.view).toBe("tracking");
    expect(preset!.labelEs).toBe("Seguimiento");
  });

  test("existe un preset de Hoja de Tareas que abre la vista taskSheet", () => {
    const preset = findRoleViewPreset("taskSheet");
    expect(preset).toBeDefined();
    expect(preset!.view).toBe("taskSheet");
    expect(preset!.labelEs).toBe("Hoja de Tareas");
  });

  test("los presets nuevos no filtran tareas: mostrar todo es el punto de partida", () => {
    expect(findRoleViewPreset("tracking")!.taskFilter.type).toBe("all");
    expect(findRoleViewPreset("taskSheet")!.taskFilter.type).toBe("all");
  });

  test("cada preset describe para qué sirve, en español", () => {
    for (const preset of ROLE_VIEW_PRESETS) {
      expect(preset.descriptionEs.length).toBeGreaterThan(10);
    }
  });
});
