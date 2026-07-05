import { applyRoleViewPreset } from "./roleViewPresets";
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
