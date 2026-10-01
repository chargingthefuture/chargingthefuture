// Sectors and skills a mission goal can name, grouped from the flattened skills taxonomy for the
// admin mission form's dropdowns. Pure, so it is tested on its own; the fetch lives in
// components/skills-hunt/sha-taxonomy-options.ts.
export type TaxonomyOption = { id: string; name: string };

export type TaxonomyOptions =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sectors: TaxonomyOption[]; skillsBySector: Record<string, TaxonomyOption[]> };

export type TaxonomyFlattenedOptionRow = { sectorId: string; sectorName: string; skillId: string; skillName: string };

const byName = (a: TaxonomyOption, b: TaxonomyOption) => a.name.localeCompare(b.name);

export function groupTaxonomyOptions(rows: TaxonomyFlattenedOptionRow[]): Extract<TaxonomyOptions, { status: "ready" }> {
  const sectors = new Map<string, TaxonomyOption>();
  const skills = new Map<string, Map<string, TaxonomyOption>>();
  for (const row of rows) {
    if (!row.sectorId || !row.sectorName?.trim()) continue;
    sectors.set(row.sectorId, { id: row.sectorId, name: row.sectorName.trim() });
    if (!row.skillId || !row.skillName?.trim()) continue;
    const inSector = skills.get(row.sectorId) ?? new Map<string, TaxonomyOption>();
    inSector.set(row.skillId, { id: row.skillId, name: row.skillName.trim() });
    skills.set(row.sectorId, inSector);
  }
  const skillsBySector: Record<string, TaxonomyOption[]> = {};
  for (const [sectorId, inSector] of skills) skillsBySector[sectorId] = [...inSector.values()].sort(byName);
  return { status: "ready", sectors: [...sectors.values()].sort(byName), skillsBySector };
}
