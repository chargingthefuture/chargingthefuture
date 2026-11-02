// The puzzles, built on the phone from the blog's public post list, as the web's /games page builds
// them on the server: today's stories first, then every other post, newest first.

import { useCallback, useEffect, useState } from 'react';
import { SE_BLOG_POSTS_URL, sePuzzleFor, seParseStoryPosts, seStoriesForDay, type SePuzzle, type SeStoryPost } from '@ctf/shared';

export type GameEntry = { slug: string; title: string; url: string; puzzle: SePuzzle };

export type GamePosts = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; today: GameEntry[]; rest: GameEntry[] };

function entries(list: readonly SeStoryPost[], posts: readonly SeStoryPost[]): GameEntry[] {
  return list.flatMap((post) => {
    const puzzle = sePuzzleFor(post, posts);
    return puzzle ? [{ slug: post.slug, title: post.title, url: post.url, puzzle }] : [];
  });
}

function build(posts: SeStoryPost[]): GamePosts {
  const todayPosts = seStoriesForDay(posts, new Date().toISOString().slice(0, 10));
  const todaySlugs = new Set(todayPosts.map((post) => post.slug));
  const rest = [...posts].reverse().filter((post) => !todaySlugs.has(post.slug));
  return { kind: 'ready', today: entries(todayPosts, posts), rest: entries(rest, posts) };
}

export function useGamePosts() {
  const [state, setState] = useState<GamePosts>({ kind: 'loading' });
  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(SE_BLOG_POSTS_URL);
      if (!res.ok) throw new Error(`The blog answered ${res.status} for ${SE_BLOG_POSTS_URL}.`);
      const posts = seParseStoryPosts(await res.json());
      if (!posts) throw new Error('The blog\'s post list has no "posts" array.');
      setState(build(posts));
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, []);
  useEffect(() => void load(), [load]);
  return { state, reload: load };
}
