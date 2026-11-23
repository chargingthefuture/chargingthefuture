export type SeQuestion = {
    id: string;
    text: string;
    choices: string[];
};
export declare function seQuestionAllowed(question: SeQuestion): boolean;
export declare const SE_QUESTIONS: readonly SeQuestion[];
export declare const SE_QUESTIONS_START = "2026-11-03";
export declare const SE_MATCH_MIN_SAME = 3;
export declare const SE_MATCH_MESSAGE_MAX = 500;
export declare function seQuestionById(id: string): SeQuestion | null;
export declare function seQuestionsOut(day: string): number;
export declare function seQuestionOfDay(day: string): SeQuestion;
export declare function seNextQuestion(day: string, answered: ReadonlySet<string>): SeQuestion | null;
export type SeQuestionMatch = {
    accountId: string;
    handle: string;
    same: number;
    both: number;
    sameQuestionIds: string[];
    messages: SeMatchMessage[];
    unread: number;
};
export type SeMatchMessage = {
    id: string;
    mine: boolean;
    body: string;
    createdAtIso: string;
};
export declare function seMatchLine(match: Pick<SeQuestionMatch, 'same' | 'both' | 'handle'>): string;
