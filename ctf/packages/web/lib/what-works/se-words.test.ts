import { describe, expect, it } from 'vitest';
import { seWwHelpedCount, seWwPendingMeta } from '@ctf/shared';

describe('What Works 3.1 words', () => {
  it('counts the things that helped, one and many', () => {
    expect(seWwHelpedCount(0)).toBe('Nothing added yet');
    expect(seWwHelpedCount(1)).toBe('1 thing that helped');
    expect(seWwHelpedCount(4)).toBe('4 things that helped');
  });

  it('says what was attached and when nothing on the list looks like it', () => {
    expect(seWwPendingMeta('October 26, 2026 at 3:14 PM CDT', 1, true)).toBe('Sent October 26, 2026 at 3:14 PM CDT · 1 thing that helped attached');
    expect(seWwPendingMeta('October 26, 2026 at 11:02 AM CDT', 0, false)).toBe('Sent October 26, 2026 at 11:02 AM CDT · no close match');
    expect(seWwPendingMeta('today', 2, false)).toBe('Sent today · 2 things that helped attached · no close match');
  });
});
