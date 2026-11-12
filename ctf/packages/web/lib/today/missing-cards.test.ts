import { describe, expect, it, vi } from 'vitest';
import { seCardBlogNote, seCardOpensSheet, SE_CARD_WORDS } from '@ctf/shared';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));
vi.mock('lib/gdp/recognition', () => ({ recognizeCommunityValueIndex: vi.fn() }));
vi.mock('lib/peer-programming/repository', () => ({ getMyCohort: vi.fn() }));
vi.mock('lib/peer-programming/roster', () => ({ buildCohortRosters: vi.fn() }));
vi.mock('lib/lighthouse/repository', () => ({ listProperties: vi.fn() }));
vi.mock('lib/skill-up/repository', () => ({ listCohorts: vi.fn() }));
vi.mock('lib/identity/resolve-usernames', () => ({ resolveUsernames: vi.fn() }));

import { previousWeekStartIso, snapshotId, weekStartIso, weeklyChange } from 'lib/gdp/weekly-change';
import { getMyCohort } from 'lib/peer-programming/repository';
import { buildCohortRosters } from 'lib/peer-programming/roster';
import { cohortCard, withYouLine } from './sources-cohort';
import { hoursCard } from './sources-offers';
import { todayCardRule } from './lifetime';

describe('the Mutual Time offer card', () => {
  const event = {
    id: '6f1c2a4e-1b2c-4d5e-8f90-123456789abc',
    slug: 'abc123',
    title: 'Planning call',
    description: 'An hour to plan the next round.',
    meetingPluginName: 'Chyme',
    createdByUserId: 'admin-1',
    openedAtIso: '2026-11-09T15:00:00.000Z',
  };

  it('shows the title, the description and where the group meets, and links to the shared page', () => {
    const card = hoursCard(event);
    expect(card.id).toBe(`mutual-time:${event.id}`);
    expect(card.kind).toBe('offer');
    expect(card.body).toBe("An hour to plan the next round. We'll meet in Chyme.");
    expect(card.href).toBe('/mutual-time/abc123');
    expect(card.author).toBeNull();
  });

  it('names a survey with no title, and lasts as an offer does', () => {
    expect(hoursCard({ ...event, title: null, description: null }).title).toBe('Pick a time to meet');
    expect(todayCardRule('mutual-time')).toBe('offer');
  });
});

describe('the with you this week card', () => {
  it('spells out up to five names, then a count', () => {
    expect(withYouLine([], 0)).toBe('Nobody else is in it yet.');
    expect(withYouLine(['ana'], 1)).toBe('With you: ana.');
    expect(withYouLine(['ana', 'bo'], 2)).toBe('With you: ana and bo.');
    expect(withYouLine(['a', 'b', 'c', 'd', 'e'], 11)).toBe('With you: a, b, c, d, e and 6 more.');
    expect(withYouLine([], 3)).toBe('3 other members are in it with you.');
  });

  it("reads only the viewer's own cohort and leaves the viewer out of the names", async () => {
    vi.mocked(getMyCohort).mockResolvedValue({
      id: 'c-1', weekStartDate: '2026-11-09', cohortLabel: 'C1', fallbackOpen: false, topicId: null, memberCount: 3, isStanding: true, status: 'active', endedAtIso: null,
    });
    vi.mocked(buildCohortRosters).mockResolvedValue(new Map([['c-1', [{ userId: 'me', username: 'me_h' }, { userId: 'u2', username: 'ana' }, { userId: 'u3', username: 'bo' }]]]));
    const [card] = await cohortCard({ userId: 'me', isAdmin: false }, new Date('2026-11-11T12:00:00Z'));
    expect(getMyCohort).toHaveBeenCalledWith('me');
    expect(card.id).toBe('peer-programming-cohort:c-1:2026-11-09');
    expect(card.title).toBe('Cohort C1');
    expect(card.body).toBe('With you: ana and bo.');
    expect(card.href).toBe('/apps/peer-programming?cohortId=c-1&tab=goals');
    expect(seCardOpensSheet(card)).toBe(false);
  });

  it('shows nothing to a member in no cohort or an ended one', async () => {
    vi.mocked(getMyCohort).mockResolvedValueOnce(null);
    expect(await cohortCard({ userId: 'me', isAdmin: false })).toEqual([]);
  });
});

describe('the Community Value Index this week', () => {
  it('weeks start on Monday, UTC', () => {
    expect(weekStartIso(new Date('2026-11-11T12:00:00Z'))).toBe('2026-11-09');
    expect(weekStartIso(new Date('2026-11-15T23:00:00Z'))).toBe('2026-11-09');
    expect(previousWeekStartIso('2026-11-09')).toBe('2026-11-02');
  });

  it('is the live index less last week, never below zero, and nothing without last week', () => {
    expect(weeklyChange(104.4, 100)).toBe(4);
    expect(weeklyChange(90, 100)).toBe(0);
    expect(weeklyChange(104, null)).toBeNull();
  });

  it('writes the same row id the weekly script does', () => {
    expect(snapshotId('2026-11-09')).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('the note under a blog story composer', () => {
  it('shows only on the public conversation of a blog story', () => {
    expect(seCardBlogNote('blog-story:https://example.org/post', true)).toBe(SE_CARD_WORDS.blogNote);
    expect(SE_CARD_WORDS.blogNote).toBe('Your comment can also appear under this post on the blog.');
    expect(seCardBlogNote('blog-story:https://example.org/post', false)).toBeNull();
    expect(seCardBlogNote('lighthouse:1', true)).toBeNull();
  });
});
