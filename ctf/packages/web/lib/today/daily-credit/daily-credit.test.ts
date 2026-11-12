import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seDailyCreditDay, seDailyCreditPill, seDoneHelpers, sePickDailyCreditCard, type SeTodayCard } from '@ctf/shared';

const { mintGrant, insertServiceCreditsAudit, isUserUnlocked, repo } = vi.hoisted(() => ({
  mintGrant: vi.fn(),
  insertServiceCreditsAudit: vi.fn(),
  isUserUnlocked: vi.fn(),
  repo: {
    stampDailyCreditHelper: vi.fn(),
    markDailyCreditGranted: vi.fn(),
    markDailyCreditHeld: vi.fn(async () => undefined),
    listHeldDailyCredits: vi.fn(),
    claimHeldDailyCredit: vi.fn(),
  },
}));

vi.mock('lib/shared/credits-interface', () => ({ mintGrant, insertServiceCreditsAudit }));
vi.mock('lib/shared/unlock-interface', () => ({ isUserUnlocked }));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('./repository', () => repo);
vi.mock('lib/peer-programming/repository', () => ({}));
vi.mock('lib/peer-programming/goals', () => ({}));
vi.mock('lib/socket-relay/repository', () => ({}));
vi.mock('../windows', () => ({}));

import { DAILY_CREDIT_ACTOR_ID, grantDailyCredit, grantHeldDailyCredits } from './grant';
import { markDailyCredit } from './choose';

const ask = (id: string, createdAtIso: string, authorAccountId: string | null = 'a') => ({ id, createdAtIso, authorAccountId });

describe('sePickDailyCreditCard', () => {
  it('picks the oldest ask, the same for any order', () => {
    const list = [ask('socket-relay:b', '2026-11-05T00:00:00Z'), ask('peer-programming:a', '2026-11-01T00:00:00Z'), ask('socket-relay:c', '2026-11-09T00:00:00Z')];
    expect(sePickDailyCreditCard(list)?.id).toBe('peer-programming:a');
    expect(sePickDailyCreditCard([...list].reverse())?.id).toBe('peer-programming:a');
  });

  it('breaks a tie by card id and skips an ask with no author', () => {
    const at = '2026-11-01T00:00:00Z';
    expect(sePickDailyCreditCard([ask('socket-relay:z', at), ask('socket-relay:m', at)])?.id).toBe('socket-relay:m');
    expect(sePickDailyCreditCard([ask('trust-transport:a', '2026-10-01T00:00:00Z', null), ask('socket-relay:b', at)])?.id).toBe('socket-relay:b');
    expect(sePickDailyCreditCard([])).toBeNull();
  });

  it('keeps one day for everyone, in UTC', () => {
    expect(seDailyCreditDay(new Date('2026-11-11T23:30:00-05:00'))).toBe('2026-11-12');
  });

  it('words the line from the author, on the credit card only, for everyone but the author', () => {
    const credit = { dailyCredit: true, author: { accountId: 'a', handle: 'marisol_k' } };
    expect(seDailyCreditPill(credit, 'b')).toBe('+1 credit when marisol_k confirms it was done');
    expect(seDailyCreditPill(credit, null)).toBe('+1 credit when marisol_k confirms it was done');
    expect(seDailyCreditPill(credit, 'a')).toBeNull();
    expect(seDailyCreditPill({ ...credit, dailyCredit: false }, 'b')).toBeNull();
  });
});

describe('seDoneHelpers', () => {
  it('offers only the other members who answered I can help, in order', () => {
    const answers = [
      { accountId: 'asker', handle: 'me', kinds: ['help' as const], helpedConfirmed: false },
      { accountId: 'b', handle: 'teodor_b', kinds: ['know-someone' as const, 'help' as const], helpedConfirmed: false },
      { accountId: 'c', handle: 'ana', kinds: ['know-someone' as const], helpedConfirmed: false },
      { accountId: 'd', handle: 'ruth', kinds: ['help' as const], helpedConfirmed: false },
    ];
    expect(seDoneHelpers(answers, 'asker').map((answer) => answer.handle)).toEqual(['teodor_b', 'ruth']);
    expect(seDoneHelpers([], 'asker')).toEqual([]);
  });
});

describe('markDailyCredit', () => {
  const card = (id: string, kind: 'ask' | 'story', author = true) =>
    ({ id, kind, author: author ? { accountId: 'a', handle: 'h' } : null }) as SeTodayCard;

  it('flags that one ask and no other card', () => {
    const marked = markDailyCredit([card('socket-relay:1', 'ask'), card('socket-relay:2', 'ask'), card('blog:1', 'story')], 'socket-relay:1');
    expect(marked.map((item) => item.dailyCredit === true)).toEqual([true, false, false]);
    expect(markDailyCredit([card('socket-relay:1', 'ask')], null)[0].dailyCredit).toBeUndefined();
  });
});

describe('grantDailyCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mintGrant.mockResolvedValue({ governanceEventId: 'g1' });
  });

  it('creates 1 credit for an approved helper, keyed by card, day and helper', async () => {
    isUserUnlocked.mockResolvedValue(true);
    repo.stampDailyCreditHelper.mockResolvedValue('2026-11-11');
    const outcome = await grantDailyCredit({ cardId: 'socket-relay:1', askerUserId: 'asker', helperUserId: 'helper' });
    expect(outcome).toEqual({ status: 'granted', day: '2026-11-11' });
    expect(mintGrant).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: DAILY_CREDIT_ACTOR_ID, targetUserId: 'helper', amount: 1, idempotencyKey: 'today-daily-credit:socket-relay:1:2026-11-11:helper' }),
    );
    expect(insertServiceCreditsAudit).toHaveBeenCalledTimes(1);
  });

  it('holds the credit for a helper not yet approved', async () => {
    isUserUnlocked.mockResolvedValue(false);
    repo.stampDailyCreditHelper.mockResolvedValue('2026-11-11');
    expect(await grantDailyCredit({ cardId: 'socket-relay:1', askerUserId: 'asker', helperUserId: 'helper' })).toEqual({ status: 'held', day: '2026-11-11' });
    expect(repo.stampDailyCreditHelper).toHaveBeenCalledWith(expect.objectContaining({ status: 'held' }));
    expect(mintGrant).not.toHaveBeenCalled();
  });

  it('creates nothing for a card that never carried the credit, a second confirm, or the asker helping themself', async () => {
    isUserUnlocked.mockResolvedValue(true);
    repo.stampDailyCreditHelper.mockResolvedValue(null);
    expect((await grantDailyCredit({ cardId: 'socket-relay:9', askerUserId: 'asker', helperUserId: 'helper' })).status).toBe('not_credit_card');
    expect((await grantDailyCredit({ cardId: 'socket-relay:9', askerUserId: 'asker', helperUserId: 'asker' })).status).toBe('not_credit_card');
    expect((await grantDailyCredit({ cardId: 'socket-relay:9', askerUserId: 'asker', helperUserId: null })).status).toBe('not_credit_card');
    expect(mintGrant).not.toHaveBeenCalled();
  });

  it('puts a failed grant back to held', async () => {
    isUserUnlocked.mockResolvedValue(true);
    repo.stampDailyCreditHelper.mockResolvedValue('2026-11-11');
    mintGrant.mockRejectedValue(new Error('mint_budget_exceeded'));
    expect((await grantDailyCredit({ cardId: 'socket-relay:1', askerUserId: 'asker', helperUserId: 'helper' })).status).toBe('failed');
    expect(repo.markDailyCreditHeld).toHaveBeenCalledWith('2026-11-11');
  });
});

describe('grantHeldDailyCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mintGrant.mockResolvedValue({ governanceEventId: 'g1' });
  });

  it('grants each held credit once, with the same key as at the confirm', async () => {
    repo.listHeldDailyCredits.mockResolvedValue([{ day: '2026-11-10', cardId: 'peer-programming:1', authorUserId: 'asker' }, { day: '2026-11-11', cardId: 'socket-relay:2', authorUserId: 'asker' }]);
    repo.claimHeldDailyCredit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await grantHeldDailyCredits('helper')).toBe(1);
    expect(mintGrant).toHaveBeenCalledTimes(1);
    expect(mintGrant).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'today-daily-credit:peer-programming:1:2026-11-10:helper' }));
  });
});
