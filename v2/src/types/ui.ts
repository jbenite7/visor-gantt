export type UILocale = "es" | "en";

export interface UISettings {
  locale: UILocale;
}

export const DEFAULT_UI_SETTINGS: UISettings = {
  locale: "es",
};
