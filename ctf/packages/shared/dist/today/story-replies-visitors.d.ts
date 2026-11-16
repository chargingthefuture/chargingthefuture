export declare const SE_STORY_REPLIES_VISITORS_VERSION = "2026-11-16";
export declare const SE_STORY_REPLIES_VISITORS_VERSIONS: readonly string[];
export declare const SE_STORY_REPLIES_VISITORS_WORDS: {
    readonly title: "Replies on members' stories";
    readonly toggle: "Visitors can read what I write on members' stories";
    readonly hint: "When this is on, people without an account can read what you write from now on in the conversation under a member's story, with your username. What you wrote before stays for members. Turn it off at any time and visitors stop seeing all of it at once.";
    readonly failed: "Not changed:";
};
export type SeStoryRepliesVisitorsState = {
    agreed: boolean;
};
