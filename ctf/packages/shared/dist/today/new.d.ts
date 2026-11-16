export declare const SE_NEW_SHEET_WORDS: {
    label: string;
    close: string;
    guidelines: string;
    guidelinesHref: string;
    heading: string;
    intro: string;
    kinds: string;
    architect: string;
};
export type SeNewKind = 'ask' | 'offer' | 'story' | 'talk' | 'architect';
export declare const SE_NEW_KINDS: ReadonlyArray<{
    key: Exclude<SeNewKind, 'architect'>;
    label: string;
}>;
export declare const SE_ASK_WORDS: {
    what: string;
    details: string;
    optional: string;
    hint: string;
    suggestions: string;
    submit: string;
    submitting: string;
    posted: string;
    failed: string;
    defaultTag: string;
};
export declare const SE_ASK_TASK_WORDS: {
    add: string;
    task: string;
    another: string;
    remove: string;
    none: string;
    note: string;
    posted: string;
    failed: string;
};
export declare const SE_ASK_MAX_TASKS = 30;
export declare const SE_ASK_MAX_TASK_LENGTH = 300;
export declare function seAskTasks(tasks: readonly string[]): string[];
export declare const SE_OFFER_WORDS: {
    intro: string;
};
export declare const SE_STORY_WORDS: {
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
export declare function seAskSuggestionParts(typed: string, text: string): {
    lead: string;
    rest: string;
};
export declare const SE_ARCHITECT_WORDS: {
    readonly title: "Ask the architect";
    readonly intro: "A question about the app, or about where to find help. A person reads every answer before you see it.";
    readonly question: "Your question";
    readonly submit: "Ask";
    readonly submitting: "Sending…";
    readonly failed: "The question was not sent.";
    readonly sent: "Sent. A person checks the answer first; it appears here and in Activity.";
    readonly yours: "Your questions";
    readonly pending: "Being checked";
    readonly loading: "Loading your questions…";
    readonly loadFailed: "Your questions could not be loaded.";
    readonly helpful: "Helpful";
    readonly notHelpful: "Not helpful";
    readonly rated: "Rating saved.";
    readonly rateFailed: "The rating was not saved.";
};
export declare const SE_ARCHITECT_MAX_QUESTION = 590;
export type SeArchitectItem = {
    questionTurnId: string;
    status: 'pending' | 'answered';
    question: string;
    answer: string | null;
    answerTurnId: string | null;
    currentUserRating: 'helpful' | 'not_helpful' | 'flagged' | null;
    linkedPlugins: {
        slug: string;
        name: string;
    }[];
    askedAtIso: string;
};
export declare function seArchitectMessage(question: string): string;
