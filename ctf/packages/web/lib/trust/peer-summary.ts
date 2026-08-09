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
//      member last signed in, and never a per-item date they could assemble into a timeline.
//   2. Per-plugin participation collapses into one breadth line. "Accepted 24 SkillsHunt
//      submissions" and "Joined 1 Chyme room" become "Took part in 6 plugins", so a peer sees that
//      the member is active without seeing what they have been doing or where.
//
// Aggregate counts that are already coarse (sign-in days, the ServiceCredits breadth and
// clean-record lines) pass through with their shipped wording intact — this file never rewrites a
// summary string, so approved copy cannot drift here.
//
// This module is imported by BOTH the route that serves the projection and the visibility control
// that previews it to the owner, so the preview cannot disagree with what peers actually receive.
import type { TrustPeerEvidenceItem } from './types';

// Evidence types that name a plugin the member took part in. Several types can map to one plugin
// (SocketRelay emits both a trades and a requests item), so breadth counts DISTINCT plugins, not
// evidence rows — otherwise a member active in one plugin two ways would read as two plugins.
const PLUGIN_BY_EVIDENCE_TYPE: Record<string, string> = {
  'engagement-socket-relay-trades': 'socket-relay',
  'engagement-socket-relay-requests': 'socket-relay',
  'engagement-lighthouse-matches': 'lighthouse',
  'engagement-trust-transport-trips': 'trust-transport',
  'engagement-skillshunt-submissions': 'skills-hunt',
  'engagement-level-up-cohorts': 'level-up',
  'engagement-chyme-rooms': 'chyme',
  'engagement-directory-profile': 'directory',
  'engagement-what-works-endorsements': 'what-works',
  'engagement-peerprogramming-cohorts': 'peer-programming',
  'engagement-contributions': 'contributions',
  'engagement-foundation-provider': 'foundation',
  'engagement-recurring-activity': 'recurring-activity',
};

// Aggregate signals that are already a coarse count rather than a record of a specific event, so
// they survive the projection with their wording unchanged. Everything not listed here and not in
// PLUGIN_BY_EVIDENCE_TYPE is dropped: this is a disclosure boundary, so it fails closed. A signal
// added upstream stays out of the summary view until it is deliberately classified here.
const PASSTHROUGH_EVIDENCE_TYPES: readonly string[] = [
  'engagement-login-frequency',
  'engagement-service-credits-payers',
  'engagement-service-credits-clean',
];

// The breadth line's own type slug. Not produced by the signal builder — it exists only in this
// projection — so it cannot collide with a stored evidence type.
export const TRUST_SUMMARY_BREADTH_TYPE = 'summary-plugin-breadth';

function countDistinctPlugins(evidence: readonly TrustPeerEvidenceItem[]): number {
  const plugins = new Set<string>();
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
function toSummaryLine(item: TrustPeerEvidenceItem): TrustPeerEvidenceItem {
  return { type: item.type, summary: item.summary };
}

// Reduce a member's full evidence list to what a peer sees under `restricted`.
export function summarizeTrustEvidenceForPeer(
  evidence: readonly TrustPeerEvidenceItem[],
): TrustPeerEvidenceItem[] {
  const summary: TrustPeerEvidenceItem[] = [];

  // Sign-in activity leads: it is the one signal every participating member has.
  const login = evidence.find((item) => item.type === 'engagement-login-frequency');
  if (login) {
    summary.push(toSummaryLine(login));
  }

  const pluginCount = countDistinctPlugins(evidence);
  if (pluginCount > 0) {
    summary.push({
      type: TRUST_SUMMARY_BREADTH_TYPE,
      summary: `Took part in ${pluginCount} ${pluginCount === 1 ? 'plugin' : 'plugins'}`,
    });
  }

  for (const item of evidence) {
    if (item.type !== 'engagement-login-frequency' && PASSTHROUGH_EVIDENCE_TYPES.includes(item.type)) {
      summary.push(toSummaryLine(item));
    }
  }

  return summary;
}
