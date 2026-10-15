// The decorative avatar on each invite card (owner decision, 2026-10-15): letters from the person's
// name on a gradient picked from a seed, so the same person gets the same avatar on every visit. The
// seed is the Quora handle where the card carries one, and the name where it does not (the blurred
// cards a signed-out visitor sees carry the name and opening words only). Nothing is fetched; it is
// drawn from the name alone and hidden from screen readers, which read the name in text beside it.

export type InviteAvatarGradient = { from: string; to: string; angle: number };

// Gradients already in the app: the Skills Economy mark's burgundy (components/shared/se-mark.tsx) and
// the violet, sky and green of the community shell (community-shell.module.css), plus one pairing
// the burgundy with the violet. All dark enough at one end for white letters.
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#D8687F', '#97304A'],
  ['#7C3AED', '#0EA5E9'],
  ['#7C3AED', '#6D28D9'],
  ['#10B981', '#0EA5E9'],
  ['#97304A', '#6D28D9'],
];

const ANGLES = [135, 160, 200] as const;

/** FNV-1a over the seed's UTF-16 code units: small, fast and the same on server and browser. */
export function hashInviteSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function inviteAvatarGradient(seed: string): InviteAvatarGradient {
  const hash = hashInviteSeed(seed.trim().toLowerCase());
  const [from, to] = PALETTE[hash % PALETTE.length];
  const angle = ANGLES[Math.floor(hash / PALETTE.length) % ANGLES.length];
  return { from, to, angle };
}

/**
 * Up to two letters for the avatar: the first character of the first and last words ("Pam Dawson" →
 * "PD"), or the first character alone for a one-word name ("00" → "0"). A word that is only
 * punctuation is skipped, so "T. Tipton" gives "TT". Characters are read as full code points, so a name that
 * starts with an emoji or an accented letter keeps it intact.
 */
export function inviteInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => Array.from(word).find((char) => /[\p{L}\p{N}\p{So}]/u.test(char)))
    .filter((char): char is string => Boolean(char));
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.join('').toLocaleUpperCase('en-US');
}
