'use client';

// STATE: Loading — ported from design/.../survivor-hub/WhatWorksLoading.tsx.
import { BG } from './ww-shared';

export function WhatWorksLoading() {
  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', background: BG, alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',system-ui" }}>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', fontWeight: 500, marginBottom: 16, lineHeight: 2 }}>
          EXIT THEIR ECONOMY
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', fontWeight: 500, lineHeight: 2 }}>
          EXIT THE PSYOP
        </div>
      </div>
    </div>
  );
}
