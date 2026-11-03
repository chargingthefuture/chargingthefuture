import { seCardIdValid } from '@ctf/shared';

// Next may hand the segment over still percent-encoded. A card id always has a colon right after
// its lower-case source name, so an encoded one shows `%3A` there instead, and is decoded once.
export function readCardId(raw: string): string | null {
  let value = raw;
  if (/^[a-z][a-z0-9-]{0,39}%3A/i.test(raw)) {
    try {
      value = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return seCardIdValid(value) ? value : null;
}
