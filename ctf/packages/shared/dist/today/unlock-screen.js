// The Unlock screen inside the 3.1 frame, shared by web and Android. It does what the 3.0 Unlock page
// does for a member, in the 3.1 design: send the Quora profile address, the two other ways to finish,
// help finding the address, where the member stands, and why the step exists. It reads and writes
// through the same routes as the 3.0 page (`/api/unlock/*`, and the removed-account route of the Quora
// census). The census itself stays on its 3.0 page (owner decision, 2026-11-16), and so does the
// Knowledge Library, which 3.1 has no screen for yet.
export function seUnlockStage(status) {
    if (status.reviewStatus === 'approved')
        return 'approved';
    if (!status.hasSubmission)
        return 'send';
    if (status.reviewStatus === 'rejected' || status.reviewStatus === 'spam' || status.reviewStatus === 'duplicate')
        return 'another_look';
    return 'waiting';
}
// The screen once both reads are in: the stage, and whether the member asked for help finding the
// address (the count stopped with nothing sent). The standing is null when its read failed.
export function seUnlockScreenReady(status, standing) {
    const stage = seUnlockStage(status);
    return { stage, helpAsked: stage === 'send' && standing !== null && !standing.approved && !standing.form };
}
// The card that asks for the address: the banner's own card while the app is open (pick-colored, the
// day count and its words), the card color once posting is paused, and a plain title when the
// standing could not be read or the count has stopped.
export function seUnlockSendCard(standing) {
    if (!standing)
        return { pick: true, dayLabel: '', progressPercent: 0, title: SE_UNLOCK_SCREEN_WORDS.sendTitle, text: null };
    return {
        pick: !standing.paused,
        dayLabel: standing.dayLabel,
        progressPercent: Math.round(standing.progress * 100),
        title: standing.form ? standing.title : SE_UNLOCK_SCREEN_WORDS.sendTitle,
        text: standing.form ? standing.text : null,
    };
}
export function seRemovedAccounts(answered, body) {
    const handles = (body?.removedAccounts ?? []).map((account) => account.handle);
    if (answered && body?.ok)
        return { handles, readError: null };
    return { handles, readError: `${SE_UNLOCK_SCREEN_WORDS.removedReadFailed}: ${body?.message ?? 'the server did not answer'}.` };
}
// The screen's address on the web, so the back button and a shared link land on it. Inside 3.1.
export const SE_UNLOCK_SCREEN_QUERY = 'unlock';
export const SE_UNLOCK_SCREEN_WORDS = {
    back: 'Back',
    title: 'Unlock',
    lead: 'One check that you are a real person. Send your Quora profile address and the System Architect looks at it by hand, usually within a day.',
    loading: 'Reading where you stand…',
    loadFailed: 'Could not read where you stand with Unlock.',
    tryAgain: 'Try again',
    // Sending the address.
    sendTitle: 'Add your Quora profile address',
    label: 'Quora profile address',
    publicNote: 'Your Quora profile has to be public for the check.',
    send: 'Send',
    sending: 'Sending…',
    sendFailed: 'That did not go through. Try again.',
    helpAsked: 'You asked for help finding it. A person will look you up, and you can still send the address here.',
    // Where the member stands.
    waitingTitle: 'Sent. Waiting for approval.',
    waitingText: 'The System Architect approves each, usually within a day. Everything stays open while you wait.',
    approvedTitle: 'Approved',
    approvedText: 'Your profile has been reviewed. Everything in the app is open to you now.',
    approvedCredits: 'Your ServiceCredits are sent on their own and arrive within 24 hours, if not sooner.',
    backToToday: 'Back to Today',
    anotherLookTitle: 'Needs another look',
    anotherLookText: 'This address was not approved. Send the address of a public Quora profile, the one with /profile/ in it.',
    resend: 'Send a new address',
    // The two other ways to finish.
    removedTitle: 'Quora removed your account?',
    removedText: 'Either of these finishes Unlock too.',
    removedLoading: 'Reading the accounts you reported…',
    removedReadFailed: 'Your reported accounts could not be read',
    finishWith: (handle) => `Finish with ${handle}`,
    finishFailed: 'Unlock could not be started from that account.',
    censusLead: 'Add it to the',
    census: 'Quora account removals survey',
    censusTail: ', then come back here.',
    knowledgeLead: 'Or bring your Quora writing into the',
    knowledge: 'Knowledge Library',
    knowledgeTail: ' with its profile address.',
    censusHref: '/survey/quora-account-deletions',
    knowledgeHref: '/knowledge',
    // Help finding the address.
    helpTitle: "Can't find it?",
    helpText: 'You do not have to work it out alone. Asking for help stops the count, and a person uses what you write here to look you up and can approve you by hand.',
    showSteps: 'Show me where to find it',
    hideSteps: 'Hide the steps',
    hintLabel: 'Anything that helps me find you on Quora (optional)',
    hintPlaceholder: 'The name on your Quora account, or a link to anything you posted',
    hintNote: 'It does not have to be a link. A name or an email is enough.',
    ask: 'Ask for help finding it',
    asking: 'Asking…',
    asked: 'Sent. A person will use it to look you up.',
    askFailed: 'Could not send that just now. Try again.',
    // Why the step exists.
    whyTitle: 'Why this step',
    why: [
        { title: 'Real-person proof', text: "Quora activity shows you're a real person with history online." },
        { title: 'Reduces infiltration', text: 'Makes it harder for traffickers to create fake accounts.' },
        { title: 'Reviewed by a person', text: 'A human reviews every address. Nothing is turned down by a machine.' },
    ],
    opensTitle: 'What opens once you are approved',
    opens: ['People, with names, skills and contact', 'Your credits, to send and receive', 'Speaking in rooms and booking a talk', 'Posting and answering after day 14'],
    // What gets an account banned, closed until opened.
    banTitle: 'What gets an account banned',
    read: 'Read',
    hide: 'Hide',
    ban: [
        'Signing up to harass people here gets the account banned. That includes the address it is signed up with: an address chosen to mock somebody is the harassment, not a preamble to it.',
        'Running a second account when you already have one gets the second one banned. Your first is untouched.',
        'Not finishing this step is not one of them. An account that never sends a profile address stays where it is, with the access that carries, for as long as it takes. Nobody is removed for being slow, for not finding their profile address, or for asking for help instead.',
        'A ban closes the account rather than this app alone, so anything else you sign into with it closes too. It is not a deletion and it can be lifted.',
    ],
};
