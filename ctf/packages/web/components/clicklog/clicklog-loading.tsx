"use client";

// STATE: Loading — data fetch in progress. Ported from
// design/.../survivor-hub/ClickLogLoading.tsx.
import { BG } from "./clicklog-shared";

export function ClicklogLoading() {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: BG, alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui" }}>
      <div style={{ textAlign: "center", padding: "0 32px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", fontWeight: 500, marginBottom: 16, lineHeight: 2 }}>
          EXIT THEIR ECONOMY
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", fontWeight: 500, lineHeight: 2 }}>
          EXIT THE PSYOP
        </div>
      </div>
    </div>
  );
}
