import { seApplyCardMarks, type SeTodayCard } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { readCardMarks } from './marks/repository';

// The member's own Done and Not for me marks (today_card_marks) applied to one Today read by the
// shared rule (seApplyCardMarks). A failed read shows every card unmarked rather than none, and is
// reported. Comment times are dropped either way: they are only for this step.
export async function applyMemberMarks(viewer: TodayViewer, cards: SeTodayCard[], dayStartIso: string): Promise<SeTodayCard[]> {
  try {
    const marks = await readCardMarks(viewer.userId, cards.map((card) => card.id));
    return seApplyCardMarks(cards, marks, dayStartIso);
  } catch (error) {
    reportError(error, { area: 'today', op: 'read_marks' });
    return seApplyCardMarks(cards, [], dayStartIso);
  }
}
