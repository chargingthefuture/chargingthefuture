export declare const SE_TODAY_ASK_DAYS = 14;
export declare const SE_TODAY_STORY_DAYS = 7;
export type SeAskDue = 'none' | 'today' | 'week' | 'date';
export declare const SE_ASK_DUE_CHOICES: ReadonlyArray<{
    key: SeAskDue;
    label: string;
}>;
export declare const SE_CARD_LIFETIME_WORDS: {
    readonly byWhen: "By when?";
    readonly byWhenHint: "With no deadline, the ask stays on Today for 14 days, and you can keep it up longer.";
    readonly date: "The date";
    readonly dateMissing: "Pick the date, or choose another answer.";
    readonly yours: "You posted this";
    readonly close: "Close it";
    readonly done: "Done";
    readonly notDone: "Closed, not done";
    readonly closing: "Closing…";
    readonly closed: "Closed. It has left Today.";
    readonly closeFailed: "Could not close it.";
    readonly whoDidIt: "Who did it?";
    readonly back: "Back";
    readonly renew: "Keep it up for 14 more days";
    readonly renewing: "Keeping it up…";
    readonly renewed: "Kept up on Today for 14 more days.";
    readonly renewFailed: "Could not keep it up.";
    readonly askNotice: "Still need this? Keep it up for 14 more days";
    readonly offerNotice: "Still offering this? Keep it up for 14 more days";
};
export declare const SE_TODAY_RENEW_NOTICE = "today.renew";
export declare function seOnTodayUntil(iso: string): string;
export declare function seAskDueIso(choice: SeAskDue, date: string | null, now?: Date): string | null;
export declare function seRenewCardId(item: {
    notificationType: string;
    linkPath: string | null;
}): string | null;
export declare function seRenewLink(href: string, cardId: string): string;
