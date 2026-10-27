export declare const SE_ASK_WORDS: {
    title: string;
    intro: string;
    what: string;
    details: string;
    hint: string;
    suggestions: string;
    submit: string;
    submitting: string;
    posted: string;
    failed: string;
    defaultTag: string;
};
export declare const SE_OFFER_WORDS: {
    title: string;
    intro: string;
};
export declare const SE_STORY_WORDS: {
    title: string;
    intro: string;
    open: string;
    href: string;
};
export declare const SE_OFFER_CHOICES: ReadonlyArray<{
    key: string;
    label: string;
    text: string;
    href: string;
}>;
export declare const SE_HOLIDAY_ASKS: ReadonlyArray<{
    group: string;
    asks: readonly string[];
}>;
export type SeAskSuggestion = {
    text: string;
    group: string;
};
export declare function seAskSuggestions(typed: string, limit?: number): SeAskSuggestion[];
