export declare function seIsLadderWord(word: string): boolean;
export declare function seOneLetterApart(a: string, b: string): boolean;
export declare function seLadderPath(from: string, to: string): string[] | null;
export type SeLadderCheck = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
export declare function seCheckLadderStep(last: string, typed: string): SeLadderCheck;
