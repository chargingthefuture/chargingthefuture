import { randomBytes } from 'crypto';

// A short, shareable, hard-to-guess event slug: an optional kebab-cased title stem + a random suffix.
// The random suffix keeps two same-titled (or untitled) events from colliding and makes the link
// non-enumerable. Lowercase alphanumerics only.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSuffix(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function kebabStem(title: string | null | undefined): string {
  if (!title) {
    return '';
  }
  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return stem;
}

export function generateEventSlug(title: string | null | undefined): string {
  const stem = kebabStem(title);
  const suffix = randomSuffix();
  return stem ? `${stem}-${suffix}` : `event-${suffix}`;
}
