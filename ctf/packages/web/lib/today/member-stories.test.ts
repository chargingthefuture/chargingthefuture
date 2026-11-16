import { describe, expect, it, vi } from 'vitest';
import {
  SE_MEMBER_STORY_CONSENT_VERSION,
  SE_STORY_RELEASE_START,
  seMemberStoriesForDay,
  seMemberStoryId,
  seMemberStoryShownSignedOut,
  seStoriesForDay,
  seStoriesWithMembers,
  type SeStoryPost,
} from '@ctf/shared';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));

import { memberStoryTitle } from 'lib/comic/shared-writing-stories';

function post(number: number, date = '2026-01-01'): SeStoryPost {
  return { number, slug: `post-${number}`, title: `Post ${number}`, date, collection: 'posts', url: `https://blog/${number}`, text: 'Text' };
}

function story(id: string, acceptedDay: string) {
  return { id, title: id, text: id, acceptedAtIso: `${acceptedDay}T12:00:00.000Z` };
}

const DAY0 = SE_STORY_RELEASE_START;
const DAY1 = '2026-11-04';
const DAY2 = '2026-11-05';

describe('members stories beside the blog stories', () => {
  it('show up to five a day, oldest acceptance first, from the day after acceptance', () => {
    const members = Array.from({ length: 7 }, (_, index) => story(`s${index}`, '2026-10-01'));
    expect(seMemberStoriesForDay(members, DAY0).map((item) => item.id)).toEqual(['s0', 's1', 's2', 's3', 's4']);
    expect(seMemberStoriesForDay(members, DAY1).map((item) => item.id)).toEqual(['s5', 's6']);
    expect(seMemberStoriesForDay(members, DAY2)).toEqual([]);
  });

  it('never show on the day a story was accepted', () => {
    const members = [story('late', DAY1)];
    expect(seMemberStoriesForDay(members, DAY1)).toEqual([]);
    expect(seMemberStoriesForDay(members, DAY2).map((item) => item.id)).toEqual(['late']);
  });

  it('leave the blog stories as they were and come after them', () => {
    const posts = Array.from({ length: 12 }, (_, index) => post(index + 1));
    const mixed = seStoriesWithMembers(posts, [story('a', '2026-10-01')], DAY0);
    expect(mixed.slice(0, 5)).toEqual(seStoriesForDay(posts, DAY0));
    expect(mixed.map((item) => item.slug).slice(5)).toEqual(['member-a']);
    expect(seMemberStoryId('member-a')).toBe('a');
    expect(seMemberStoryId('post-1')).toBeNull();
  });

  it('show signed out only under the words that name visitors', () => {
    expect(seMemberStoryShownSignedOut(SE_MEMBER_STORY_CONSENT_VERSION)).toBe(true);
    expect(seMemberStoryShownSignedOut('2026-11-12.1')).toBe(false);
    expect(seMemberStoryShownSignedOut(null)).toBe(false);
  });
});

describe('memberStoryTitle', () => {
  it('uses the question when there is one, and the opening words otherwise', () => {
    expect(memberStoryTitle('What helped?', 'Body')).toBe('What helped?');
    expect(memberStoryTitle(null, 'Short body')).toBe('Short body');
    expect(memberStoryTitle(null, 'word '.repeat(40)).endsWith('…')).toBe(true);
  });
});
