export type SeMatchingState = {
    answered: number;
    enabled: boolean;
};
export declare const SE_MATCHING_WORDS: {
    readonly title: "21 Questions matching";
    readonly toggle: "Match me with members who answer like me";
    readonly hint: "Off: you stop appearing in other members' matches and your past answers stop counting. Your answers are kept. Turn it back on any time.";
    readonly failed: "Matching was not changed:";
    readonly optIn: "Answering is how you opt in to matching. Members who pick the same answer on three or more questions show up here as like-minded matches.";
    readonly reachOut: "Reaching out to a match is optional, and so is replying to one.";
    readonly optOut: "To stop being matched, turn off matching in Matches. You can keep answering either way.";
    readonly off: "Matching is off. Your answers are not used to match you. Turn it back on in Matches.";
};
export declare function seMatchingToggleShown(state: SeMatchingState | null): boolean;
export declare function seQuestionCardBody(answered: number, out: number, enabled: boolean, picked?: string | null): string;
