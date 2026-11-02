// Stories on Today (3.1.0 plan, Today): the blog's posts and the owner's Quora answers, released five
// a day, oldest first, so every member sees the same ones on the same day. A post published on the
// blog that day joins that day's stories as well. When every post has been released the order
// starts again from the oldest. Shared by web and Android, and by the puzzles built from them.
//
// The list comes from the blog's build (wiki-site scripts/src/build-posts-json.ts), published at
// SE_BLOG_POSTS_URL with every listed post and Quora archive entry, invite posts left out.
export const SE_BLOG_POSTS_URL = 'https://chargingthefuture.github.io/chargingthefuture/posts.json';
// The first day stories were released, and how many each day.
export const SE_STORY_RELEASE_START = '2026-11-03';
export const SE_STORIES_PER_DAY = 5;
function isStoryPost(value) {
    if (!value || typeof value !== 'object')
        return false;
    const post = value;
    return (typeof post.number === 'number' &&
        typeof post.slug === 'string' &&
        typeof post.title === 'string' &&
        typeof post.date === 'string' &&
        typeof post.collection === 'string' &&
        typeof post.url === 'string' &&
        typeof post.text === 'string');
}
// The posts in a posts.json body, oldest first by their /feed number. Anything malformed is left out.
export function seParseStoryPosts(body) {
    const list = body?.posts;
    if (!Array.isArray(list))
        return null;
    return list.filter(isStoryPost).sort((a, b) => a.number - b.number);
}
// The calendar day of a moment, as YYYY-MM-DD, in the reader's own time zone when run on a phone.
export function seLocalDay(now = new Date()) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}
function dayNumber(day) {
    return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}
// Which day of the release a calendar day is: 0 on the first day, negative before it.
export function seStoryDayIndex(day) {
    return dayNumber(day) - dayNumber(SE_STORY_RELEASE_START);
}
// The stories released on a day: that day's five from the oldest-first order, then any post the blog
// published that day. Before the first day there are none.
export function seStoriesForDay(posts, day) {
    const index = seStoryDayIndex(day);
    if (index < 0 || posts.length === 0)
        return [];
    const released = [];
    for (let offset = 0; offset < Math.min(SE_STORIES_PER_DAY, posts.length); offset += 1) {
        released.push(posts[(index * SE_STORIES_PER_DAY + offset) % posts.length]);
    }
    const fresh = posts.filter((post) => post.date.slice(0, 10) === day && !released.includes(post));
    return [...released, ...fresh];
}
// A short opening for a story card: the first paragraph, cut at a word near the limit.
export function seStoryOpening(text, max = 280) {
    const first = text.split(/\n\s*\n/).map((part) => part.trim()).find((part) => part.length > 0) ?? '';
    const flat = first.replace(/\s+/g, ' ');
    if (flat.length <= max)
        return flat;
    const cut = flat.slice(0, max);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}
