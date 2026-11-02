import type { Metadata } from 'next';
import { sePuzzleFor, seStoriesForDay } from '@ctf/shared';
import { readBlogPosts } from '../../lib/daily-posts/source';
import { startOfTodayIso } from '../../lib/today/card';
import { GamesScreen, type GameEntry } from '../../components/se-frame/games/games-screen';

// The daily puzzles (3.1.0 plan, task 17): one puzzle for each post on the blog, today's five first.
// Built from the blog's public post list, so reading and playing need no account; progress is kept
// on the device only and nothing is sent anywhere.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Puzzles · Skills Economy' };

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ story?: string }> }) {
  const { story } = await searchParams;
  const read = await readBlogPosts();
  if (!read.ok) return <GamesScreen today={[]} rest={[]} start={null} failed={read.reason} />;
  const toEntry = (post: (typeof read.posts)[number]): GameEntry | null => {
    const puzzle = sePuzzleFor(post, read.posts);
    return puzzle ? { slug: post.slug, title: post.title, url: post.url, puzzle } : null;
  };
  const todayPosts = seStoriesForDay(read.posts, startOfTodayIso().slice(0, 10));
  const todaySlugs = new Set(todayPosts.map((post) => post.slug));
  const today = todayPosts.map(toEntry).filter((entry): entry is GameEntry => entry !== null);
  const rest = [...read.posts]
    .reverse()
    .filter((post) => !todaySlugs.has(post.slug))
    .map(toEntry)
    .filter((entry): entry is GameEntry => entry !== null);
  return <GamesScreen today={today} rest={rest} start={story ?? null} failed={null} />;
}
