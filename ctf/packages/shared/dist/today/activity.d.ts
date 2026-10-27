export type SeActivityItem = {
    id: string;
    notificationType: string;
    summary: string;
    linkPath: string | null;
    isRead: boolean;
    createdAtIso: string;
};
export declare const SE_ACTIVITY_WORDS: {
    loading: string;
    answer: string;
    happened: string;
    isNew: string;
    empty: string;
    failed: string;
    tryAgain: string;
    allRead: string;
};
export declare function seActivityView(items: readonly SeActivityItem[]): {
    answer: SeActivityItem[];
    happened: SeActivityItem[];
};
export declare function seAgo(iso: string, now?: Date): string;
