export type UILocale = "es" | "en";
export type TaskFilterType = "all" | "critical" | "non-critical" | "milestones" | "summaries";
export type RoleViewPresetId = "planner" | "executive" | "field";
export type UIInteractionMode = "simple" | "advanced";

export interface TaskFilterSettings {
  text: string;
  type: TaskFilterType;
}

export interface UISettings {
  locale: UILocale;
  taskFilter?: TaskFilterSettings;
  roleViewPreset?: RoleViewPresetId;
  interactionMode?: UIInteractionMode;
}

export const DEFAULT_UI_SETTINGS: UISettings = {
  locale: "es",
  taskFilter: {
    text: "",
    type: "all",
  },
};
