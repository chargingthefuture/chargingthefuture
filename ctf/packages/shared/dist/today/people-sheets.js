// The two sheets People opens in 3.1, shared by web and Android: a person's profile (what the
// Directory's own profile page shows, read from GET /api/directory/profiles/[id]) and Request a quote
// (the Foundation flow, read from GET /api/foundation/providers/[id] and sent through
// POST /api/foundation/connections/threads then POST /api/foundation/quotes, as the Foundation
// screens send it). Same routes as 3.0; only the screens differ (owner decision, 2026-11-16).
import { seWebAddress } from './people';
function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function texts(value) {
    return Array.isArray(value) ? value.map(text).filter((v) => v !== null) : [];
}
function record(value) {
    return value && typeof value === 'object' ? value : null;
}
function placeOf(m) {
    const parts = [text(m.state), text(m.country)].filter((v) => v !== null);
    return parts.length > 0 ? parts.join(', ') : null;
}
// The `member` the Directory read answers, or null when the body is not one.
export function sePersonProfileFrom(body) {
    const m = record(record(body)?.member);
    const id = text(m?.id);
    if (!m || !id)
        return null;
    const claimedByUserId = text(m.claimedByUserId);
    return {
        id,
        name: text(m.name) ?? 'Unnamed',
        username: text(m.username),
        headline: text(m.headline),
        bio: text(m.bio),
        jobTitle: text(m.jobTitle),
        sector: text(m.sector),
        place: placeOf(m),
        quora: seWebAddress(text(m.profileUrl)),
        skills: texts(m.skills),
        pendingSkills: texts(m.pendingSkills),
        claimedByUserId,
        communityGenerated: m.source === 'community-generated',
        nominatedBy: text(m.invitedByUsername),
        weavers: claimedByUserId !== null && m.hasWeaversBadge === true,
    };
}
// The `provider` the Foundation read answers, with the viewer's own id, or null.
export function seQuoteProviderFrom(body) {
    const b = record(body);
    const p = record(b?.provider);
    const profileId = text(p?.profileId);
    const providerUserId = text(p?.providerUserId);
    if (!p || !profileId || !providerUserId)
        return null;
    const skills = Array.isArray(p.offeredSkills) ? p.offeredSkills.map((s) => text(record(s)?.name)).filter((v) => v !== null) : [];
    return {
        provider: {
            profileId,
            providerUserId,
            displayName: text(p.displayName) ?? 'Unnamed',
            headline: text(p.headline),
            shortDescription: text(p.shortDescription),
            bio: text(p.bio),
            offeredSkills: skills,
        },
        viewerUserId: text(b?.viewerUserId),
    };
}
// The service the quote names: the provider's headline, as the Foundation screens send it.
export function seQuoteServiceType(headline) {
    return headline?.trim() || 'General trade service';
}
// The Foundation screens' fixed wording for the failure codes whose server message is written for a
// log; any other failure shows the route's own words, then the screen's sentence, with its reference.
const SE_FOUNDATION_FAILURES = {
    FOUNDATION_POLICY_DENIED: "You can't request a quote from your own profile.",
    FOUNDATION_PROVIDER_NOT_FOUND: "This provider's profile could not be found.",
    FOUNDATION_RATE_LIMIT_EXCEEDED: "You're sending requests too quickly — wait a moment and try again.",
    FOUNDATION_CSRF_DENIED: 'Your session needs a refresh — reload the page and try again.',
};
export function seFoundationFailure(body, fallback) {
    const b = record(body);
    const code = text(b?.code);
    const said = (code && SE_FOUNDATION_FAILURES[code]) || text(b?.message) || fallback;
    const reference = text(b?.reference);
    return reference ? `${said} [ref ${reference}]` : said;
}
// The address that opens a person's profile sheet in 3.1, for the Share control on the sheet.
export function sePersonSheetPath(profileId) {
    return `/?tab=people&person=${encodeURIComponent(profileId)}`;
}
export const SE_PERSON_SHEET_WORDS = {
    close: 'Close',
    profileTitle: 'Profile',
    quoteTitle: 'Request a quote',
    loadingProfile: 'Reading the profile…',
    profileFailed: 'Could not read this profile.',
    loadingProvider: 'Reading what they offer…',
    providerFailed: 'Could not read what this person offers.',
    tryAgain: 'Try again',
    member: 'Member',
    listed: 'Listed',
    communityGenerated: 'Community-generated profile',
    nominatedBy: (handle) => `Nominated by @${handle}`,
    weavers: 'Weavers of the Commons',
    about: 'About',
    skills: 'Skills',
    pending: 'pending review',
    pendingHint: 'Not in the official skills list yet — pending admin review.',
    noSkills: 'No skills listed yet.',
    quora: 'View Quora profile',
    noQuora: 'Quora profile not linked yet',
    noQuoraText: 'This profile has no Quora link on file.',
    quoraTitle: 'Their Quora profile (external site)',
    share: 'Share',
    shareTitle: 'Share this profile',
    offers: 'Willing to be contacted about',
    request: 'Request a quote',
    requesting: 'Requesting…',
    ownProfile: "This is your own profile — you can't request a quote from yourself.",
    goodToKnow: 'Good to know',
    goodToKnowText: 'This provider is a fellow community member, not a formally vetted service.',
    requested: (name) => `Quote requested. ${name} has been told.`,
    connectFailed: 'Could not open a connection with this provider.',
    incomplete: 'Connection response was incomplete.',
    quoteFailed: 'Could not submit the quote request.',
    requestFailed: 'Failed to request quote.',
    // Accessible names that say whose and what happens.
    openProfile: (name) => `Open ${name}'s profile`,
    openQuote: (name) => `Request a quote from ${name}`,
    quoraFor: (name) => `${name}'s Quora profile: copy the address or open it`,
    shareFor: (name) => `Share ${name}'s profile: copy the address or open it`,
};
