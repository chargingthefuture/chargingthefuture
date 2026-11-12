export declare const SE_BLOG_POSTS_URL = "https://chargingthefuture.github.io/chargingthefuture/posts.json";
export declare const SE_STORY_RELEASE_START = "2026-11-03";
export declare const SE_STORIES_PER_DAY = 5;
export type SeStoryPost = {
    number: number;
    slug: string;
    title: string;
    date: string;
    collection: string;
    url: string;
    text: string;
};
export declare const SE_MEMBER_STORY_COLLECTION = "member";
export type SeMemberStory = {
    id: string;
    title: string;
    text: string;
    acceptedAtIso: string;
};
export declare function seStoryQueue(posts: readonly SeStoryPost[], members: readonly SeMemberStory[]): SeStoryPost[];
export declare function seMemberStorySlug(id: string): string;
export declare function seMemberStoryId(slug: string): string | null;
export declare function seParseStoryPosts(body: unknown): SeStoryPost[] | null;
export declare function seLocalDay(now?: Date): string;
export declare function seStoryDayIndex(day: string): number;
export declare function seStoriesForDay(posts: readonly SeStoryPost[], day: string): SeStoryPost[];
export declare function seStoryOpening(text: string, max?: number): string;
