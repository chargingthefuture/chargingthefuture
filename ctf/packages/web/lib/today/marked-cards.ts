import type { SeMarkedCard } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { todaySources } from './build';
import { listMarkedCardIds } from './marks/repository';

// Me → Read and Hidden: the cards this member marked done, or Not for me, that are still around,
// newest mark first. Read from the same sources as Today; a card whose item has gone is left out.
// A source that fails is reported and skipped.
export async function readMarkedCards(viewer: TodayViewer, mark: 'done' | 'not_for_me', now = new Date()): Promise<SeMarkedCard[]> {
  const ids = await listMarkedCardIds(viewer.userId, mark);
  if (ids.length === 0) return [];
  const lists = await Promise.all(
    todaySources(viewer, now).map((source) =>
      source.read().catch((error: unknown) => {
        reportError(error, { area: 'today', op: `marked_source_${source.name}` });
        return [];
      }),
    ),
  );
  const byId = new Map(lists.flat().map((card) => [card.id, card]));
  return ids.flatMap((id) => {
    const card = byId.get(id);
    return card ? [{ id: card.id, kind: card.kind, label: card.label, title: card.title, href: card.href }] : [];
  });
}
