// The day's credit card (owner decisions, 2026-11-11). One card a day carries 1 ServiceCredit: the
// oldest open ask on Today that day, the same card for everyone. The credit is newly created, never
// taken from the asker, and goes to the member who helped once the asker confirms it was done.
// ServiceCredits are an internal credits unit, not money.
// The oldest candidate, ties broken by card id so every server picks the same one. An ask with no
// author (a ride wanted) cannot carry the credit: nobody named can confirm it on the card.
export function sePickDailyCreditCard(candidates) {
    let oldest = null;
    for (const candidate of candidates) {
        if (!candidate.authorAccountId || Number.isNaN(Date.parse(candidate.createdAtIso)))
            continue;
        if (!oldest || isOlder(candidate, oldest))
            oldest = candidate;
    }
    return oldest;
}
function isOlder(a, b) {
    const diff = Date.parse(a.createdAtIso) - Date.parse(b.createdAtIso);
    return diff < 0 || (diff === 0 && a.id < b.id);
}
// The day the choice belongs to, in UTC, so the card is the same for everyone wherever they are.
export function seDailyCreditDay(now) {
    return now.toISOString().slice(0, 10);
}
// Who the asker can name when they tap Done on their ask from Today: the other members who answered
// "I can help" on it, in the order they answered. Empty means Done closes it with no credit.
export function seDoneHelpers(answers, viewerId) {
    return answers.filter((answer) => answer.accountId !== viewerId && answer.kinds.includes('help'));
}
// The line on that one card, as the approved boards show it. Shown to everyone but the asker, who is
// the one confirming rather than the one it waits on.
export function seDailyCreditPill(card, viewerId) {
    if (!card.dailyCredit || !card.author || card.author.accountId === viewerId)
        return null;
    return `+1 credit when ${card.author.handle} confirms it was done`;
}
