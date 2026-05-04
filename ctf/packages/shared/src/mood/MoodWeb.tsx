import React, { useEffect, useState } from 'react';
// TODO: Implement useMoodEligibility and useSubmitMoodCheck hooks
// These hooks were previously imported from '@ctf/shared' but do not exist yet.
// Stubbed below to unblock the build.
const useMoodEligibility = (_clientId: string) => ({
  eligibility: null as { eligible: boolean; nextEligibleAt: string } | null,
  loading: false,
  error: null as string | null,
  fetchEligibility: () => {},
});
const useSubmitMoodCheck = (_clientId: string) => ({
  result: null,
  loading: false,
  error: null as string | null,
  submit: (_mood: number) => {},
});

// TODO: Replace with real clientId from auth context
const getClientId = () => 'demo-client-id';

export const Mood = () => {
  const clientId = getClientId();
  const { eligibility, loading: eligibilityLoading, error: eligibilityError, fetchEligibility } = useMoodEligibility(clientId);
  const { result, loading: submitLoading, error: submitError, submit } = useSubmitMoodCheck(clientId);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => { fetchEligibility(); }, [fetchEligibility]);

  if (eligibilityLoading) return <div style={styles.container}><span style={styles.text}>Loading...</span></div>;
  if (eligibilityError) return <div style={styles.container}><span style={styles.error}>{eligibilityError}</span></div>;

  if (!eligibility) return <div style={styles.container}><span style={styles.empty}>Unable to load eligibility.</span></div>;

  if (!eligibility.eligible) {
    return (
      <div style={styles.container}>
        <span style={styles.info}>You can submit your next mood check on:</span>
        <span style={styles.date}>{new Date(eligibility.nextEligibleAt).toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <span style={styles.title}>How are you feeling today?</span>
      <div style={styles.moodRow}>
        {[1,2,3,4,5].map((v) => (
          <button
            key={v}
            style={{ ...styles.button, ...(selected === v ? styles.selected : {}) }}
            onClick={() => setSelected(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <button
        style={styles.submit}
        onClick={() => selected && submit(selected)}
        disabled={!selected || submitLoading}
      >
        {submitLoading ? 'Submitting...' : 'Submit'}
      </button>
      {submitError && <span style={styles.error}>{submitError}</span>}
      {result && <span style={styles.success}>Mood check submitted!</span>}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: { background: '#181818', padding: 32, borderRadius: 12, maxWidth: 400, margin: '40px auto', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 24, textAlign: 'center' },
  moodRow: { display: 'flex', flexDirection: 'row', gap: 16, marginBottom: 24 },
  button: { background: '#222', color: '#fff', border: '1px solid #FFD600', borderRadius: 8, padding: '12px 20px', fontSize: 18, cursor: 'pointer' },
  selected: { background: '#FFD600', color: '#181818' },
  submit: { background: '#FFD600', color: '#181818', border: 'none', borderRadius: 8, padding: '12px 32px', fontSize: 18, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  info: { color: '#fff', fontSize: 16, marginBottom: 8, textAlign: 'center' },
  date: { color: '#FFD600', fontSize: 18, fontWeight: 600, textAlign: 'center' },
  error: { color: '#FF5252', marginTop: 16, textAlign: 'center' },
  success: { color: '#00E676', marginTop: 16, textAlign: 'center' },
  empty: { color: '#888', fontSize: 16, textAlign: 'center' },
  text: { color: '#fff', fontSize: 16 },
};
