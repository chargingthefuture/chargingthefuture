// The story a Today card's "Play its puzzle" asked for, held until the games screen opens on it,
// as the web's /games?story= does.

let pending: string | null = null;

export function setPendingStory(slug: string | null): void {
  pending = slug;
}

export function takePendingStory(): string | null {
  const slug = pending;
  pending = null;
  return slug;
}
