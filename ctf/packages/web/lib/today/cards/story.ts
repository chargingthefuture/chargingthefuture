import { readBlogPosts } from 'lib/daily-posts/source';
import { postRefFromUrl } from 'lib/fireside/card-thread';
import type { FiresidePostRef } from 'lib/fireside/types';

// A blog or Quora story card's post, for talking in its Fireside thread: found by the card's slug
// in the blog's posts.json, which carries the post's address and title. Null for any other card,
// and for a story the blog no longer lists.

const STORY_SOURCE = 'blog-story:';

export function isStoryCard(cardId: string): boolean {
  return cardId.startsWith(STORY_SOURCE);
}

export async function storyPostFor(cardId: string): Promise<{ post: FiresidePostRef; title: string } | null> {
  if (!isStoryCard(cardId)) return null;
  const slug = cardId.slice(STORY_SOURCE.length);
  const read = await readBlogPosts();
  if (!read.ok) throw new Error(`The blog's post list could not be read: ${read.reason}`);
  const found = read.posts.find((post) => post.slug === slug);
  const post = found ? postRefFromUrl(found.url) : null;
  return post && found ? { post, title: found.title } : null;
}
