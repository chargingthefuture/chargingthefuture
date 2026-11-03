import { seTodayFeedbackFor, type SeTodayCard, type SeTodayFeedbackSignal } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

// Counts a Done or Not for me mark by the card's source and kind (POST /api/today/feedback), with
// nothing about who marked it. Sent and forgotten: the card has already changed on screen, and a
// send that fails is recorded for the developers and changes nothing the member sees. The Android
// copy of the web's send-feedback.ts.
export function sendTodayFeedback(card: Pick<SeTodayCard, 'source' | 'kind'>, signal: SeTodayFeedbackSignal): void {
  void authedFetch('/api/today/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(seTodayFeedbackFor(card, signal)),
  })
    .then((res) => {
      if (!res.ok) reportError(new Error(`The card mark was not counted (HTTP ${res.status}).`), { area: 'today', op: 'feedback_send', extra: { status: res.status, signal } });
    })
    .catch((error: unknown) => reportError(error, { area: 'today', op: 'feedback_send', extra: { signal } }));
}
