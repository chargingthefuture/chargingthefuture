// The words on a Today "Offer · hours" card: a member offering their time through Foundation, the
// skills they chose to be contacted for and the short line they wrote about it. One copy for web and
// Android, and for the signed-in and signed-out reads alike.
export const SE_HOURS_OFFER_WORDS = {
    label: 'Offer · hours',
    untitled: 'Hours to offer',
    want: "I'd like this",
    knowSomeone: 'I know someone',
    skills: (names) => `Skills offered: ${names.join(', ')}.`,
};
const TITLE_MAX = 90;
function clipLine(text, max) {
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
function tidy(text) {
    return (text ?? '').replace(/\s+/g, ' ').trim();
}
// The title is the member's own short line, else their headline; the body names the skills offered.
export function seHoursOfferText(input) {
    const own = tidy(input.shortDescription) || tidy(input.headline);
    const names = input.skillNames.map((name) => tidy(name)).filter(Boolean);
    return {
        title: own ? clipLine(own, TITLE_MAX) : SE_HOURS_OFFER_WORDS.untitled,
        body: names.length > 0 ? SE_HOURS_OFFER_WORDS.skills(names) : null,
    };
}
