export type MoodCheck = {
    checkId: string;
    submittedAt: string;
    moodValue: number;
};
export type MoodEligibility = {
    eligible: boolean;
    nextEligibleAt: string;
};
export declare function submitMoodCheck(clientId: string, moodValue: number): Promise<MoodCheck>;
export declare function fetchMoodEligibility(clientId: string): Promise<MoodEligibility>;
export { useMoodEligibility, useSubmitMoodCheck } from './hooks';
