export declare const SE_HOURS_OFFER_WORDS: {
    label: string;
    untitled: string;
    want: string;
    knowSomeone: string;
    skills: (names: readonly string[]) => string;
};
export declare function seHoursOfferText(input: {
    shortDescription: string | null;
    headline: string | null;
    skillNames: readonly string[];
}): {
    title: string;
    body: string | null;
};
