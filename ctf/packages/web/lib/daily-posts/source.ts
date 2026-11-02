// The blog's list of posts, read from the file its build publishes (wiki-site
// scripts/src/build-posts-json.ts). It carries every listed post and Quora archive entry, invite
// posts left out, with its number on the blog's /feed and its full text in the same plain-text form
// as the full paste sheet. A post published on the blog reaches this screen on the next read, with
// no change here.

export const BLOG_POSTS_URL = 'https://chargingthefuture.github.io/chargingthefuture/posts.json';

export type BlogPost = {
  number: number;
  slug: string;
  title: string;
  date: string;
  collection: string;
  url: string;
  text: string;
};

export type BlogPostsRead = { ok: true; posts: BlogPost[] } | { ok: false; reason: string };

function isBlogPost(value: unknown): value is BlogPost {
  if (!value || typeof value !== 'object') return false;
  const post = value as Record<string, unknown>;
  return (
    typeof post.number === 'number' &&
    typeof post.slug === 'string' &&
    typeof post.title === 'string' &&
    typeof post.date === 'string' &&
    typeof post.collection === 'string' &&
    typeof post.url === 'string' &&
    typeof post.text === 'string'
  );
}

/** Never throws: a blog that cannot be read leaves the rest of the screen working, with the reason. */
export async function readBlogPosts(): Promise<BlogPostsRead> {
  let response: Response;
  try {
    // Ten minutes: the blog publishes a few times a day, and the screen opens a few times a day.
    response = await fetch(BLOG_POSTS_URL, { next: { revalidate: 600 } });
  } catch (error) {
    return { ok: false, reason: `The blog could not be reached at ${BLOG_POSTS_URL}: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) {
    return { ok: false, reason: `The blog answered ${response.status} for ${BLOG_POSTS_URL}. The post list is published by the blog's next build.` };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return { ok: false, reason: `The blog's post list is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const list = (body as { posts?: unknown })?.posts;
  if (!Array.isArray(list)) {
    return { ok: false, reason: 'The blog\'s post list has no "posts" array.' };
  }
  const posts = list.filter(isBlogPost).sort((a, b) => a.number - b.number);
  return { ok: true, posts };
}

/** What one copy control hands over: the title, the full post, and the link on its own line. */
export function blogPostPasteText(post: Pick<BlogPost, 'title' | 'text' | 'url'>): string {
  // "Full post:" before the address keeps the label the paste sheets use; an address alone on its
  // own line is what Quora's editor turns into a preview card.
  return `${post.title}\n\n${post.text.trim()}\n\nFull post: ${post.url}`;
}
