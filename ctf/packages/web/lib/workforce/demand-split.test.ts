import { describe, expect, it } from 'vitest';
import { occupationWeight, splitDemandByWeight, UNWEIGHTED_OCCUPATION_WEIGHT } from './demand-split';

const unweighted = (ids: string[]) => ids.map((id) => ({ id, workforceShare: null }));

describe('splitDemandByWeight', () => {
  // The guarantee that lets this ship without moving a single live number: until somebody sets a
  // weight, every occupation is neutral and the result is the even split the model already did.
  it('reproduces the even split exactly when nothing is weighted', () => {
    const result = splitDemandByWeight(unweighted(['a', 'b', 'c', 'd']), 1_000);
    expect([...result.values()]).toEqual([250, 250, 250, 250]);
  });

  it('divides by relative weight, not percentages', () => {
    const result = splitDemandByWeight(
      [{ id: 'electrician', workforceShare: 3 }, { id: 'surveyor', workforceShare: 1 }],
      1_000,
    );
    expect(result.get('electrician')).toBe(750);
    expect(result.get('surveyor')).toBe(250);
  });

  // Weights arrive one occupation at a time through the change list, so a half-weighted sector is
  // the normal state for a long while, not an edge case.
  it('treats an unweighted sibling as neutral so a part-weighted sector still behaves', () => {
    const result = splitDemandByWeight(
      [{ id: 'weighted', workforceShare: 3 }, { id: 'unset', workforceShare: null }],
      800,
    );
    expect(result.get('weighted')).toBe(600);
    expect(result.get('unset')).toBe(200);
  });

  it('normalizes whatever the raw weights are, so they need not sum to anything', () => {
    const result = splitDemandByWeight(
      [{ id: 'a', workforceShare: 40 }, { id: 'b', workforceShare: 10 }],
      500,
    );
    expect(result.get('a')).toBe(400);
    expect(result.get('b')).toBe(100);
  });

  // An explicit 0 is a real statement — the model expects nobody in this occupation — and is
  // different from never having set a weight.
  it('honors an explicit zero without starving the rest of the sector', () => {
    const result = splitDemandByWeight(
      [{ id: 'none', workforceShare: 0 }, { id: 'rest', workforceShare: 2 }],
      600,
    );
    expect(result.get('none')).toBe(0);
    expect(result.get('rest')).toBe(600);
  });

  // The guard that keeps a sector from vanishing: all-zero weights would otherwise divide by zero.
  it('falls back to an even split rather than blanking a sector weighted entirely to zero', () => {
    const result = splitDemandByWeight(
      [{ id: 'a', workforceShare: 0 }, { id: 'b', workforceShare: 0 }],
      1_000,
    );
    expect([...result.values()]).toEqual([500, 500]);
  });

  it('returns nothing for a sector with no occupations instead of dividing by zero', () => {
    expect(splitDemandByWeight([], 1_000).size).toBe(0);
  });
});

describe('occupationWeight', () => {
  it('reads an unset weight as neutral rather than as zero', () => {
    expect(occupationWeight(null)).toBe(UNWEIGHTED_OCCUPATION_WEIGHT);
    expect(occupationWeight(Number.NaN)).toBe(UNWEIGHTED_OCCUPATION_WEIGHT);
  });

  it('clamps a negative weight to zero so it cannot subtract from its siblings', () => {
    expect(occupationWeight(-5)).toBe(0);
  });

  it('keeps a fractional weight, so a trade needing half as many is expressible', () => {
    expect(occupationWeight(0.5)).toBe(0.5);
  });
});
