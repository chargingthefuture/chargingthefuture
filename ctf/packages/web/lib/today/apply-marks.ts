import { seApplyCardMarks, seCanSave, type SeTodayCard } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { readCardMarks } from './marks/repository';
import { readSavedIds } from './saves/repository';

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

// Which stories and replays the member saved for later (today_card_saves), so Save shows its state.
// A failed read shows them unsaved and is reported; saving again does no harm.
export async function applyMemberSaves(viewer: TodayViewer, cards: SeTodayCard[]): Promise<SeTodayCard[]> {
  const savable = cards.filter(seCanSave).map((card) => card.id);
  if (savable.length === 0) return cards;
  try {
    const saved = await readSavedIds(viewer.userId, savable);
    return cards.map((card) => (seCanSave(card) ? { ...card, saved: saved.has(card.id) } : card));
  } catch (error) {
    reportError(error, { area: 'today', op: 'read_saves' });
    return cards;
  }
}
