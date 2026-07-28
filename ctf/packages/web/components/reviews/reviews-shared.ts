import type { Review } from '@/lib/reviews/reviews-data';

export type { Review };

// The single letter shown in a review's avatar circle (the author's first initial).
export function reviewInitial(author: string): string {
  const trimmed = author.trim();
  return trimmed ? trimmed[0].toUpperCase() : '•';
}

// A stable, pleasant accent color per review so avatars vary without a stored color.
// Picked from the app's plugin accent family; deterministic from the id so it never flickers.
const AVATAR_ACCENTS = ['#0EA5E9', '#22C55E', '#A855F7', '#F97316', '#EC4899', '#14B8A6', '#FACC15'];

export function reviewAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  }
  return AVATAR_ACCENTS[hash % AVATAR_ACCENTS.length];
}

// "public comment on Quora" — the link label under each quote.
export function reviewSourceLabel(source: Review['source']): string {
  return `public comment on ${source}`;
}
