import { seStoriesForDay, seStoryOpening, type SeStoryPost, type SeTodayCard } from '@ctf/shared';
import { readBlogPosts } from 'lib/daily-posts/source';
import { listExclusions } from 'lib/daily-posts/repository';
import { reportError } from 'lib/observability/report';
import { action, card, startOfTodayIso } from './card';

// Stories from the blog (3.1.0 plan, Today): the blog's posts and the owner's Quora answers, five a
// day, the same five for everyone (seStoriesForDay), each with Read. A blog that cannot be read is
// reported as this source failing. A post the owner left out on Daily Posts is skipped (its day shows
// one story fewer, and every other post keeps its day).

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

function storyLabel(post: SeStoryPost): string {
  return post.collection === 'archive/quora' ? 'Story · from Quora' : 'Story · from the blog';
}

export async function blogStories(now = new Date()): Promise<SeTodayCard[]> {
  const read = await readBlogPosts();
  if (!read.ok) throw new Error(read.reason);
  const day = startOfTodayIso(now).slice(0, 10);
  const excluded = await leftOut();
  const today = seStoriesForDay(read.posts, day).filter((post) => !excluded.has(post.slug));
  if (today.length === 0) return [];
  const createdAtIso = startOfTodayIso(now);
  return today.map((post) =>
    card({
      source: 'blog-story',
      sourceId: post.slug,
      kind: 'story',
      label: storyLabel(post),
      title: post.title,
      body: seStoryOpening(post.text),
      createdAtIso,
      href: post.url,
      actions: [action('open', 'Read it', post.url)],
    }),
  );
}
