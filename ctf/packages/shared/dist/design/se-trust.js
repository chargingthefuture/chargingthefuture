// The `restricted` disclosure: what one member is shown about another who has chosen to share a
// summary rather than their full trust panel.
//
// Why this exists: `restricted` used to be enforced identically to `private` — both returned 403 —
// so choosing it hid everything from peers, which is the opposite of what the setting is for. A
// member checking whether someone is an engaged participant got nothing. This projection is the
// middle tier: the coarse fact, never the record.
//
// Two rules define it:
//   1. No timestamps and no supporting detail. A viewer learns "Active on 162 days", never when the
//      member last signed in, and never a per-item date they could assemble into a timeline. The
//      sign-in-streak line is the one deliberate narrowing of that (owner decision, 2026-08-12): a
//      run of days that is still unbroken tells a viewer the member has signed in within the last
//      day. That is the point of it — someone who needs housing soon has to know who can actually
//      answer them — and it is still coarse: a day count, never a clock time, and never a date they
//      could line up against anything else.
//   2. Per-plugin participation collapses into one breadth line. "Accepted 24 SkillsHunt
//      submissions" and "Joined 1 Chyme room" become "Took part in 6 plugins", so a peer sees that
//      the member is active without seeing what they have been doing or where.
//
// Aggregate counts that are already coarse (sign-in days, the ServiceCredits breadth and
// clean-record lines) pass through with their shipped wording intact — this file never rewrites a
// summary string, so approved copy cannot drift here.
//
// This module is imported by BOTH the route that serves the projection and the screens that
// preview it to the owner (the 3.0 card, and 3.1 Me → Trust on web and Android), so the preview
// cannot disagree with what peers actually receive. It lives in @ctf/shared so the Android app runs
// the same function; web/lib/trust/peer-summary.ts re-exports it for the route.
export const SE_TRUST_WORDS = {
    title: 'Trust',
    meRow: 'What others can see of your part in the Avenhood.',
    open: 'Open Trust',
    yours: 'Your trust',
    membersSee: 'What members see',
    membersSeeText: 'Any member who opens your profile sees this, and only this. You cannot change it and neither can they.',
    membersSeeEmpty: 'Nothing yet — a line appears here once you have taken part somewhere.',
    summaryNote: 'This member shares a summary of their participation, not the detail.',
    emptyTitle: 'No trust signals yet',
    emptyOwn: 'Trust signals appear as you participate in the community',
    emptyOther: 'This member has not taken part anywhere yet, so there is nothing to go on',
    steps: ['Complete your profile', 'Make your first transaction', 'Use at least one plugin'],
    loading: 'Reading trust…',
    failed: 'Could not read trust this time.',
    locked: 'Trust opens once Unlock is done.',
    tryAgain: 'Try again',
};
// The member's own trust, recomputed from what they have done when it is read.
export const SE_TRUST_SELF_PATH = '/api/trust/user/self';
// Whose trust a profile reads: the member's own through the refreshing self route, anybody else's
// through the read-only by-id route, as the 3.0 Directory profile does.
export function seTrustPath(userId, own) {
    return own ? SE_TRUST_SELF_PATH : `/api/trust/user/${encodeURIComponent(userId)}`;
}
function toItem(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const value = raw;
    if (typeof value.type !== 'string' || typeof value.summary !== 'string')
        return null;
    const item = { type: value.type, summary: value.summary };
    if (typeof value.details === 'string' && value.details.trim())
        item.details = value.details;
    if (typeof value.createdAt === 'string')
        item.createdAt = value.createdAt;
    return item;
}
// Reads either trust route's answer. Null when it is not a trust answer at all. The self route
// carries no disclosure, and it is always the full list.
export function seTrustViewFrom(body) {
    if (!body || typeof body !== 'object')
        return null;
    const value = body;
    if (!Array.isArray(value.trustEvidence))
        return null;
    const evidence = value.trustEvidence.map(toItem).filter((item) => item !== null);
    return { evidence, disclosure: value.trustDisclosure === 'summary' ? 'summary' : 'full' };
}
// A line's text: its summary, or its type made readable when a malformed line has none.
export function seTrustLineText(item) {
    if (item.summary.trim())
        return item.summary;
    const words = item.type.replace(/[-_]+/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Trust signal';
}
// A line's date, only when it carries a real one; never the text "Invalid Date".
export function seTrustLineDate(item) {
    if (!item.createdAt)
        return null;
    const parsed = new Date(item.createdAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}
// Evidence types that name a plugin the member took part in. Several types can map to one plugin
// (SocketRelay emits both a trades and a requests item), so breadth counts DISTINCT plugins, not
// evidence rows — otherwise a member active in one plugin two ways would read as two plugins.
const PLUGIN_BY_EVIDENCE_TYPE = {
    'engagement-socket-relay-trades': 'socket-relay',
    'engagement-socket-relay-requests': 'socket-relay',
    'engagement-lighthouse-matches': 'lighthouse',
    'engagement-trust-transport-trips': 'trust-transport',
    'engagement-skillshunt-submissions': 'skills-hunt',
    'engagement-skill-up-cohorts': 'skill-up',
    'engagement-chyme-rooms': 'chyme',
    'engagement-directory-profile': 'directory',
    'engagement-what-works-endorsements': 'what-works',
    'engagement-peerprogramming-cohorts': 'peer-programming',
    'engagement-contributions': 'contributions',
    'engagement-foundation-provider': 'foundation',
    'engagement-recurring-activity': 'recurring-activity',
    'engagement-ti-radio-hosted': 'ti-radio',
};
// Aggregate signals that are already a coarse count rather than a record of a specific event, so
// they survive the projection with their wording unchanged. Everything not listed here and not in
// PLUGIN_BY_EVIDENCE_TYPE is dropped: this is a disclosure boundary, so it fails closed. A signal
// added upstream stays out of the summary view until it is deliberately classified here.
const PASSTHROUGH_EVIDENCE_TYPES = [
    'engagement-login-frequency',
    'engagement-login-streak',
    'engagement-service-credits-payers',
    'engagement-service-credits-clean',
];
// The breadth line's own type slug. Not produced by the signal builder — it exists only in this
// projection — so it cannot collide with a stored evidence type.
export const TRUST_SUMMARY_BREADTH_TYPE = 'summary-plugin-breadth';
function countDistinctPlugins(evidence) {
    const plugins = new Set();
    for (const item of evidence) {
        const plugin = PLUGIN_BY_EVIDENCE_TYPE[item.type];
        if (plugin) {
            plugins.add(plugin);
        }
    }
    return plugins.size;
}
// Keep the shipped summary string exactly as the signal builder wrote it; drop the timestamp and any
// supporting detail (the login item's `details` carries the exact last sign-in, which is a record).
function toSummaryLine(item) {
    return { type: item.type, summary: item.summary };
}
// Reduce a member's full evidence list to what a peer sees under `restricted`.
export function summarizeTrustEvidenceForPeer(evidence) {
    const summary = [];
    // Sign-in activity leads: it is the one signal every participating member has. All-time first,
    // then the current run of days directly under it — the two read as a pair, and putting the run
    // anywhere else leaves a viewer comparing an all-time number against something further down.
    const login = evidence.find((item) => item.type === 'engagement-login-frequency');
    if (login) {
        summary.push(toSummaryLine(login));
    }
    const streak = evidence.find((item) => item.type === 'engagement-login-streak');
    if (streak) {
        summary.push(toSummaryLine(streak));
    }
    const pluginCount = countDistinctPlugins(evidence);
    if (pluginCount > 0) {
        summary.push({
            type: TRUST_SUMMARY_BREADTH_TYPE,
            summary: `Took part in ${pluginCount} ${pluginCount === 1 ? 'plugin' : 'plugins'}`,
        });
    }
    // The remaining passthrough signals, in their stored order. The two sign-in lines are skipped
    // here because they were already placed above — without this they would appear twice.
    const alreadyPlaced = ['engagement-login-frequency', 'engagement-login-streak'];
    for (const item of evidence) {
        if (!alreadyPlaced.includes(item.type) && PASSTHROUGH_EVIDENCE_TYPES.includes(item.type)) {
            summary.push(toSummaryLine(item));
        }
    }
    return summary;
}
