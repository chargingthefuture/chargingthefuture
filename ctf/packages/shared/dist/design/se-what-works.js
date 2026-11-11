// What Works in 3.1: adding a problem (search first, then add) and the admin review of new
// problems, to the approved boards "What works: add a problem" and "What works: admin merge and
// spam". Android opens the same web screens in its browser panel, so these words are used on web.
export const SE_WW_ADD_HREF = '/apps/what-works?add=problem';
export function seWwHelpedCount(n) {
    if (n === 0)
        return 'Nothing added yet';
    return `${n.toLocaleString('en-US')} ${n === 1 ? 'thing' : 'things'} that helped`;
}
export const SE_WW_ADD_WORDS = {
    eyebrow: 'What works',
    title: 'Add a problem',
    close: 'Close',
    rule: 'Check the list first. A problem that is already here gets merged into it, and what you add moves there. Every problem is read before it shows.',
    label: 'The problem, in a few words',
    matchesLabel: 'Already here. Is it one of these?',
    searching: 'Looking for problems already here…',
    noMatches: 'Nothing on the list shares those words.',
    matchesFailed: (reason) => `Could not check the list (${reason}). You can still add it.`,
    useThis: 'Use this',
    addIt: 'None of these, add it',
    addItEmpty: 'Add it',
    sending: 'Adding…',
    tooShort: 'Type a few words first.',
    sentTitle: 'Sent for review',
    sent: 'It shows on the list once it is read. Add what helped with it now, and it moves with the problem if it is merged.',
    addWhatHelped: 'Add what helped',
    done: 'Done',
    waiting: (title) => `${title} (waiting for review)`,
};
export const SE_WW_ADMIN_WORDS = {
    eyebrow: 'System Architect · What works',
    title: (n) => `New problems · ${n.toLocaleString('en-US')}`,
    loading: 'Reading new problems…',
    empty: 'Nothing new to read.',
    looksLike: 'Looks like:',
    mergeInto: 'Merge into',
    mergeIntoMenu: 'Merge into…',
    merge: 'Merge',
    approve: 'Approve as new',
    spam: 'Delete as spam',
    noMatch: 'no close match',
    attached: (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'thing' : 'things'} that helped attached`,
    allProblems: 'All problems · merge two that already show',
    allTitle: 'Merge two problems',
    allText: 'Everything under the first, and every vote on it, moves to the second. The first is removed.',
    mergeFrom: 'This problem',
    mergeTo: 'Goes into',
    choose: 'Choose…',
    mergeTwo: 'Merge them',
    merged: (moved) => `Merged. ${moved.toLocaleString('en-US')} ${moved === 1 ? 'thing' : 'things'} that helped moved.`,
    hideAll: 'Hide',
    failed: 'The change could not be saved.',
};
// The line under a new problem's title: when it was sent, what the proposer added, and whether a
// listed problem looks like it.
export function seWwPendingMeta(sent, attachedCount, hasMatch) {
    const parts = [`Sent ${sent}`];
    if (attachedCount > 0)
        parts.push(SE_WW_ADMIN_WORDS.attached(attachedCount));
    if (!hasMatch)
        parts.push(SE_WW_ADMIN_WORDS.noMatch);
    return parts.join(' · ');
}
