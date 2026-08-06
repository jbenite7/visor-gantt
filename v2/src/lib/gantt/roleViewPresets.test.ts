import { ROLE_VIEW_PRESETS, applyRoleViewPreset, findRoleViewPreset } from "./roleViewPresets";
import type { TaskColumnSettings } from "@/types/mppColumns";
import type { UISettings } from "@/types/ui";

describe("role view presets", () => {
  test("applies the executive preset without mutating the schedule", () => {
    const uiSettings: UISettings = {
      locale: "es",
      taskFilter: { text: "obra", type: "all" },
    };
    const taskColumnSettings: TaskColumnSettings = {
      visible: ["id", "name", "duration"],
      widths: { name: 280 },
      labelLocale: "es",
    };

    const result = applyRoleViewPreset(uiSettings, taskColumnSettings, "executive");

    expect(result.activeView).toBe("executive");
    expect(result.scale).toBe("month");
    expect(result.uiSettings).toEqual({
      locale: "es",
      roleViewPreset: "executive",
      taskFilter: { text: "", type: "critical" },
    });
    expect(result.taskColumnSettings).toEqual({
      visible: [
        "wbs",
        "name",
        "finish",
        "progress",
        "critical",
        "budgetedCost",
        "actualCost",
        "variance",
      ],
      widths: { name: 280 },
      labelLocale: "es",
    });
  });
});

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
