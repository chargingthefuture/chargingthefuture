import { describe, expect, it, vi } from 'vitest';
import { seMemberStoryId, seStoriesForDay, seStoryQueue, SE_STORY_RELEASE_START, type SeStoryPost } from '@ctf/shared';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));

import { memberStoryTitle } from 'lib/comic/shared-writing-stories';

function post(number: number, date = '2026-01-01'): SeStoryPost {
  return { number, slug: `post-${number}`, title: `Post ${number}`, date, collection: 'posts', url: `https://blog/${number}`, text: 'Text' };
}

const members = [
  { id: 'b', title: 'Second', text: 'Two', acceptedAtIso: '2026-11-02T00:00:00.000Z' },
  { id: 'a', title: 'First', text: 'One', acceptedAtIso: '2026-11-01T00:00:00.000Z' },
];

describe('members stories in the release order', () => {
  it('come after every blog post, oldest acceptance first, numbered after the last post', () => {
    const queue = seStoryQueue([post(1), post(7)], members);
    expect(queue.map((item) => item.slug)).toEqual(['post-1', 'post-7', 'member-a', 'member-b']);
    expect(queue.slice(2).map((item) => item.number)).toEqual([8, 9]);
    expect(seMemberStoryId('member-a')).toBe('a');
    expect(seMemberStoryId('post-1')).toBeNull();
  });

  it('leave the blog posts on their days', () => {
    const posts = Array.from({ length: 12 }, (_, index) => post(index + 1));
    const day = '2026-11-04';
    expect(seStoriesForDay(seStoryQueue(posts, members), day).slice(0, 5)).toEqual(seStoriesForDay(posts, day).slice(0, 5));
  });

  it('never join the day they were accepted the way a new blog post does', () => {
    const accepted = [{ id: 'c', title: 'New', text: 'Three', acceptedAtIso: `${SE_STORY_RELEASE_START}T00:00:00.000Z` }];
    const released = seStoriesForDay(seStoryQueue(Array.from({ length: 10 }, (_, index) => post(index + 1)), accepted), SE_STORY_RELEASE_START);
    expect(released.map((item) => item.slug)).not.toContain('member-c');
  });
});

describe('memberStoryTitle', () => {
  it('uses the question when there is one, and the opening words otherwise', () => {
    expect(memberStoryTitle('What helped?', 'Body')).toBe('What helped?');
    expect(memberStoryTitle(null, 'Short body')).toBe('Short body');
    expect(memberStoryTitle(null, 'word '.repeat(40)).endsWith('…')).toBe(true);
  });
});
