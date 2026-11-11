// People in 3.1, shared by web and Android: the Directory, with each person's Foundation offering
// (skills they offer now, drawn filled) apart from what the Directory lists for them (outlined).
// Request a quote appears only for someone offering a skill. Built to the approved boards "People,
// verified" and "People, not yet verified".
export const SE_PEOPLE_CATEGORIES = ['trades', 'care', 'paperwork', 'tech'];
export const SE_PEOPLE_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'offering', label: 'Offering now' },
    { id: 'trades', label: 'Trades' },
    { id: 'care', label: 'Care' },
    { id: 'paperwork', label: 'Paperwork' },
    { id: 'tech', label: 'Tech' },
];
// Which Skills Taxonomy sectors each chip covers, by the sector's live name. A person falls in a
// category when their job title's sector, their profile's sector or the sector of any skill they list
// is one of these, so one person can be in several. Creative & Media sits in none of the four: those
// people show under All. A sector renamed in the taxonomy drops out of its chip until its new name
// is added here.
export const SE_PEOPLE_CATEGORY_SECTORS = {
    trades: [
        'Housing & Construction',
        'Energy & Utilities',
        'Water & Sanitation',
        'Manufacturing & Industry',
        'Mining / Extractive',
        'Transport & Logistics',
        'Environmental & Waste Management',
        'Food & Agriculture',
        'Tourism & Hospitality',
        'Retail & Services',
    ],
    care: ['Health', 'Education', 'Emergency & Reserve Roles'],
    paperwork: ['Professional & Business Services', 'Finance & Public Administration', 'Microfinance & SME Support', 'Public Safety & Justice'],
    tech: ['Telecommunications & IT', 'R&D & High-Tech', 'Technology'],
};
export function sePeopleFilter(value) {
    return SE_PEOPLE_FILTERS.some((f) => f.id === value) ? value : 'all';
}
export function sePeopleCategory(filter) {
    return SE_PEOPLE_CATEGORIES.includes(filter) ? filter : null;
}
export const SE_PEOPLE_WORDS = {
    title: 'People',
    listedCount: (count) => `${count} listed`,
    searchLabel: 'Search skills',
    search: 'A skill, like plumbing or tax forms',
    filters: 'Show',
    member: 'Member',
    listedTag: 'Listed',
    offering: 'Offering',
    listed: 'Listed',
    quote: 'Request a quote',
    empty: 'Nobody matches yet.',
    failed: 'Could not read People.',
    tryAgain: 'Try again',
    loading: 'Reading People…',
    previous: 'Previous',
    next: 'Next',
    range: (from, to, total) => `${from}–${to} of ${total}`,
    // People, not yet verified.
    lockedCount: 'people listed, with what they can do',
    lockedText: 'Names, skills and contact open once you are verified. A public list of survivors would be the wrong thing to build, so this part waits for one check.',
    finishUnlock: 'Finish Unlock',
    openNow: 'Open to you now',
    openNowText: 'Post an ask, answer one in public, listen in rooms, read every story.',
    backToToday: 'Back to Today',
};
export const SE_PEOPLE_PAGE_SIZE = 20;
// The ten faded faces above the count on the locked screen. Fixed seeds, so they are nobody.
export const SE_PEOPLE_LOCKED_FACES = Array.from({ length: 10 }, (_, i) => `people-locked-${i}`);
// "Georgia, US"; the country alone, or nothing, when that is all the profile has.
export function sePersonPlace(person) {
    const parts = [person.region, person.country].map((part) => part?.trim()).filter((part) => Boolean(part));
    return parts.length > 0 ? parts.join(', ') : null;
}
// "Career coach · Georgia, US": the job title (or the headline when there is none) and the place.
export function sePersonLine(person) {
    const parts = [person.jobTitle ?? person.headline, sePersonPlace(person)].filter((part) => Boolean(part));
    return parts.length > 0 ? parts.join(' · ') : null;
}
// Skills the Directory lists that the person does not already offer, so a skill shows once.
export function sePersonListedOnly(person) {
    return person.listed.filter((skill) => !person.offering.includes(skill));
}
export function sePersonLinks(person) {
    return {
        profile: `/apps/directory/profile/${person.id}`,
        quote: person.offering.length > 0 ? `/apps/foundation/provider/${person.id}` : null,
    };
}
