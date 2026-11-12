export declare const SE_WEAVERS_LIMIT_WORDS: {
    readonly rule: "Bringing people into rooms, and pictures and links in posts, are for Weavers of the Commons.";
    readonly bring: "Bringing people into rooms is for Weavers of the Commons.";
    readonly picture: "Pictures in posts are for Weavers of the Commons.";
    readonly link: "Links in posts are for Weavers of the Commons. Take the link out to post this.";
};
export declare function seHasLink(text: string): boolean;
export type SeBringIn = 'button' | 'weavers_only' | 'none';
export declare function seBringIn(scope: string | null | undefined, canBringSomeoneIn: boolean | undefined): SeBringIn;
