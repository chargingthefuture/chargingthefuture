import { describe, expect, it } from 'vitest';
import { commonsSuggestionChips } from './commons-suggestions';

describe('commonsSuggestionChips', () => {
  it('gives a member not yet approved only the "I\'m new" chip', () => {
    expect(commonsSuggestionChips({ unlockFocus: true }).map((chip) => chip.id)).toEqual(['new-here']);
    expect(commonsSuggestionChips().length).toBeGreaterThan(2);
  });
});
