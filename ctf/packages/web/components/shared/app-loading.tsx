import type { CSSProperties } from 'react';

// The single app-wide loading screen ("Exit Their Economy / Exit The Psyop").
// Every surface's loading state renders this — there is intentionally no other
// loading variant anywhere in the app. Canonical design: the design/ submodule
// HubLoading.tsx (mirrors app/loading.tsx / loading.module.css).
const lineStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.18em',
  color: 'rgba(255, 255, 255, 0.22)',
  textTransform: 'uppercase',
  fontWeight: 500,
  lineHeight: 2,
};

export function AppLoading() {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#0F1117', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div style={{ ...lineStyle, marginBottom: 16 }}>Exit Their Economy</div>
        <div style={lineStyle}>Exit The Psyop</div>
      </div>
    </div>
  );
}
