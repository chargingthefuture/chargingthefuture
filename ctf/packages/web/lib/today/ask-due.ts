import { reportError } from 'lib/observability/report';
import { readDueIso } from './lifetime';
import { setDue } from './windows';

// Keep the deadline an ask was posted with (+ New, "By when?"), when the poster chose one. Best-effort:
// the ask is already posted, and if this write fails it stays on Today for the usual 14 days.
export async function saveAskDue(cardId: string, ownerUserId: string, value: unknown, now = new Date()): Promise<void> {
  const dueIso = readDueIso(value, now);
  if (!dueIso) return;
  try {
    await setDue(cardId, ownerUserId, dueIso);
  } catch (error) {
    reportError(error, { area: 'today', op: 'save_ask_due' });
  }
}
