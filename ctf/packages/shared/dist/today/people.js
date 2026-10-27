// People in 3.1, shared by web and Android: the Directory, with each person's Foundation offering
// (skills they offer now, drawn filled) apart from what the Directory lists for them (outlined).
// Request a quote appears only for someone offering a skill.
export const SE_PEOPLE_WORDS = {
    search: 'Search by name or skill',
    offeringNow: 'Offering now',
    everyone: 'Everyone',
    offering: 'Offering',
    listed: 'Listed',
    profile: 'Profile',
    quote: 'Request a quote',
    empty: 'Nobody matches yet.',
    failed: 'Could not read People.',
    tryAgain: 'Try again',
    loading: 'Reading People…',
    previous: 'Previous',
    next: 'Next',
    range: (from, to, total) => `${from}–${to} of ${total}`,
};
export const SE_PEOPLE_PAGE_SIZE = 20;
export function sePersonLinks(person) {
    return {
        profile: `/apps/directory/profile/${person.id}`,
        quote: person.offering.length > 0 ? `/apps/foundation/provider/${person.id}` : null,
    };
}
