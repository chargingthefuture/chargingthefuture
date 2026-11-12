export type SeTodayDay = {
    day: string;
    startIso: string;
};
export declare function seNextDay(day: string): string;
export declare function seReadMemberDay(value: unknown, now?: Date): string | null;
export declare function seReadMemberDayStart(value: unknown, now?: Date): string | null;
export declare function seReadTodayDay(input: {
    day?: unknown;
    dayStart?: unknown;
}, now?: Date): SeTodayDay;
export declare function seTodayDayQuery(now?: Date): string;
