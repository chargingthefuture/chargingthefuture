import type { SeCardKind, SeTodayAction, SeTodayAuthor, SeTodayCard } from '@ctf/shared';

// Shared helpers for the Today sources: one card shape, and short text so a card stays a card.

export type TodayViewer = { userId: string; isAdmin: boolean };

export function clip(text: string | null | undefined, max = 180): string | null {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export function author(accountId: string | null | undefined, handle: string | null | undefined): SeTodayAuthor | null {
  if (!accountId) return null;
  return { accountId, handle: handle ? handle : `user-${accountId.slice(0, 8)}` };
}

export function action(kind: SeTodayAction['kind'], label: string, href: string): SeTodayAction {
  return { kind, label, href };
}

export function card(input: {
  source: string;
  sourceId: string;
  kind: SeCardKind;
  label: string;
  title: string;
  body?: string | null;
  author?: SeTodayAuthor | null;
  createdAtIso: string;
  href: string;
  actions?: SeTodayAction[];
}): SeTodayCard {
  return {
    id: `${input.source}:${input.sourceId}`,
    kind: input.kind,
    source: input.source,
    label: input.label,
    title: input.title,
    body: input.body ?? null,
    author: input.author ?? null,
    createdAtIso: input.createdAtIso,
    href: input.href,
    actions: input.actions ?? [action('open', 'Open', input.href)],
  };
}

// The start of today in UTC, for a card that belongs to the day rather than to a moment.
export function startOfTodayIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}
