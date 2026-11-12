export declare const SE_SCRUB_ID = ":id";
export declare const SE_SCRUB_VALUE = ":value";
export declare const SE_SCRUB_EMAIL = ":email";
export declare const SE_SCRUB_PHONE = ":phone";
export declare function seScrubIds(text: string): string;
export declare function seScrubText(text: string): string;
export declare function seScrubQuery(query: string): string;
export declare function seScrubAddress(address: string): string;
export interface SeScrubBreadcrumb {
    category?: string;
    message?: string;
    data?: {
        [key: string]: unknown;
    };
}
export declare function seScrubBreadcrumb<T extends SeScrubBreadcrumb>(crumb: T): T;
export declare function seScrubReplayFrame<T extends {
    data?: {
        tag?: string;
        payload?: unknown;
    };
}>(frame: T): T;
export declare function seScrubEvent<T extends object>(event: T): T;
