// Stories on Today (3.1.0 plan, Today): the blog's posts and the owner's Quora answers, then members'
// own imported writing, released five a day, oldest first, so every member sees the same ones on the
// same day. A post published on the blog that day joins that day's stories as well. When every story
// has been released the order starts again from the oldest. Shared by web and Android.
//
// The list comes from the blog's build (wiki-site scripts/src/build-posts-json.ts), published at
// SE_BLOG_POSTS_URL with every listed post and Quora archive entry, invite posts left out.

export const SE_BLOG_POSTS_URL = 'https://chargingthefuture.github.io/chargingthefuture/posts.json';

// The first day stories were released, and how many each day.
export const SE_STORY_RELEASE_START = '2026-11-03';
export const SE_STORIES_PER_DAY = 5;

export type SeStoryPost = {
  number: number;
  slug: string;
  title: string;
  date: string;
  collection: string;
  url: string;
  text: string;
};

function isStoryPost(value: unknown): value is SeStoryPost {
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

// Members' own writing, brought in through the Knowledge Library, rides in the same order under this
// collection. It never jumps the queue on the day it was accepted, the way a new blog post does.
export const SE_MEMBER_STORY_COLLECTION = 'member';

export type SeMemberStory = { id: string; title: string; text: string; acceptedAtIso: string };

// The release order: the blog's posts and Quora answers first, by their /feed number, then members'
// writing in the order it was accepted (the 3.1 plan: "then members' imports"). A member's story is
// numbered after the last post, so adding one never moves a post already in the order.
export function seStoryQueue(posts: readonly SeStoryPost[], members: readonly SeMemberStory[]): SeStoryPost[] {
  const last = posts.reduce((max, post) => Math.max(max, post.number), 0);
  const ordered = [...members].sort((a, b) => a.acceptedAtIso.localeCompare(b.acceptedAtIso) || a.id.localeCompare(b.id));
  return [
    ...posts,
    ...ordered.map((story, index) => ({
      number: last + index + 1,
      slug: seMemberStorySlug(story.id),
      title: story.title,
      date: story.acceptedAtIso,
      collection: SE_MEMBER_STORY_COLLECTION,
      url: '',
      text: story.text,
    })),
  ];
}

const MEMBER_SLUG = 'member-';

export function seMemberStorySlug(id: string): string {
  return `${MEMBER_SLUG}${id}`;
}

// The member story id behind a slug, or null for a blog post.
export function seMemberStoryId(slug: string): string | null {
  return slug.startsWith(MEMBER_SLUG) ? slug.slice(MEMBER_SLUG.length) : null;
}

// The posts in a posts.json body, oldest first by their /feed number. Anything malformed is left out.
export function seParseStoryPosts(body: unknown): SeStoryPost[] | null {
  const list = (body as { posts?: unknown } | null)?.posts;
  if (!Array.isArray(list)) return null;
  return list.filter(isStoryPost).sort((a, b) => a.number - b.number);
}

// The calendar day of a moment, as YYYY-MM-DD, in the reader's own time zone when run on a phone.
export function seLocalDay(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

// Which day of the release a calendar day is: 0 on the first day, negative before it.
export function seStoryDayIndex(day: string): number {
  return dayNumber(day) - dayNumber(SE_STORY_RELEASE_START);
}

// The stories released on a day: that day's five from the oldest-first order, then any post the blog
// published that day (never a member's story, which waits its turn). Before the first day there are
// none.
export function seStoriesForDay(posts: readonly SeStoryPost[], day: string): SeStoryPost[] {
  const index = seStoryDayIndex(day);
  if (index < 0 || posts.length === 0) return [];
  const released: SeStoryPost[] = [];
  for (let offset = 0; offset < Math.min(SE_STORIES_PER_DAY, posts.length); offset += 1) {
    released.push(posts[(index * SE_STORIES_PER_DAY + offset) % posts.length]);
  }
  const fresh = posts.filter(
    (post) => post.collection !== SE_MEMBER_STORY_COLLECTION && post.date.slice(0, 10) === day && !released.includes(post),
  );
  return [...released, ...fresh];
}

// A short opening for a story card: the first paragraph, cut at a word near the limit.
export function seStoryOpening(text: string, max = 280): string {
  const first = text.split(/\n\s*\n/).map((part) => part.trim()).find((part) => part.length > 0) ?? '';
  const flat = first.replace(/\s+/g, ' ');
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}
