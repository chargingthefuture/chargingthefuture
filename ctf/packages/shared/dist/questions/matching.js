// 21 Questions matching, on or off, shared by web and Android: the words on the question card and
// on the toggle, and when the toggle shows. Matching is on until the member turns it off; answering
// never turns it back on.
export const SE_MATCHING_WORDS = {
    title: '21 Questions buddies',
    toggle: 'Find me buddies who answer like me',
    hint: "Off: you leave every other member's buddy network and your past answers stop counting. Your answers are kept. Turn it back on any time.",
    failed: 'Your buddy setting was not changed:',
    optIn: '21 Questions finds your buddies: people who answered the way you did. Answering is how you opt in, and members who pick the same answer on three or more questions show up here as your buddies.',
    reachOut: 'Reaching out to a buddy is optional, and so is replying to one.',
    optOut: 'To stop finding buddies, turn off Find me buddies in Matches. You can keep answering either way.',
    off: 'Finding buddies is off. Your answers are not used to find you buddies. Turn it back on in Matches.',
};
// The toggle shows once the member has answered at least one question.
export function seMatchingToggleShown(state) {
    return state !== null && state.answered > 0;
}
// The question card's body, one line each, ending with how many are answered. Once today's question
// is answered the card stays, done, and opens with the answer the member picked.
export function seQuestionCardBody(answered, out, enabled, picked = null) {
    const W = SE_MATCHING_WORDS;
    const lines = enabled ? [W.optIn, W.reachOut, W.optOut] : [W.off];
    return [...(picked ? [`You picked: ${picked}`] : []), ...lines, `${answered} of ${out} answered so far.`].join('\n');
}
