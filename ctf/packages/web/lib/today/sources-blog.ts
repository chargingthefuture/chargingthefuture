import { SE_MEMBER_STORY_COLLECTION, seStoriesForDay, seStoryOpening, seStoryQueue, type SeStoryPost, type SeTodayCard } from '@ctf/shared';
import { readBlogPosts } from 'lib/daily-posts/source';
import { listExclusions } from 'lib/daily-posts/repository';
import { reportError } from 'lib/observability/report';
import { listStoryCommentTimes } from 'lib/fireside/story-comments';
import { action, card, startOfTodayIso } from './card';
import { memberStoryCards, readMemberStories } from './sources-member';

// Stories from the blog (3.1.0 plan, Today): the blog's posts and the owner's Quora answers, then
// members' own writing (sources-member.ts), five a day, the same five for everyone (seStoriesForDay),
// each with This helped me. A blog that cannot
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

// The blog's posts, then the members' stories that may show, as one release order.
async function storyQueue() {
  const read = await readBlogPosts();
  if (!read.ok) throw new Error(read.reason);
  const members = await readMemberStories();
  return { queue: seStoryQueue(read.posts, members.stories), writers: members.writers };
}

function blogCard(post: SeStoryPost, createdAtIso: string, times: Map<string, string[]>): SeTodayCard {
  return {
    ...card({
      source: 'blog-story',
      sourceId: post.slug,
      kind: 'story',
      label: storyLabel(post),
      title: post.title,
      body: seStoryOpening(post.text),
      createdAtIso,
      href: post.url,
      // As on the board: This helped me, with Save and Hide beside it. The title opens the sheet, whose
      // "Open in the blog" link reads the post.
      actions: [action('helped-me', 'This helped me', post.url)],
    }),
    commentTimesIso: times.get(post.slug) ?? [],
  };
}

export async function blogStories(now = new Date()): Promise<SeTodayCard[]> {
  const { queue, writers } = await storyQueue();
  const day = startOfTodayIso(now).slice(0, 10);
  const excluded = await leftOut();
  const today = seStoriesForDay(queue, day).filter((post) => !excluded.has(post.slug));
  if (today.length === 0) return [];
  const createdAtIso = startOfTodayIso(now);
  const blog = today.filter((post) => !isMember(post));
  const times = blog.length > 0 ? await commentTimes(blog.map((post) => post.slug)) : new Map<string, string[]>();
  const members = await memberStoryCards(today.filter(isMember), writers, createdAtIso);
  return [...blog.map((post) => blogCard(post, createdAtIso, times)), ...members];
}

// How many stories open at the next midnight, for the line under the last card: tomorrow's share of
// the release less any post the owner left out. Posts the blog publishes tomorrow are not known yet.
export async function storiesTomorrow(now = new Date()): Promise<number> {
  const { queue } = await storyQueue();
  const tomorrow = new Date(Date.parse(startOfTodayIso(now)) + 86_400_000).toISOString().slice(0, 10);
  const excluded = await leftOut();
  return seStoriesForDay(queue, tomorrow).filter((post) => !excluded.has(post.slug) && post.date.slice(0, 10) !== tomorrow).length;
}
