import { describe, expect, it } from 'vitest';
import { groupTaxonomyOptions } from './taxonomy-options';

describe('groupTaxonomyOptions', () => {
  it('lists each sector once and its skills once, sorted by name', () => {
    const grouped = groupTaxonomyOptions([
      { sectorId: 's2', sectorName: 'Health', skillId: 'k2', skillName: 'Surgery' },
      { sectorId: 's2', sectorName: 'Health', skillId: 'k1', skillName: 'General practice' },
      { sectorId: 's2', sectorName: 'Health', skillId: 'k1', skillName: 'General practice' },
      { sectorId: 's1', sectorName: 'Construction', skillId: 'k3', skillName: 'Carpentry' },
    ]);
    expect(grouped.sectors.map((s) => s.name)).toEqual(['Construction', 'Health']);
    expect(grouped.skillsBySector.s2.map((s) => s.name)).toEqual(['General practice', 'Surgery']);
  });

  it('skips rows with no sector or no skill', () => {
    const grouped = groupTaxonomyOptions([
      { sectorId: '', sectorName: 'Nameless', skillId: 'k', skillName: 'x' },
      { sectorId: 's', sectorName: 'Retail', skillId: '', skillName: '' },
    ]);
    expect(grouped.sectors).toEqual([{ id: 's', name: 'Retail' }]);
    expect(grouped.skillsBySector).toEqual({});
  });
});
