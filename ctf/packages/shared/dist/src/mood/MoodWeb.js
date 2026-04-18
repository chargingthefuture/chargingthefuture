import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useMoodEligibility, useSubmitMoodCheck } from '@ctf/shared';
// TODO: Replace with real clientId from auth context
const getClientId = () => 'demo-client-id';
export const Mood = () => {
    const clientId = getClientId();
    const { eligibility, loading: eligibilityLoading, error: eligibilityError, fetchEligibility } = useMoodEligibility(clientId);
    const { result, loading: submitLoading, error: submitError, submit } = useSubmitMoodCheck(clientId);
    const [selected, setSelected] = useState(null);
    useEffect(() => { fetchEligibility(); }, [fetchEligibility]);
    if (eligibilityLoading)
        return _jsx("div", { style: styles.container, children: _jsx("span", { style: styles.text, children: "Loading..." }) });
    if (eligibilityError)
        return _jsx("div", { style: styles.container, children: _jsx("span", { style: styles.error, children: eligibilityError }) });
    if (!eligibility)
        return _jsx("div", { style: styles.container, children: _jsx("span", { style: styles.empty, children: "Unable to load eligibility." }) });
    if (!eligibility.eligible) {
        return (_jsxs("div", { style: styles.container, children: [_jsx("span", { style: styles.info, children: "You can submit your next mood check on:" }), _jsx("span", { style: styles.date, children: new Date(eligibility.nextEligibleAt).toLocaleString() })] }));
    }
    return (_jsxs("div", { style: styles.container, children: [_jsx("span", { style: styles.title, children: "How are you feeling today?" }), _jsx("div", { style: styles.moodRow, children: [1, 2, 3, 4, 5].map((v) => (_jsx("button", { style: { ...styles.button, ...(selected === v ? styles.selected : {}) }, onClick: () => setSelected(v), children: v }, v))) }), _jsx("button", { style: styles.submit, onClick: () => selected && submit(selected), disabled: !selected || submitLoading, children: submitLoading ? 'Submitting...' : 'Submit' }), submitError && _jsx("span", { style: styles.error, children: submitError }), result && _jsx("span", { style: styles.success, children: "Mood check submitted!" })] }));
};
const styles = {
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
