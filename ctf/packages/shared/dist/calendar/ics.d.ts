export type SeCalendarEvent = {
    uid: string;
    title: string;
    startIso: string;
    endIso: string;
    description?: string;
    url?: string;
};
export declare function seCalendarIcs(event: SeCalendarEvent, now?: Date): string;
export declare function seCalendarFileName(title: string): string;
