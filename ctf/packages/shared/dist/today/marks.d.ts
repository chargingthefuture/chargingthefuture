import type { SeTodayCard } from './types';
export type SeTodayMarks = {
    read: string[];
    hidden: string[];
    readOn?: Record<string, string>;
};
export declare function seMarksFromSaved(saved: unknown, now?: Date): SeTodayMarks;
export declare function seNewComments(marks: SeTodayMarks, card: SeTodayCard): number;
export declare function seNewCommentsLine(count: number): string | null;
export declare function seCardDone(marks: SeTodayMarks, card: SeTodayCard): boolean;
export declare function seDoneBefore(marks: SeTodayMarks, card: SeTodayCard, today: string): boolean;
export declare function seToggleDone(marks: SeTodayMarks, card: SeTodayCard, now?: Date): SeTodayMarks;
export declare function seHideCard(marks: SeTodayMarks, cardId: string): SeTodayMarks;
