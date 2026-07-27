// Shared constants, types, and helpers for the GentlePulse web shell.
// Palette derives from design/.../survivor-hub/GentlePulse.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#6EE7B7";
export const BG = "#061711";
export const RAIL_BG = "#060A09";
export const PANEL_BG = "#080D0C";
export const TEXT = "#E8EAF0";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// GentlePulse ships its own green-tinted chrome surfaces — a darker page background (#0A0F0E),
// a deepest-chrome panel/header (#080D0C), a darker icon rail (#060A09), and a teal-tinted
// divider (rgba(20,184,166,0.1), i.e. the accent at 0.1). Those four values differ from the
// shared default surfaces, so the default branch overrides exactly those four token slots and
// leaves the rest of the shared default values (text tones, white-alpha inactive borders, input
// surface) untouched — so the default theme renders byte-for-byte as today. Comic uses the shared
// comic surfaces plus the GentlePulse comic-ink accent.
export type GentlePulseTokens = PluginShellTokens;

export function getGentlePulseTokens(theme: ThemeName): GentlePulseTokens {
  if (theme === "comic") {
    return getPluginShellTokens(getAppAccent("gentle-pulse", "comic"), theme);
  }
  return {
    ...getPluginShellTokens(COLOR, theme),
    BG,
    HEADER: PANEL_BG,
    RAIL: RAIL_BG,
    BORDER: "rgba(20,184,166,0.1)",
  };
}

export type Tab = "sessions" | "playing";

export interface Session {
  id: string;
  title: string;
  category?: string;
  duration?: string;
  level?: string;
  plays?: number;
  rating?: number;
  emoji?: string;
  description?: string;
}
