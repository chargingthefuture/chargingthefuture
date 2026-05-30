// Shared constants, types, and helpers for the Skills Taxonomy web shell.
// Palette derives from design/.../survivor-hub/SkillsTaxonomy.tsx.
// Types mirror the nested hierarchy returned by GET /api/skills-taxonomy/hierarchy
// (lib/skills-taxonomy/types.ts: TaxonomyHierarchy*). The whole tree arrives in
// one request, so the browser derives sectors/titles/skills client-side.

import type {
  TaxonomyHierarchyJobTitle,
  TaxonomyHierarchySector,
  TaxonomyHierarchySkill,
} from "../../lib/skills-taxonomy/types";

export type StSector = TaxonomyHierarchySector;
export type StJobTitle = TaxonomyHierarchyJobTitle;
export type StSkill = TaxonomyHierarchySkill;

export const BRAND = "#8B5CF6";
export const BG = "#0F1117";
export const SURFACE = "#161B27";
export const BORDER = "#1E2A3A";
export const TEXT = "#F9FAFB";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Stable per-sector accent colors (the data model has no color column; the
// mockup assigns a fixed palette across the sector list).
const SECTOR_COLORS = ["#8B5CF6", "#EC4899", "#F59E0B", "#06B6D4", "#22C55E", "#EF4444", "#A78BFA", "#F97316"];

export function sectorColor(index: number): string {
  return SECTOR_COLORS[index % SECTOR_COLORS.length];
}

export function countLabel(count: number, singular: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : `${singular}s`}`;
}
