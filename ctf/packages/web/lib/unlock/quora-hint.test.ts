import { describe, expect, it } from 'vitest';
import { UNLOCK_QUORA_HINT_MAX_LENGTH, normalizeUnlockQuoraHint } from './quora-hint';

describe('normalizeUnlockQuoraHint', () => {
  it('keeps a plain name, which is the case the field exists for', () => {
    expect(normalizeUnlockQuoraHint('  Jane Doe  ')).toBe('Jane Doe');
  });

  it('keeps anything else a member can offer, without asking it to look like a URL', () => {
    expect(normalizeUnlockQuoraHint('jane@example.com')).toBe('jane@example.com');
    expect(normalizeUnlockQuoraHint('quora.com/profile/Jane-Doe')).toBe('quora.com/profile/Jane-Doe');
  });

  it('treats an empty or whitespace-only value as nothing given, so it never erases a stored hint', () => {
    expect(normalizeUnlockQuoraHint('')).toBeNull();
    expect(normalizeUnlockQuoraHint('   ')).toBeNull();
  });

  it('treats a missing or non-string value as nothing given', () => {
    expect(normalizeUnlockQuoraHint(undefined)).toBeNull();
    expect(normalizeUnlockQuoraHint(null)).toBeNull();
    expect(normalizeUnlockQuoraHint(42)).toBeNull();
    expect(normalizeUnlockQuoraHint({ quoraHint: 'Jane' })).toBeNull();
  });

  it('caps a long value so the field cannot post an essay into the admin panel', () => {
    const capped = normalizeUnlockQuoraHint('a'.repeat(UNLOCK_QUORA_HINT_MAX_LENGTH + 50));
    expect(capped).toHaveLength(UNLOCK_QUORA_HINT_MAX_LENGTH);
  });
});
