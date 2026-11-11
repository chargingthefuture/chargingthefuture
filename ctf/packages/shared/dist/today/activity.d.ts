import type { SeCardKind, SeThemeTokens } from '../design/se-theme';
export type SeActivityItem = {
    id: string;
    notificationType: string;
    summary: string;
    linkPath: string | null;
    targetRef: string | null;
    answer: 'kept' | 'closed' | null;
    isRead: boolean;
    createdAtIso: string;
};
export declare const SE_ACTIVITY_WORDS: {
    loading: string;
    needs: string;
    today: string;
    earlier: string;
    empty: string;
    failed: string;
    tryAgain: string;
    end: string;
};
export declare const SE_RECURRING_INVITE_NOTICE = "recurring-activity.invited";
export declare const SE_PAIR_REQUEST_NOTICE = "today.card.pair_request";
export declare function seActivityPairRef(cardId: string, requesterId: string): string;
export type SeActivityButtonLook = 'primary' | 'raised' | 'quiet';
export type SeActivityButton = {
    label: string;
    busy: string;
    done: string;
    failed: string;
    look: SeActivityButtonLook;
    path: string | null;
    body: Record<string, string>;
};
export type SeActivityNeed = {
    item: SeActivityItem;
    partnerId: string | null;
    buttons: SeActivityButton[];
};
export declare function seActivityNeed(item: SeActivityItem): SeActivityNeed | null;
export declare function seActivityOutcome(item: SeActivityItem): string | null;
export type SeActivityView = {
    needs: SeActivityNeed[];
    today: SeActivityItem[];
    earlier: SeActivityItem[];
};
export declare function seActivityView(items: readonly SeActivityItem[], now?: Date): SeActivityView;
export declare function seActivityWhen(iso: string): string;
export type SeActivityIcon = 'reply' | 'check' | 'calendar' | 'star';
export declare const SE_ACTIVITY_ICON_PATHS: Record<SeActivityIcon, string>;
export declare const SE_ACTIVITY_ICON_KIND: Record<SeActivityIcon, SeCardKind>;
export declare function seActivityIcon(notificationType: string): SeActivityIcon;
export declare function seActivityTint(t: SeThemeTokens, icon: SeActivityIcon): string;
export declare function seAgo(iso: string, now?: Date): string;
