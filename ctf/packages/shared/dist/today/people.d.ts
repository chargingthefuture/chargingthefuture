export type SePerson = {
    id: string;
    name: string;
    headline: string | null;
    jobTitle: string | null;
    claimed: boolean;
    offering: string[];
    listed: string[];
};
export type SePeoplePage = {
    items: SePerson[];
    page: number;
    pageSize: number;
    total: number;
};
export declare const SE_PEOPLE_WORDS: {
    search: string;
    offeringNow: string;
    everyone: string;
    offering: string;
    listed: string;
    profile: string;
    quote: string;
    empty: string;
    failed: string;
    tryAgain: string;
    loading: string;
    previous: string;
    next: string;
    range: (from: number, to: number, total: number) => string;
};
export declare const SE_PEOPLE_PAGE_SIZE = 20;
export declare function sePersonLinks(person: SePerson): {
    profile: string;
    quote: string | null;
};
