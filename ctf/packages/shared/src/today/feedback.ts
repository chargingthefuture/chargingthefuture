// A count of what members finish and pass on in Today, by the card's source and kind, never by who.
// Marking a card done (the timeline dot, only the change to done) or picking Not for me from its •••
// menu sends one of these to POST /api/today/feedback. The server adds one to a daily total for that
// source, kind and signal and stores nothing about the member.

import type { SeCardKind } from '../design/se-theme';
import type { SeTodayCard } from './types';

export type SeTodayFeedbackSignal = 'done' | 'not_for_me';

export type SeTodayFeedback = { source: string; kind: SeCardKind; signal: SeTodayFeedbackSignal };

export const SE_TODAY_FEEDBACK_SIGNALS: readonly SeTodayFeedbackSignal[] = ['done', 'not_for_me'];

export const SE_CARD_KINDS: readonly SeCardKind[] = ['ask', 'offer', 'story', 'match', 'mood', 'numbers', 'replay', 'game'];

// A source is the lower-case name before the colon in a card id (see seCardIdValid).
const SOURCE = /^[a-z][a-z0-9-]{0,39}$/;

export function seTodayFeedbackFor(card: Pick<SeTodayCard, 'source' | 'kind'>, signal: SeTodayFeedbackSignal): SeTodayFeedback {
  return { source: card.source, kind: card.kind, signal };
}

// The body the route accepts, or null when any field is missing or unknown.
export function seParseTodayFeedback(value: unknown): SeTodayFeedback | null {
  if (!value || typeof value !== 'object') return null;
  const { source, kind, signal } = value as Record<string, unknown>;
  if (typeof source !== 'string' || !SOURCE.test(source)) return null;
  if (!SE_CARD_KINDS.includes(kind as SeCardKind)) return null;
  if (!SE_TODAY_FEEDBACK_SIGNALS.includes(signal as SeTodayFeedbackSignal)) return null;
  return { source, kind: kind as SeCardKind, signal: signal as SeTodayFeedbackSignal };
}
