// 21 Questions matching, on or off, shared by web and Android: the words on the question card and
// on the toggle, and when the toggle shows. Matching is on until the member turns it off; answering
// never turns it back on.
export const SE_MATCHING_WORDS = {
    title: '21 Questions matching',
    toggle: 'Match me with members who answer like me',
    hint: "Off: you stop appearing in other members' matches and your past answers stop counting. Your answers are kept. Turn it back on any time.",
    failed: 'Matching was not changed:',
    optIn: 'Answering is how you opt in to matching. Members who pick the same answer on three or more questions show up here as like-minded matches.',
    reachOut: 'Reaching out to a match is optional, and so is replying to one.',
    optOut: 'To stop being matched, turn off matching in Matches. You can keep answering either way.',
    off: 'Matching is off. Your answers are not used to match you. Turn it back on in Matches.',
};
// The toggle shows once the member has answered at least one question.
export function seMatchingToggleShown(state) {
    return state !== null && state.answered > 0;
}
// The question card's body, one line each, ending with how many are answered.
export function seQuestionCardBody(answered, out, enabled) {
    const W = SE_MATCHING_WORDS;
    const lines = enabled ? [W.optIn, W.reachOut, W.optOut] : [W.off];
    return [...lines, `${answered} of ${out} answered so far.`].join('\n');
}
