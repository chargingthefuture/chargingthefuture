import type { SocketRelayRequest } from './api';

// Mirrors the web shell's tag rules (sr-shared.ts): tags are free text, posts carry
// up to MAX_TAGS_PER_POST of them, and filter chips are derived from the tags in use.
export const MAX_TAGS_PER_POST = 3;
// Mirrors the server's SOCKET_RELAY_MAX_TAG_LENGTH so a too-long tag is caught in the form
// instead of bouncing off the server as an invalid payload.
export const MAX_TAG_LENGTH = 64;
const MAX_FILTER_CHIPS = 10;

// Legacy rows predate the tags field; fall back to the single category.
export function requestTags(r: Pick<SocketRelayRequest, 'category' | 'tags'>): string[] {
  if (r.tags && r.tags.length > 0) return r.tags;
  return r.category.trim() ? [r.category.trim()] : [];
}

// Filter chips: tags actually in use, most-used first, capped so the row stays short.
export function deriveTagChips(requests: SocketRelayRequest[], selected: string): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of requests) {
    for (const tag of requestTags(r)) {
      const label = tag.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label, count: 1 });
    }
  }
  const tags = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_FILTER_CHIPS)
    .map((e) => e.label);
  if (selected !== 'All' && !tags.some((t) => t.toLowerCase() === selected.toLowerCase())) {
    tags.push(selected);
  }
  return ['All', ...tags];
}

// Suggestions while typing a tag: known tags matching the prefix, minus ones already added.
export function suggestTags(
  requests: SocketRelayRequest[],
  prefix: string,
  exclude: string[],
): string[] {
  const q = prefix.trim().toLowerCase();
  const excluded = new Set(exclude.map((t) => t.toLowerCase()));
  return deriveTagChips(requests, 'All')
    .slice(1)
    .filter((t) => !excluded.has(t.toLowerCase()) && (q === '' || t.toLowerCase().startsWith(q)))
    .slice(0, 6);
}
