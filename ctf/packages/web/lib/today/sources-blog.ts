import { seStoriesForDay, seStoryOpening, sePuzzleFor, type SeStoryPost, type SeTodayCard } from '@ctf/shared';
import { readBlogPosts } from 'lib/daily-posts/source';
import { action, card, startOfTodayIso } from './card';

// Stories from the blog (3.1.0 plan, Today): the blog's posts and the owner's Quora answers, five a
// day, the same five for everyone (seStoriesForDay), each with Read and its puzzle; and one Game
// card that opens the day's puzzles. A blog that cannot be read is reported as this source failing.

function storyLabel(post: SeStoryPost): string {
  return post.collection === 'archive/quora' ? 'Story · from Quora' : 'Story · from the blog';
}

export async function blogStories(now = new Date()): Promise<SeTodayCard[]> {
  const read = await readBlogPosts();
  if (!read.ok) throw new Error(read.reason);
  const day = startOfTodayIso(now).slice(0, 10);
  const today = seStoriesForDay(read.posts, day);
  if (today.length === 0) return [];
  const createdAtIso = startOfTodayIso(now);
  const stories = today.map((post) =>
    card({
      source: 'blog-story',
      sourceId: post.slug,
      kind: 'story',
      label: storyLabel(post),
      title: post.title,
      body: seStoryOpening(post.text),
      createdAtIso,
      href: post.url,
      actions: [
        action('open', 'Read it', post.url),
        ...(sePuzzleFor(post, read.posts) ? [action('open', 'Play its puzzle', `/games?story=${encodeURIComponent(post.slug)}`)] : []),
      ],
    }),
  );
  const playable = today.filter((post) => sePuzzleFor(post, read.posts)).length;
  const game = card({
    source: 'games',
    sourceId: day,
    kind: 'game',
    label: "Today's puzzles",
    title: `${playable} puzzle${playable === 1 ? '' : 's'} from today's stories`,
    body: 'A word taken out, lines out of order, or which post a line came from. Then keep playing through every post on the blog.',
    createdAtIso,
    href: '/games',
    actions: [action('open', 'Play', '/games')],
  });
  return playable > 0 ? [game, ...stories] : stories;
}
