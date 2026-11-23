export type SeUnlockStage = 'send' | 'waiting' | 'approved' | 'another_look';
export type SeUnlockStatusInput = {
    hasSubmission: boolean;
    reviewStatus: string | null;
};
export declare function seUnlockStage(status: SeUnlockStatusInput): SeUnlockStage;
export declare function seUnlockScreenReady(status: SeUnlockStatusInput, standing: {
    approved: boolean;
    form: boolean;
} | null): {
    stage: SeUnlockStage;
    helpAsked: boolean;
};
export declare function seUnlockSendCard(standing: {
    dayLabel: string;
    progress: number;
    paused: boolean;
    form: boolean;
    title: string;
    text: string;
} | null): {
    pick: boolean;
    dayLabel: string;
    progressPercent: number;
    title: string;
    text: string | null;
};
export type SeRemovedAccountsBody = {
    ok?: boolean;
    removedAccounts?: {
        handle: string;
    }[];
    message?: string;
} | null;
export declare function seRemovedAccounts(answered: boolean, body: SeRemovedAccountsBody): {
    handles: string[];
    readError: string | null;
};
export declare const SE_UNLOCK_SCREEN_QUERY = "unlock";
export type SeUnlockFocus = 'top' | 'why' | 'help';
export declare function seUnlockFocusFromQuery(value: string | null): SeUnlockFocus | null;
export declare function seUnlockFocusQuery(focus: SeUnlockFocus): string;
export declare const SE_UNLOCK_SCREEN_WORDS: {
    readonly helpTitle: "Can't find it?";
    readonly helpText: "You do not have to work it out alone. Asking for help stops the count, and a person uses what you write here to look you up and can approve you by hand.";
    readonly showSteps: "Show me where to find it";
    readonly hideSteps: "Hide the steps";
    readonly hintLabel: "Anything that helps me find you on Quora (optional)";
    readonly hintPlaceholder: "The name on your Quora account, or a link to anything you posted";
    readonly hintNote: "It does not have to be a link. A name or an email is enough.";
    readonly ask: "Ask for help finding it";
    readonly asking: "Asking…";
    readonly asked: "Sent. A person will use it to look you up.";
    readonly askFailed: "Could not send that just now. Try again.";
    readonly whyTitle: "Why this step";
    readonly why: readonly [{
        readonly title: "Real-person proof";
        readonly text: "Quora activity shows you're a real person with history online.";
    }, {
        readonly title: "Reduces infiltration";
        readonly text: "Makes it harder for traffickers to create fake accounts.";
    }, {
        readonly title: "Reviewed by a person";
        readonly text: "A human reviews every address. Nothing is turned down by a machine.";
    }];
    readonly opensTitle: "What opens once you are approved";
    readonly opens: readonly ["People, with names, skills and contact", "Your credits, to send and receive", "Speaking in rooms and booking a talk", "Posting and answering after day 14"];
    readonly banTitle: "What gets an account banned";
    readonly read: "Read";
    readonly hide: "Hide";
    readonly ban: readonly ["Signing up to harass people here gets the account banned. That includes the address it is signed up with: an address chosen to mock somebody is the harassment, not a preamble to it.", "Running a second account when you already have one gets the second one banned. Your first is untouched.", "Not finishing this step is not one of them. An account that never sends a profile address stays where it is, with the access that carries, for as long as it takes. Nobody is removed for being slow, for not finding their profile address, or for asking for help instead.", "A ban closes the account rather than this app alone, so anything else you sign into with it closes too. It is not a deletion and it can be lifted."];
    readonly censusLead: "Add it to the";
    readonly census: "Quora account removals survey";
    readonly censusTail: ".";
    readonly knowledgeLead: "Or bring your Quora writing into the";
    readonly knowledge: "Knowledge Library";
    readonly knowledgeTail: " with its profile address.";
    readonly eitherUnlocks: "Either option unlocks your account.";
    readonly censusHref: "/survey/quora-account-deletions";
    readonly knowledgeHref: "/knowledge";
    readonly back: "Back";
    readonly title: "Unlock";
    readonly lead: "One check that you are a real person. Send your Quora profile address and the System Architect looks at it by hand, usually within a day.";
    readonly loading: "Reading where you stand…";
    readonly loadFailed: "Could not read where you stand with Unlock.";
    readonly tryAgain: "Try again";
    readonly sendTitle: "Add your Quora profile address";
    readonly label: "Quora profile address";
    readonly publicNote: "Your Quora profile has to be public for the check.";
    readonly send: "Send";
    readonly sending: "Sending…";
    readonly sendFailed: "That did not go through. Try again.";
    readonly helpAsked: "You asked for help finding it. A person will look you up, and you can still send the address here.";
    readonly waitingTitle: "Sent. Waiting for approval.";
    readonly waitingText: "The System Architect approves each, usually within a day. Everything stays open while you wait.";
    readonly approvedTitle: "Approved";
    readonly approvedText: "Your profile has been reviewed. Everything in the app is open to you now.";
    readonly approvedCredits: "Your ServiceCredits are sent on their own and arrive within 24 hours, if not sooner.";
    readonly backToToday: "Back to Today";
    readonly anotherLookTitle: "Needs another look";
    readonly anotherLookText: "This address was not approved. Send the address of a public Quora profile, the one with /profile/ in it.";
    readonly resend: "Send a new address";
    readonly removedTitle: "Quora removed your account?";
    readonly removedLoading: "Reading the accounts you reported…";
    readonly removedReadFailed: "Your reported accounts could not be read";
    readonly finishWith: (handle: string) => string;
    readonly finishFailed: "Unlock could not be started from that account.";
};
