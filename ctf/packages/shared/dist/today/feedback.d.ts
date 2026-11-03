import type { SeCardKind } from '../design/se-theme';
import type { SeTodayCard } from './types';
export type SeTodayFeedbackSignal = 'done' | 'not_for_me';
export type SeTodayFeedback = {
    source: string;
    kind: SeCardKind;
    signal: SeTodayFeedbackSignal;
};
export declare const SE_TODAY_FEEDBACK_SIGNALS: readonly SeTodayFeedbackSignal[];
export declare const SE_CARD_KINDS: readonly SeCardKind[];
export declare function seTodayFeedbackFor(card: Pick<SeTodayCard, 'source' | 'kind'>, signal: SeTodayFeedbackSignal): SeTodayFeedback;
export declare function seParseTodayFeedback(value: unknown): SeTodayFeedback | null;
