export type SeMatchNeed = {
    key: string;
    label: string;
    titles: readonly string[];
};
export declare const SE_MATCH_NEEDS: readonly SeMatchNeed[];
export type SeMatchNeeds = {
    needKeys: string[];
    jobTitleIds: string[];
};
export type SeMatchState = {
    needs: SeMatchNeeds | null;
    count: number | null;
};
export type SeMatchChange = {
    kind: 'needs';
    needKeys: string[];
} | {
    kind: 'code';
    code: string;
};
export declare function seMatchCode(raw: unknown): string | null;
export declare function seMatchNeedKeys(raw: unknown): string[];
export declare function seParseMatchChange(body: unknown): SeMatchChange | null;
export declare function seMatchTitleNames(needKeys: readonly string[]): string[];
export declare function seMatchNeedsCovered(jobTitleIds: readonly string[], idsByName: ReadonlyMap<string, readonly string[]>): string[];
export declare const SE_MATCH_WORDS: {
    label: string;
    fit: (count: number) => "person fits what you need" | "people fit what you need";
    introduce: string;
    ask: string;
    needsLabel: string;
    show: string;
    saving: string;
    change: string;
    cancel: string;
    codeLabel: string;
    codePlaceholder: string;
    useCode: string;
    badCode: string;
    loading: string;
    failed: string;
    notSaved: string;
    tryAgain: string;
    noCount: string;
};
