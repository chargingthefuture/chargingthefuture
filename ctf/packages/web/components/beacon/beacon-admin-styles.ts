// Shared styles for the Beacon admin page (beacon-admin-shell.tsx) and its event history list
// (beacon-event-history.tsx). Moved here unchanged so both files draw the same chrome.
import type { BeaconTokens } from './beacon-shared';

export const cardStyle = (t: BeaconTokens): React.CSSProperties => ({ marginTop: 18, borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: 18 });
export const cardTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 12px' };
export const labelStyle = (t: BeaconTokens): React.CSSProperties => ({ display: 'block', fontSize: 12, fontWeight: 600, color: t.SUBTLE, margin: '8px 0 4px' });
export const inputStyle = (t: BeaconTokens): React.CSSProperties => ({ width: '100%', boxSizing: 'border-box', background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, padding: '10px 12px', color: t.TITLE, fontSize: 14, marginBottom: 8 });
export const primaryButtonStyle = (t: BeaconTokens): React.CSSProperties => ({ marginTop: 8, padding: '10px 18px', borderRadius: 10, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 14, fontWeight: 700, cursor: 'pointer' });
export const chipButtonStyle = (t: BeaconTokens): React.CSSProperties => ({ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' });
// Armed-delete chip: same shape as chipButtonStyle, tinted red so the confirming click is visibly
// the destructive one. Red is not derived from the Beacon amber accent on purpose — it must not read
// as just another action.
export const dangerButtonStyle = (t: BeaconTokens): React.CSSProperties => ({ ...chipButtonStyle(t), background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(220,38,38,0.5)', color: '#F87171' });
export const bannerStyle = (t: BeaconTokens): React.CSSProperties => ({ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: t.SURFACE, border: '1px solid', fontSize: 14 });
