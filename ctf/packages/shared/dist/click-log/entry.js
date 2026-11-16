// The 3.1 "Log what happened" sheet, opened from Me → Tools on web and Android: the same entry form
// as the 3.0 ClickLog page (note, problems, schemes, the "Not listed" suggestion, sharing, location),
// posting to the same route, POST /api/click-log. History and trends stay on the 3.0 page, linked
// from the sheet once an entry is saved. Words and rules are here so web and Android match.
import { MAX_TAGS_PER_KIND } from './limits';
import { CLICK_LOG_SCHEME_TAGS, NOT_LISTED_SCHEME_SLUG } from './tags';
export const CLICK_LOG_HISTORY_HREF = '/apps/click-log';
// The public pages that describe every problem and every scheme in full.
export const CLICK_LOG_PROBLEMS_PAGE_URL = 'https://lagatos.com/look-ma';
export const CLICK_LOG_SCHEMES_PAGE_URL = 'https://lagatos.com/schemes';
export const SE_CLICK_LOG_WORDS = {
    eyebrow: 'Tools',
    title: 'Log what happened',
    close: 'Close',
    rule: 'Submit logs it with the date and time. Everything else is optional.',
    noteLabel: 'Add a note (optional)',
    notePlaceholder: 'Describe what happened…',
    problemsLabel: 'Which problems happened? (optional — pick all that apply)',
    problemsSearch: 'Search problems…',
    schemesLabel: 'Which schemes were used? (optional — pick all that apply)',
    schemesSearch: 'Search schemes…',
    fullList: 'Full list',
    problemsListTitle: 'The full problems list on lagatos.com',
    schemesListTitle: 'The full schemes list on lagatos.com',
    atCap: (max) => `Up to ${max} — remove one to pick another.`,
    noMatch: (query) => `Nothing matches “${query}”.`,
    remove: (label) => `Remove ${label}`,
    clearSearch: 'Clear tag search',
    tagsNeedLocation: 'Tags need a location: add your location below before submitting, so the trend data is detailed enough.',
    suggestionLabel: 'Describe the scheme (required — shared with the owner)',
    suggestionPlaceholder: 'What did they do? A sentence or two is enough…',
    quoraLabel: 'Link to your Quora post about a similar incident (optional — shared with the owner)',
    quoraPlaceholder: 'https://www.quora.com/…',
    suggestionNote: 'Your description (and link, if added) goes to the owner so new schemes can be named. Your note above stays private, as always.',
    addLocation: 'Add location',
    locating: 'Locating…',
    locationAdded: 'Location added',
    noLocationWeb: "This browser can't access location.",
    noLocationPhone: "This phone can't access location.",
    locationBlockedWeb: 'Location is blocked. On iPhone: Settings → Privacy & Security → Location Services → turn it on and set Safari Websites to “While Using the App”, then reload and try again.',
    locationBlockedPhone: 'Location is blocked. Allow location for this app in the phone’s settings, then try again.',
    locationTimeout: 'Location timed out — try again.',
    locationUnavailable: 'Your location is unavailable right now — try again, ideally with Wi-Fi on.',
    loading: 'Getting the form ready…',
    loadFailed: (reason) => `Part of the form could not load (${reason}). You can still log what happened.`,
    shareDefaultFailed: 'Your sharing default could not be loaded, so new incidents are not shared unless you turn sharing on.',
    cancel: 'Cancel',
    submit: 'Submit',
    submitting: 'Submitting…',
    logFailed: 'Failed to log incident',
    savedTitle: 'Logged',
    saved: 'What happened is logged, with the date and time.',
    history: 'See your history and trends',
    another: 'Log another',
    done: 'Done',
};
export function clickLogTagged(problemTags, schemeTags) {
    return problemTags.length > 0 || schemeTags.length > 0;
}
// Submit waits while sending, while tags are picked without a location, and while "Not listed" is
// picked without its description. The server enforces the same rules.
export function clickLogSubmitDisabled(args) {
    if (args.submitting)
        return true;
    if (clickLogTagged(args.problemTags, args.schemeTags) && !args.locationAdded)
        return true;
    return args.schemeTags.includes(NOT_LISTED_SCHEME_SLUG) && args.suggestion.trim().length === 0;
}
// The POST /api/click-log body. Unpicked tags are left out, the suggestion fields go only with
// "Not listed", and a tagged incident always shares its trend data (the server rejects one that
// does not).
export function clickLogCreateBody(args) {
    const notListed = args.schemeTags.includes(NOT_LISTED_SCHEME_SLUG);
    const suggestion = args.schemeSuggestion.trim();
    const quoraUrl = args.schemeQuoraUrl.trim();
    return {
        metadata: { ...args.location, notes: args.note },
        sharedWithOwner: clickLogTagged(args.problemTags, args.schemeTags) || args.sharedWithOwner,
        ...(args.problemTags.length > 0 ? { problemTags: [...args.problemTags] } : {}),
        ...(args.schemeTags.length > 0 ? { schemeTags: [...args.schemeTags] } : {}),
        ...(notListed && suggestion ? { schemeSuggestion: suggestion } : {}),
        ...(notListed && quoraUrl ? { schemeQuoraUrl: quoraUrl } : {}),
    };
}
// Tapping a tag adds it, up to MAX_TAGS_PER_KIND, and tapping a picked one removes it.
export function clickLogToggleTag(values, slug, max = MAX_TAGS_PER_KIND) {
    if (values.includes(slug))
        return values.filter((value) => value !== slug);
    return values.length >= max ? [...values] : [...values, slug];
}
export function clickLogMatchTags(options, search) {
    const query = search.trim().toLowerCase();
    return query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
}
export function clickLogPickedTags(options, values) {
    return values.map((slug) => options.find((option) => option.slug === slug)).filter((tag) => tag !== undefined);
}
// "Not listed" is offered only to members the server says may suggest a scheme.
export function clickLogSchemeOptions(canSuggestScheme) {
    return canSuggestScheme ? CLICK_LOG_SCHEME_TAGS : CLICK_LOG_SCHEME_TAGS.filter((tag) => tag.slug !== NOT_LISTED_SCHEME_SLUG);
}
export function clickLogLocationLabel(locationAdded, locating) {
    if (locationAdded)
        return SE_CLICK_LOG_WORDS.locationAdded;
    return locating ? SE_CLICK_LOG_WORDS.locating : SE_CLICK_LOG_WORDS.addLocation;
}
