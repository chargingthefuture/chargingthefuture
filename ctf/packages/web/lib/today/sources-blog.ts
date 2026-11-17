import { SE_MEMBER_STORY_COLLECTION, seNextDay, seStoryCardBody, seStoriesWithMembers, type SeTodayDay, type SeStoryPost, type SeTodayCard } from '@ctf/shared';
import { readBlogPosts } from 'lib/daily-posts/source';
import { listExclusions } from 'lib/daily-posts/repository';
import { reportError } from 'lib/observability/report';
import { listStoryCommentTimes } from 'lib/fireside/story-comments';
import { action, card, utcTodayDay } from './card';
import { memberStoryCards, readMemberStories } from './sources-member';

// Stories from the blog (3.1.0 plan, Today): the blog's posts and the owner's Quora answers, with
// members' own writing beside them (sources-member.ts), five a day, the same five for everyone on the
// same day (seStoriesWithMembers), the day turning at each
// member's own midnight (SeTodayDay), each with This helped me. A blog that cannot
// be read is reported as this source failing. A post the owner left out on Daily Posts is skipped
// (its day shows one story fewer, and every other post keeps its day).

// The posts left out on Daily Posts. If that list cannot be read, every story shows and the cause is
// reported: a story too many is better than none.
async function leftOut(): Promise<Set<string>> {
  try {
    return await listExclusions();
  } catch (error) {
    reportError(error, { area: 'today', op: 'story_exclusions' });
    return new Set();
  }
}

// When each story's readable Fireside comments were written, so a story the member marked done comes
// back when somebody has written since. A failed read leaves the times out and is reported: the
// stories still show.
async function commentTimes(slugs: string[]): Promise<Map<string, string[]>> {
  try {
    return await listStoryCommentTimes(slugs);
  } catch (error) {
    reportError(error, { area: 'today', op: 'story_comment_times' });
    return new Map();
  }
}

function storyLabel(post: SeStoryPost): string {
  return post.collection === 'archive/quora' ? 'Story · from Quora' : 'Story · from the blog';
}

function isMember(post: SeStoryPost): boolean {
  return post.collection === SE_MEMBER_STORY_COLLECTION;
}

// The stories released on a day: the blog's, with the member story whose day it is in its slot.
async function storiesOn(day: string) {
  const read = await readBlogPosts();
  if (!read.ok) throw new Error(read.reason);
  const members = await readMemberStories();
  return { stories: seStoriesWithMembers(read.posts, members.stories, day), writers: members.writers, signedOut: members.signedOut };
}

function blogCard(post: SeStoryPost, createdAtIso: string, times: Map<string, string[]>): SeTodayCard {
  return {
    ...card({
      source: 'blog-story',
      sourceId: post.slug,
      kind: 'story',
      label: storyLabel(post),
      title: post.title,
      // The post's teaser from the blog, or its opening without bare addresses.
      body: seStoryCardBody(post),
      createdAtIso,
      href: post.url,
      // As on the board: This helped me, with Save and Hide beside it. The title opens the post on the
      // blog; the text opens the sheet, whose "Open in the blog" link reads the post too.
      actions: [action('helped-me', 'This helped me', post.url)],
    }),
    commentTimesIso: times.get(post.slug) ?? [],
  };
}

// Signed out, a member's story shows only when its writer agreed to the words that name visitors.
export async function blogStories(day: SeTodayDay = utcTodayDay(), audience: 'members' | 'signed-out' = 'members'): Promise<SeTodayCard[]> {
  const { stories, writers, signedOut } = await storiesOn(day.day);
  const excluded = await leftOut();
  const today = stories.filter((post) => !excluded.has(post.slug) && (audience === 'members' || !isMember(post) || signedOut.has(post.slug)));
  if (today.length === 0) return [];
  const createdAtIso = day.startIso;
  const blog = today.filter((post) => !isMember(post));
  const times = blog.length > 0 ? await commentTimes(blog.map((post) => post.slug)) : new Map<string, string[]>();
  const members = await memberStoryCards(today.filter(isMember), writers, createdAtIso);
  return [...blog.map((post) => blogCard(post, createdAtIso, times)), ...members];
}

// How many stories open at the member's next midnight, for the line under the last card: tomorrow's
// share of the release less any post the owner left out. Posts the blog publishes tomorrow are not known yet.
export async function storiesTomorrow(day: SeTodayDay = utcTodayDay()): Promise<number> {
  const tomorrow = seNextDay(day.day);
  const { stories } = await storiesOn(tomorrow);
  const excluded = await leftOut();
  return stories.filter((post) => !excluded.has(post.slug) && post.date.slice(0, 10) !== tomorrow).length;
}
