export type SeMatchingState = {
    answered: number;
    enabled: boolean;
};
export declare const SE_MATCHING_WORDS: {
    readonly title: "21 Questions buddies";
    readonly toggle: "Find me buddies who answer like me";
    readonly hint: "Off: you leave every other member's buddy network and your past answers stop counting. Your answers are kept. Turn it back on any time.";
    readonly failed: "Your buddy setting was not changed:";
    readonly optIn: "21 Questions finds your buddies: people who answered the way you did. Answering is how you opt in, and members who pick the same answer on three or more questions show up here as your buddies.";
    readonly reachOut: "Reaching out to a buddy is optional, and so is replying to one.";
    readonly optOut: "To stop finding buddies, turn off Find me buddies in Buddies. You can keep answering either way.";
    readonly off: "Finding buddies is off. Your answers are not used to find you buddies. Turn it back on in Buddies.";
};
export declare function seMatchingToggleShown(state: SeMatchingState | null): boolean;
export declare function seQuestionCardBody(answered: number, out: number, enabled: boolean, picked?: string | null): string;
