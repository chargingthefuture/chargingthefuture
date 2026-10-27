import type { SeCardKind } from '../design/se-theme';
import type { SeToday, SeTodayCard, SeTodayTalk } from './types';
export type SeTodayFilter = 'all' | 'asks' | 'offers' | 'stories' | 'matches';
export type SeTodayMarks = {
    read: string[];
    hidden: string[];
};
export declare const SE_TODAY_FILTERS: ReadonlyArray<{
    key: SeTodayFilter;
    label: string;
    kinds: SeCardKind[] | null;
}>;
export type SeTodayView = {
    cards: SeTodayCard[];
    doneLine: string | null;
    missingLine: string | null;
    caughtUpLine: string;
};
export declare function seTodayView(today: SeToday | null, marks: SeTodayMarks, filter: SeTodayFilter): SeTodayView;
export declare function seRoomPeopleLine(members: number, guests: number): string;
export declare function seTalkWhen(startIso: string, now?: Date): string;
export declare function seTalkLine(talk: SeTodayTalk | null, now?: Date): string | null;
