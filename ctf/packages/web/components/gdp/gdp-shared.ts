// Shared constants and types for the GDP web shell.
// Palette/layout derive from design/.../survivor-hub/GDP.tsx.

export const COLOR = "#06B6D4";
export const BG = "#0F1117";

export interface GdpSector {
  name: string;
  color?: string;
  value: string;
  members: number;
}

export interface GdpCountry {
  country: string;
  flag: string;
  gdp: string;
  members: number;
}

export interface GdpMetrics {
  currentValue?: string;
  delta?: string;
  target?: string;
  progress?: string;
  countries?: string;
  members?: string;
  memberStats?: { v: string; l: string; c?: string }[];
}

export interface GdpReport {
  sectors: GdpSector[];
  countries: GdpCountry[];
  metrics: GdpMetrics;
}

export type GdpTab = "dashboard" | "map";

// Matches the design's sidebar filter list (no "By Phase" — that term is banned
// project-wide and is not present in the design mockup).
export const SIDEBAR_FILTERS = ["Global Overview", "By Sector", "By Country", "Projections"];
