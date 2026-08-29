import { describe, it, expect } from 'vitest';
import { buildTrustEvidence } from './db';
import type { TrustSignalMetrics } from './types';

// buildTrustEvidence encodes the Rule 132 invariants: categorical evidence only (never a numeric
// score), real-data-only, a dispute withholds the clean signal rather than branding anyone, and the
// sensitive personal-wellbeing/verification plugins are never surfaced. These tests lock that
// behavior. The function is pure (metrics + time in -> evidence out), so no DB is touched.

const NOW = '2026-06-29T00:00:00.000Z';

function zeroMetrics(): TrustSignalMetrics {
  return {
    loginDays: 0,
    loginStreakDays: 0,
    loginEvents: 0,
    lastLoginAt: null,
    socketRelayCompletedTrades: 0,
    socketRelayRequestsOpened: 0,
    serviceCreditsDistinctPayers: 0,
    serviceCreditsCompletedReceived: 0,
    serviceCreditsDisputesAgainst: 0,
    lighthouseMatchesAccepted: 0,
    trustTransportTripsCompleted: 0,
    skillsHuntSubmissionsAccepted: 0,
    skillUpCohortsCompleted: 0,
    chymeRoomsJoined: 0,
    directoryProfilesClaimed: 0,
    whatWorksEndorsements: 0,
    peerProgrammingCohortsJoined: 0,
    contributionsConfirmed: 0,
    foundationConnectionsAsProvider: 0,
    recurringActivityCounterparties: 0,
  };
}

describe('buildTrustEvidence', () => {
  it('produces no evidence when every signal is zero (real-data-only)', () => {
    expect(buildTrustEvidence(zeroMetrics(), NOW)).toEqual([]);
  });

  it('stamps each item with the trust-signal author and the given time', () => {
    const ev = buildTrustEvidence({ ...zeroMetrics(), loginDays: 5 }, NOW);
    expect(ev).toHaveLength(1);
    for (const item of ev) {
      expect(item.createdBy).toBe('trust-signal');
      expect(item.createdAt).toBe(NOW);
      expect(item.summary.length).toBeGreaterThan(0);
    }
  });

  it('withholds the clean-record signal when a dispute exists, and never surfaces the dispute', () => {
    const clean = buildTrustEvidence(
      { ...zeroMetrics(), serviceCreditsCompletedReceived: 4, serviceCreditsDisputesAgainst: 0 },
      NOW,
    );
    expect(clean.some((e) => e.type === 'engagement-service-credits-clean')).toBe(true);

    const disputed = buildTrustEvidence(
      { ...zeroMetrics(), serviceCreditsCompletedReceived: 4, serviceCreditsDisputesAgainst: 1 },
      NOW,
    );
    expect(disputed.some((e) => e.type === 'engagement-service-credits-clean')).toBe(false);
    expect(disputed.some((e) => /dispute/i.test(e.summary))).toBe(false);
  });

  it('uses singular for a count of one and plural for more', () => {
    const one = buildTrustEvidence({ ...zeroMetrics(), lighthouseMatchesAccepted: 1 }, NOW);
    expect(one.find((e) => e.type === 'engagement-lighthouse-matches')?.summary).toBe('Accepted 1 LightHouse match');
    const many = buildTrustEvidence({ ...zeroMetrics(), lighthouseMatchesAccepted: 3 }, NOW);
    expect(many.find((e) => e.type === 'engagement-lighthouse-matches')?.summary).toBe('Accepted 3 LightHouse matches');
  });

  it('adds sign-in detail only when a last-login timestamp is present', () => {
    const login = buildTrustEvidence({ ...zeroMetrics(), loginDays: 2, lastLoginAt: '2026-06-28' }, NOW).find(
      (e) => e.type === 'engagement-login-frequency',
    );
    expect(login?.summary).toBe('Active on 2 days');
    expect(login?.details).toContain('2026-06-28');
  });

  it('reports the all-time day count and the current run of days as two separate lines', () => {
    const ev = buildTrustEvidence({ ...zeroMetrics(), loginDays: 162, loginStreakDays: 12 }, NOW);
    expect(ev.map((e) => e.summary)).toEqual(['Active on 162 days', 'Active 12 days in a row']);
  });

  it('omits the run-of-days line when the run has been broken, keeping the all-time count', () => {
    const ev = buildTrustEvidence({ ...zeroMetrics(), loginDays: 162, loginStreakDays: 0 }, NOW);
    expect(ev.map((e) => e.summary)).toEqual(['Active on 162 days']);
    expect(ev.some((e) => e.type === 'engagement-login-streak')).toBe(false);
  });

  it('uses the singular for a one-day run', () => {
    const ev = buildTrustEvidence({ ...zeroMetrics(), loginDays: 1, loginStreakDays: 1 }, NOW);
    expect(ev.find((e) => e.type === 'engagement-login-streak')?.summary).toBe('Active 1 day in a row');
  });

  it('carries no supporting detail on the run-of-days line', () => {
    const streak = buildTrustEvidence(
      { ...zeroMetrics(), loginDays: 30, loginStreakDays: 4, lastLoginAt: '2026-06-28' },
      NOW,
    ).find((e) => e.type === 'engagement-login-streak');
    expect(streak?.details).toBeUndefined();
  });

  it('never surfaces the privacy-excluded plugins (Mood, ClickLog, Unlock)', () => {
    const everything: TrustSignalMetrics = {
      loginDays: 3,
      loginStreakDays: 3,
      loginEvents: 3,
      lastLoginAt: '2026-06-28',
      socketRelayCompletedTrades: 3,
      socketRelayRequestsOpened: 3,
      serviceCreditsDistinctPayers: 3,
      serviceCreditsCompletedReceived: 3,
      serviceCreditsDisputesAgainst: 0,
      lighthouseMatchesAccepted: 3,
      trustTransportTripsCompleted: 3,
      skillsHuntSubmissionsAccepted: 3,
      skillUpCohortsCompleted: 3,
      chymeRoomsJoined: 3,
      directoryProfilesClaimed: 3,
      whatWorksEndorsements: 3,
      peerProgrammingCohortsJoined: 3,
      contributionsConfirmed: 3,
      foundationConnectionsAsProvider: 3,
      recurringActivityCounterparties: 3,
    };
    const blob = buildTrustEvidence(everything, NOW)
      .map((e) => `${e.type} ${e.summary}`)
      .join(' ')
      .toLowerCase();
    for (const banned of ['mood', 'click', 'gentle', 'unlock']) {
      expect(blob).not.toContain(banned);
    }
  });
});
