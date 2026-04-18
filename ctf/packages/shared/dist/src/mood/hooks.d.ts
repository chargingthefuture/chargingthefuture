import { MoodCheck, MoodEligibility } from './index';
export declare function useMoodEligibility(clientId: string): {
    eligibility: MoodEligibility | null;
    loading: boolean;
    error: string | null;
    fetchEligibility: () => Promise<void>;
};
export declare function useSubmitMoodCheck(clientId: string): {
    result: MoodCheck | null;
    loading: boolean;
    error: string | null;
    submit: (moodValue: number) => Promise<void>;
};
