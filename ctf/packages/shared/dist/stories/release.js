// Stories on Today (3.1.0 plan, Today): the blog's posts and the owner's Quora answers, with members'
// own imported writing beside them (seStoriesWithMembers), released five a day, oldest first, so
// every member sees the same ones on the same day. A post published on the blog that day joins that day's stories as well. When every story
// has been released the order starts again from the oldest. Shared by web and Android.
//
// The list comes from the blog's build (wiki-site scripts/src/build-posts-json.ts), published at
// SE_BLOG_POSTS_URL with every listed post and Quora archive entry, invite posts left out.
export const SE_BLOG_POSTS_URL = 'https://chargingthefuture.github.io/chargingthefuture/posts.json';
// The first day stories were released, and how many each day.
export const SE_STORY_RELEASE_START = '2026-11-03';
export const SE_STORIES_PER_DAY = 5;
const STORY_FIELDS = [
    ['number', 'number'],
    ['slug', 'string'],
    ['title', 'string'],
    ['date', 'string'],
    ['collection', 'string'],
    ['url', 'string'],
    ['text', 'string'],
];
function isStoryPost(value) {
    if (!value || typeof value !== 'object')
        return false;
    const post = value;
    return STORY_FIELDS.every(([field, type]) => typeof post[field] === type) && (post.teaser === undefined || typeof post.teaser === 'string');
}
// Members' own writing, brought in through the Knowledge Library (owner decisions on the 3.1 plan,
// 2026-11-16): mixed in with the blog's posts rather than queued after them. Up to five member stories
// a day, oldest acceptance first, beside the day's blog stories; with fewer waiting, what there is.
// Each story has one day, worked out the same way for everyone, and never the day it was accepted.
export const SE_MEMBER_STORY_COLLECTION = 'member';
export const SE_MEMBER_STORIES_PER_DAY = 5;
// The member stories whose day it is. Stories take the days in acceptance order, five to a day, each
// from the day after it was accepted and never before the release started.
export function seMemberStoriesForDay(members, day) {
    const index = seStoryDayIndex(day);
    if (index < 0)
        return [];
    const ordered = [...members].sort((a, b) => a.acceptedAtIso.localeCompare(b.acceptedAtIso) || a.id.localeCompare(b.id));
    const shown = [];
    let current = 0;
    let used = 0;
    for (const story of ordered) {
        const eligible = Math.max(0, seStoryDayIndex(story.acceptedAtIso.slice(0, 10)) + 1);
        if (eligible > current)
            [current, used] = [eligible, 0];
        if (used === SE_MEMBER_STORIES_PER_DAY)
            [current, used] = [current + 1, 0];
        if (current > index)
            break;
        if (current === index)
            shown.push(story);
        used += 1;
    }
    return shown;
}
export function seMemberStoryPost(story) {
    return {
        number: 0,
        slug: seMemberStorySlug(story.id),
        title: story.title,
        date: story.acceptedAtIso,
        collection: SE_MEMBER_STORY_COLLECTION,
        url: '',
        text: story.text,
    };
}
// The day's stories with members' writing beside them: the blog's day as before, then the member
// stories whose day it is.
export function seStoriesWithMembers(posts, members, day) {
    return [...seStoriesForDay(posts, day), ...seMemberStoriesForDay(members, day).map(seMemberStoryPost)];
}
const MEMBER_SLUG = 'member-';
export function seMemberStorySlug(id) {
    return `${MEMBER_SLUG}${id}`;
}
// The member story id behind a slug, or null for a blog post.
export function seMemberStoryId(slug) {
    return slug.startsWith(MEMBER_SLUG) ? slug.slice(MEMBER_SLUG.length) : null;
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
// A web address in a post's text, which reads as noise on a card: one with http or www in front,
// even when it runs straight on from a word ("joinhttps://…"), and one with no prefix that has a
// path after its name ("qr.ae/pYRt…"). A site name alone, such as lagatos.com, reads as a name and stays.
const ADDRESS = /\(?(?:https?:\/\/|www\.)\S+|\(?\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/gi;
function withoutAddresses(text) {
    return text.replace(ADDRESS, ' ').replace(/[ \t]+/g, ' ').replace(/ ([.,;:!?])/g, '$1').trim();
}
// A paragraph worth opening a card with: words left once its addresses are gone, and not a line that
// only leads into an address ("The blog has a new page:").
function isOpeningParagraph(part) {
    return /[\p{L}\p{N}]/u.test(part) && !part.endsWith(':');
}
// A short opening for a story card: the first paragraph with words in it once bare addresses are taken
// out, cut at a word near the limit.
export function seStoryOpening(text, max = 280) {
    const parts = text.split(/\n\s*\n/).map(withoutAddresses);
    const first = parts.find(isOpeningParagraph) ?? parts.find((part) => /[\p{L}\p{N}]/u.test(part)) ?? '';
    const flat = first.replace(/\s+/g, ' ');
    if (flat.length <= max)
        return flat;
    const cut = flat.slice(0, max);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}
// A story card's text: the post's teaser where the blog gives one, otherwise the opening of the post.
// Bare addresses are taken out of either.
export function seStoryCardBody(post) {
    const teaser = withoutAddresses((post.teaser ?? '').replace(/\s+/g, ' '));
    return /[\p{L}\p{N}]/u.test(teaser) ? teaser : seStoryOpening(post.text);
}
