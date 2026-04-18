"use client";
import { useState, useCallback } from 'react';
import { submitMoodCheck, fetchMoodEligibility } from './index';
export function useMoodEligibility(clientId) {
    const [eligibility, setEligibility] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fetchEligibility = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchMoodEligibility(clientId);
            setEligibility(result);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }, [clientId]);
    return { eligibility, loading, error, fetchEligibility };
}
export function useSubmitMoodCheck(clientId) {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const submit = useCallback(async (moodValue) => {
        setLoading(true);
        setError(null);
        try {
            const res = await submitMoodCheck(clientId, moodValue);
            setResult(res);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }, [clientId]);
    return { result, loading, error, submit };
}
