export declare const SE_MEMBER_STORY_CONSENT_VERSION = "2026-11-16.1";
export declare const SE_MEMBER_STORY_PUBLIC_VERSIONS: readonly string[];
export declare function seMemberStoryShownSignedOut(consentVersion: string | null | undefined): boolean;
export declare const SE_MEMBER_STORY_WORDS: {
    readonly label: (handle: string) => string;
    readonly open: "Bring your writing";
    readonly toggle: "Also show it as a story on Today";
    readonly consent: "Members and visitors without an account will see it on Today under your handle, a few pieces a day, after a person has read it. You can turn this off at any time, and withdrawing takes it off Today too.";
    readonly agree: "Agree to the words above";
    readonly agreeAgain: "You chose this under earlier words that kept it from visitors. Tick the box again to agree to the words above.";
    readonly waitsForUnlock: "It shows once your Unlock is approved.";
    readonly on: "Shown as a story on Today";
    readonly off: "Not shown on Today";
    readonly failed: "Could not change whether this shows on Today. Nothing was changed. Try again.";
};
