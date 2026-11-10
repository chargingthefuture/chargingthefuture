export type SeDailyGate = 'play' | 'sign-in' | 'closed' | 'unavailable';
export declare const SE_DAILY_GATE_WORDS: {
    readonly about: "One puzzle a day, the same for everyone, taking turns between the word of the day, the picture of the day and the word ladder. No timer, no streak, no ranking, and no way to fail.";
    readonly 'sign-in': {
        readonly title: "Sign in to play";
        readonly body: "Anyone can see what today's puzzle is. Playing it is for members.";
        readonly button: "Sign in";
    };
    readonly closed: {
        readonly title: "Playing is closed for this account";
        readonly body: "This account is restricted, so the puzzle cannot be played from it.";
        readonly button: null;
    };
    readonly unavailable: {
        readonly title: "Could not check whether you can play";
        readonly body: "Try again in a moment.";
        readonly button: null;
    };
};
export declare function seDailyGateFor(decision: {
    allowed: boolean;
    status?: number;
    reason?: string;
}): SeDailyGate;
