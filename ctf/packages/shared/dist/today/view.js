// What the Today screen shows from a Today answer, shared by web and Android: the filter chips,
// which cards a filter and the member's hidden marks leave, the done count, and plain names for any
// source that failed to load.
export const SE_TODAY_FILTERS = [
    { key: 'all', label: 'All', kinds: null },
    { key: 'asks', label: 'Asks', kinds: ['ask'] },
    { key: 'offers', label: 'Offers', kinds: ['offer'] },
    { key: 'stories', label: 'Stories', kinds: ['story', 'replay'] },
    { key: 'matches', label: 'Matches', kinds: ['match'] },
];
const SOURCE_NAMES = {
    'peer-programming': 'goals',
    'socket-relay': 'requests',
    'trust-transport': 'rides',
    lighthouse: 'places to stay',
    'skill-up': 'cohorts',
    announcements: 'announcements',
    'directory-invites': 'invitations',
    'what-works': 'What Works',
    mood: 'Mood',
    numbers: 'numbers',
    'beacon-replays': 'replays',
    'skills-hunt': 'the Wanted card',
    beacon: 'the broadcast',
    chyme: 'the Main Room',
};
export function seTodayView(today, marks, filter) {
    const kinds = SE_TODAY_FILTERS.find((item) => item.key === filter)?.kinds ?? null;
    const cards = (today?.cards ?? []).filter((card) => !marks.hidden.includes(card.id) && (!kinds || kinds.includes(card.kind)));
    const done = cards.filter((card) => marks.read.includes(card.id)).length;
    const missing = (today?.unavailable ?? []).map((name) => SOURCE_NAMES[name] ?? name);
    return {
        cards,
        doneLine: done > 0 ? `${done} of ${cards.length} done` : null,
        missingLine: missing.length > 0 ? `Could not load ${missing.join(', ')} this time.` : null,
        caughtUpLine: cards.length === 0 ? 'Nothing here yet.' : "You're caught up.",
    };
}
export function seRoomPeopleLine(members, guests) {
    if (members + guests === 0)
        return 'Quiet now';
    return `${members} in the room${guests ? `, ${guests} listening as guests` : ''}`;
}
