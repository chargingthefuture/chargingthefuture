import type { SeTodayBroadcast, SeTodayCard } from './types';
export declare const SE_PRESENCE_WINDOW_MINUTES = 10;
export declare function sePresenceLine(count: number | null | undefined): string | null;
export declare const SE_TODAY_MOOD_TITLE = "How is today?";
export declare const SE_TODAY_MOODS: ReadonlyArray<{
    value: number;
    label: string;
    mouth: string;
}>;
export declare const SE_TODAY_MOOD_WORDS: {
    readonly saving: "Saving…";
    readonly saved: (label: string) => string;
    readonly failed: "The check-in was not saved.";
};
export declare function seIsMoodCard(card: Pick<SeTodayCard, 'source'>): boolean;
export declare function seClosingLines(cards: ReadonlyArray<Pick<SeTodayCard, 'kind' | 'mine'>>, storiesTomorrow: number | null | undefined): {
    title: string;
    note: string;
};
export declare function seBroadcastHostLine(broadcast: Pick<SeTodayBroadcast, 'host' | 'startedAtIso'>): string | null;
export declare const SE_BROADCAST_WORDS: {
    readonly label: "Broadcast";
    readonly watch: "Watch";
    readonly chat: "Chat";
    readonly roomQuiet: "Quiet during the broadcast";
};
