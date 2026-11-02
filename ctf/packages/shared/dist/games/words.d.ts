export type SeDailyWord = {
    word: string;
    part: 'noun' | 'verb' | 'adjective' | 'adverb';
    meaning: string;
    sentence: string;
};
export declare const SE_DAILY_WORDS: readonly SeDailyWord[];
