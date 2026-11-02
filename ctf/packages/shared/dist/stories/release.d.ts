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
export declare function seParseStoryPosts(body: unknown): SeStoryPost[] | null;
export declare function seLocalDay(now?: Date): string;
export declare function seStoryDayIndex(day: string): number;
export declare function seStoriesForDay(posts: readonly SeStoryPost[], day: string): SeStoryPost[];
export declare function seStoryOpening(text: string, max?: number): string;
