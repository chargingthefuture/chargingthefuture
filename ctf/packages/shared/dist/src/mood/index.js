// Shared Mood plugin logic for web and mobile
// - Handles API calls, eligibility, submission, and empty state logic
// - Dark mode only (per design)
// - Analytics/tracking hooks to be added if required by contract
// API endpoints (to be used by both web and mobile)
const API_BASE = '/api/mood/checks';
export async function submitMoodCheck(clientId, moodValue) {
    const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, moodValue }),
        credentials: 'include',
    });
    if (!res.ok)
        throw new Error('Failed to submit mood check');
    return res.json();
}
export async function fetchMoodEligibility(clientId) {
    const res = await fetch(`${API_BASE}/eligible?clientId=${encodeURIComponent(clientId)}`, {
        credentials: 'include',
    });
    if (!res.ok)
        throw new Error('Failed to fetch eligibility');
    return res.json();
}
// Add analytics/tracking hooks here if required by contract
// Export client hooks for client-only imports
export { useMoodEligibility, useSubmitMoodCheck } from './hooks';
