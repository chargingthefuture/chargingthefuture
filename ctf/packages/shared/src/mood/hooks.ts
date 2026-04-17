"use client";
import { useState, useCallback } from 'react';
import { submitMoodCheck, fetchMoodEligibility, MoodCheck, MoodEligibility } from './index';

export function useMoodEligibility(clientId: string) {
  const [eligibility, setEligibility] = useState<MoodEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEligibility = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMoodEligibility(clientId);
      setEligibility(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  return { eligibility, loading, error, fetchEligibility };
}

export function useSubmitMoodCheck(clientId: string) {
  const [result, setResult] = useState<MoodCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (moodValue: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await submitMoodCheck(clientId, moodValue);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  return { result, loading, error, submit };
}
