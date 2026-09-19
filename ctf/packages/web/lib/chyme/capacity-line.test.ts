import { describe, expect, it } from 'vitest';
import { chymeCapacityAdvisory, chymeParticipantLine } from './capacity-line';

// The cap is named only once it matters: from 80% of it, and at it. Below that the line is the
// plain count, so a quiet room never reads as "1 of 50".

describe('chymeParticipantLine', () => {
  it('prints the plain count well under the cap', () => {
    expect(chymeParticipantLine(1, 50)).toBe('1 participant');
    expect(chymeParticipantLine(39, 50)).toBe('39 participants');
  });

  it('names the cap from 80% of it', () => {
    expect(chymeCapacityAdvisory(40, 50)).toBe('nearly_full');
    expect(chymeParticipantLine(40, 50)).toBe('40 of 50 participants · nearly full');
  });

  it('says full at the cap and beyond', () => {
    expect(chymeParticipantLine(50, 50)).toBe('50 of 50 participants · full');
    expect(chymeCapacityAdvisory(51, 50)).toBe('full');
  });

  it('never names a cap of zero', () => {
    expect(chymeParticipantLine(3, 0)).toBe('3 participants');
  });
});
