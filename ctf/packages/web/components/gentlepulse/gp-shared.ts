// Shared constants, types, and helpers for the GentlePulse web shell.
// Palette derives from design/.../survivor-hub/GentlePulse.tsx.

export const COLOR = "#14B8A6";
export const BG = "#0A0F0E";
export const RAIL_BG = "#060A09";
export const PANEL_BG = "#080D0C";
export const TEXT = "#E8EAF0";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

export type Tab = "sessions" | "playing" | "chat";

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
