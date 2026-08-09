import { describe, it, expect } from 'vitest';
import { summarizeTrustEvidenceForPeer, TRUST_SUMMARY_BREADTH_TYPE } from './peer-summary';
import type { TrustEvidenceItem } from './types';

// summarizeTrustEvidenceForPeer is the disclosure boundary for the `restricted` setting: it decides
// what one member learns about another. These tests lock the two rules that make it a summary
// rather than a copy — no timestamps or supporting detail survive, and per-plugin participation
// collapses to a breadth count — plus the fail-closed default for anything unclassified. The
// function is pure (evidence in -> evidence out), so no DB is touched.

const NOW = '2026-08-07T00:00:00.000Z';

function item(type: string, summary: string, extra: Partial<TrustEvidenceItem> = {}): TrustEvidenceItem {
  return { type, summary, createdAt: NOW, createdBy: 'trust-signal', ...extra };
}

describe('summarizeTrustEvidenceForPeer', () => {
  it('drops every timestamp and supporting detail', () => {
    const summary = summarizeTrustEvidenceForPeer([
      item('engagement-login-frequency', 'Active on 162 days', {
        details: 'Most recent sign-in 2026-08-06T01:11:57.210Z',
      }),
    ]);

    expect(summary).toEqual([{ type: 'engagement-login-frequency', summary: 'Active on 162 days' }]);
    expect(summary[0]).not.toHaveProperty('createdAt');
    expect(summary[0]).not.toHaveProperty('details');
  });

  it('collapses per-plugin participation into one breadth line, counting distinct plugins', () => {
    const summary = summarizeTrustEvidenceForPeer([
      item('engagement-skillshunt-submissions', 'Accepted 24 SkillsHunt submissions'),
      item('engagement-chyme-rooms', 'Joined 1 Chyme room'),
      item('engagement-directory-profile', 'Claimed 1 Directory profile'),
      // Both SocketRelay items name one plugin, so breadth counts them once.
      item('engagement-socket-relay-trades', 'Completed 3 SocketRelay trades'),
      item('engagement-socket-relay-requests', 'Opened 5 SocketRelay requests'),
    ]);

    expect(summary).toEqual([{ type: TRUST_SUMMARY_BREADTH_TYPE, summary: 'Took part in 4 plugins' }]);
  });

  it('never leaks what a member did or where they did it', () => {
    const summary = summarizeTrustEvidenceForPeer([
      item('engagement-skillshunt-submissions', 'Accepted 24 SkillsHunt submissions'),
      item('engagement-foundation-provider', 'Connected with 2 members as a Foundation provider'),
    ]);

    const text = summary.map((line) => line.summary).join(' ');
    expect(text).not.toMatch(/SkillsHunt|Foundation|24|submissions/);
  });

  it('uses the singular for a single plugin', () => {
    const summary = summarizeTrustEvidenceForPeer([item('engagement-chyme-rooms', 'Joined 1 Chyme room')]);
    expect(summary).toEqual([{ type: TRUST_SUMMARY_BREADTH_TYPE, summary: 'Took part in 1 plugin' }]);
  });

  it('passes aggregate ServiceCredits counts through with their shipped wording intact', () => {
    const summary = summarizeTrustEvidenceForPeer([
      item('engagement-service-credits-payers', 'Received ServiceCredits from 4 community members'),
      item('engagement-service-credits-clean', '7 completed ServiceCredits transfers, none disputed'),
    ]);

    expect(summary.map((line) => line.summary)).toEqual([
      'Received ServiceCredits from 4 community members',
      '7 completed ServiceCredits transfers, none disputed',
    ]);
  });

  it('fails closed: an unclassified or admin evidence type is dropped', () => {
    const summary = summarizeTrustEvidenceForPeer([
      item('admin-verification', 'Flagged for review by an administrator', { details: 'internal note' }),
      item('engagement-some-future-signal', 'Did 9 new things'),
    ]);

    expect(summary).toEqual([]);
  });

  it('leads with sign-in activity, then breadth', () => {
    const summary = summarizeTrustEvidenceForPeer([
      item('engagement-chyme-rooms', 'Joined 1 Chyme room'),
      item('engagement-login-frequency', 'Active on 162 days'),
    ]);

    expect(summary.map((line) => line.summary)).toEqual(['Active on 162 days', 'Took part in 1 plugin']);
  });

  it('returns nothing for a member with no evidence', () => {
    expect(summarizeTrustEvidenceForPeer([])).toEqual([]);
  });
});
