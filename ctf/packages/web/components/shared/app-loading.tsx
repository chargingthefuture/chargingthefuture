"use client";

import { useEffect, useState, type CSSProperties } from 'react';

// The single app-wide loading screen ("Exit Their Economy / Exit The Psyop").
// Every surface's loading state renders this — there is intentionally no other
// loading variant anywhere in the app. Canonical design: the design/ submodule
// HubLoading.tsx. The route-level app/loading.tsx delegates to this component.
//
// It deliberately holds back its own appearance: for the first `delayMs` it
// renders nothing, so a load that finishes quickly (the common case) never
// flashes a loading screen on and off — a flash is jarring and, for screen
// readers, announces a "loading" state that's already gone. The screen only
// appears if the work is genuinely taking a moment.
const lineStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.18em',
  color: 'rgba(255, 255, 255, 0.22)',
  textTransform: 'uppercase',
  fontWeight: 500,
  lineHeight: 2,
};

export function AppLoading({ delayMs = 300 }: { delayMs?: number }) {
  const [show, setShow] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const id = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  // Nothing during the brief delay — a fast load unmounts this before the
  // timer fires, so the loading screen never appears at all.
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{ display: 'flex', minHeight: '100dvh', width: '100%', background: '#0F1117', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div style={{ padding: '0 32px' }}>
        <div style={{ ...lineStyle, marginBottom: 16 }}>Exit Their Economy</div>
        <div style={lineStyle}>Exit The Psyop</div>
      </div>
    </div>
  );
}
