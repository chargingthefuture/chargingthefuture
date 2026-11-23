// Theme tokens for the Sign-in record section of the Adoption screen, kept from the Weekly
// Performance shell it used to sit under.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const BRAND = "#6366F1";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#D5D9E2";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Theme-aware chrome tokens for the Weekly Performance shell. The shell paints a few neutral
// white-alpha button surfaces (the back button and the export button use rgba(255,255,255,0.05),
// which is not in the shared token set), so BTN_BG carries that one extra default value. The
// default theme returns the shipped values so it renders identically when the comic toggle is off;
// comic uses the shared comic surfaces plus the Weekly Performance comic-ink accent.
export type WeeklyPerformanceTokens = PluginShellTokens & {
  BTN_BG: string; // neutral control surface (default rgba(255,255,255,0.05))
};

export function getWeeklyPerformanceTokens(theme: ThemeName): WeeklyPerformanceTokens {
  if (theme === "comic") {
    const accent = getAppAccent("weekly-performance", "comic");
    return {
      ...getPluginShellTokens(accent, theme),
      BTN_BG: "#141414", // comic-surface
    };
  }
  return {
    ...getPluginShellTokens(BRAND, theme),
    BTN_BG: "rgba(255,255,255,0.05)",
  };
}
